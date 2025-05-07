from celery import shared_task
from api.file_backend import S3Client
from django.utils import timezone
from datetime import timedelta
from django.conf import settings
from .models import FileLog, FileState, TranscriptionLog
from .utils.helper import get_meta_data
from .utils.speaker_reconciliation import reconcile_speakers
from api.utils import _send_failure_notification
from django.db import transaction
import assemblyai as aai
import tempfile
import httpx
import logging
import tarfile
import json
import time
import os


@shared_task(max_retries=4, default_retry_delay=300)
def _transcript_generator_worker(file_key: str):

    logging.info(f"Transcription worker started for file: '{file_key}'")

    s3_client = S3Client()
    aai.settings.api_key = settings.ASSEMBLY_AI_API_KEY
    transcriber = aai.Transcriber()

    try:
        user_id, bot_type, execution_id, meeting_title = get_meta_data(file_key, s3_client)
        file_ref, created = FileLog.objects.update_or_create(
            raw_file_key=file_key,
            defaults={
                'execution_id': execution_id,
                'bot_used': bot_type,
                'created_by_user_id': user_id,
                'process_started_at': timezone.now(),
                'status': FileState.PROCESSING,
                'notes': {'exception': ''} 
            }
        )

        logging.info(f"File metadata {'created' if created else 'updated'} successfully.")
            
        with tempfile.TemporaryDirectory() as temp_dir:
            tar_file_path = os.path.join(temp_dir, 'archive.tar')
            
            # Download tar file directly into the temporary directory
            if s3_client.download_file(file_key, tar_file_path):
                logging.info("Tar file downloaded successfully to temporary directory")
            else:
                logging.warning("Failed to download tar file from S3")
                raise Exception("Failed to download the tar file from S3")

            # Extract files from the tar file
            with tarfile.open(tar_file_path, 'r:*') as tar:
                tar.extractall(path=temp_dir)
                logging.info("Files extracted from tar")

            # Now find the .opus file and .json file
            files_in_dir = os.listdir(temp_dir)
            user_transcript = None
            opus_file_path = None
            json_file_path = None
            meeting_data = None

            logging.info(f"Files found in extracted tar: {files_in_dir}")

            for file_name in files_in_dir:
                if file_name.endswith('.opus'):
                    opus_file_path = os.path.join(temp_dir, file_name)
                elif file_name.endswith('.json'):
                    json_file_path = os.path.join(temp_dir, file_name)

            if not opus_file_path:
                raise Exception("Failed to find .opus in tar archive")
            if not json_file_path:
                meeting_data = {}
            else: 
                with open(json_file_path, 'r') as json_file:
                    meeting_data = json.load(json_file)
            
            with open(opus_file_path, 'rb') as audio_file:
                config = aai.TranscriptionConfig(
                    speaker_labels=True,
                    speech_model=aai.SpeechModel.best,
                    filter_profanity=True,
                    disfluencies=False
                )
                transcript = None
                try:
                    logging.info("Attempting to transcribe audio with AssemblyAI...")
                    transcript = transcriber.transcribe(audio_file, config)
                    if transcript.status == aai.TranscriptStatus.error:
                        logging.error(f"AssemblyAI transcription failed with status '{transcript.status}': {transcript.error}")
                        raise Exception(f"Transcription failed post-communication: {transcript.error}")
                    logging.info("Transcription call completed. Status: %s", transcript.status)
                except httpx.ReadTimeout as rte:
                    logging.error(f"ReadTimeout specifically caught during AssemblyAI transcription: {str(rte)}")
                    raise rte
                except httpx.RequestError as reqe:
                    logging.error(f"An httpx RequestError occurred during AssemblyAI transcription: {str(reqe)}")
                    raise reqe

                if not transcript or transcript.status == aai.TranscriptStatus.error:
                    error_message = transcript.error if transcript and hasattr(transcript, 'error') else "Unknown transcription error or timeout previously occurred."
                    logging.error(f"Cannot proceed with transcription data processing due to error: {error_message}")
                    raise Exception(f"Transcription data unavailable or in error state: {error_message}")

                transcription_data = []
                transcription_logs = []
                sentences = transcript.get_sentences()

                if not sentences:
                    logging.warning("No sentences returned from transcription.")
                
                for u in sentences:
                    transcription_data.append({
                        'Transcription_Start_Time': timedelta(milliseconds=u.start),
                        'Transcription_End_Time': timedelta(milliseconds=u.end),
                        'Speaker': u.speaker,
                        'Transcription_Data': u.text
                    })

            if not transcription_data:
                logging.warning("Transcription data is empty after processing sentences. Check AssemblyAI response.")
            
            user_transcript = reconcile_speakers(transcription_data, meeting_data)

            file_key_modified = file_key.replace("raw_combined/", "").replace(".tar", "")
            audio_s3_key = f"raw_recordings/{file_key_modified}.opus"
            for u in user_transcript:
                transcription_logs.append(TranscriptionLog(
                    file_log=file_ref,
                    speaker=u.get('Speaker', 'Unknown speaker'),
                    transcription_start_time_milliseconds=u['Transcription_Start_Time'],
                    transcription_end_time_milliseconds=u['Transcription_End_Time'],
                    transcription_Data=u.get('Transcription_Data', ''),
                ))

            TranscriptionLog.objects.filter(file_log=file_ref).delete()
            TranscriptionLog.objects.bulk_create(transcription_logs)
            logging.info(f"Transcription logs saved successfully")
            
            file_ref.meeting_title = meeting_title
            file_ref.meeting_meeting_start_time = meeting_data.get('meeting_start_time', None)
            file_ref.meeting_meeting_end_time = meeting_data.get('meeting_end_time', None)
            file_ref.audio_file_key = audio_s3_key
            file_ref.status = FileState.PROCESSED
            file_ref.process_completed_at = timezone.now()
            file_ref.notes['exception'] = ''
            file_ref.save()
            logging.info("File processing completed successfully")
            return "Transcription worker completed"

    except Exception as e:
        logging.error(f"An error occurred during processing: {str(e)}")
        FileLog.objects.filter(raw_file_key=file_key).update(
            status=FileState.FAILED,
            notes={
                'exception': str(e)
            },
            process_completed_at=timezone.now()
        )
        raise Exception(f"Error: {str(e)}")


@shared_task(max_retries=1, default_retry_delay=300)
def _transcript_retry_cronjob():
    started_time = timezone.now() - timezone.timedelta(minutes=5)
    logging.info(f"TranscriptManagement cron job started at {started_time}")

    with transaction.atomic():
        failed_files = FileLog.objects.filter(
            status=FileState.FAILED,
            retry_count__lt=settings.FILE_MAX_RETRY_COUNT, 
            process_completed_at__lt=started_time
        ).select_for_update(skip_locked=True)

        if not failed_files.exists():
            logging.info("No eligible failed files found.")
            return

        for file_log in failed_files:
            try:
                logging.info(f"Retrying processing for transcript: {file_log.raw_file_key} (Attempt {file_log.retry_count + 1})")
                
                file_log.retry_count += 1
                file_log.save()

                if file_log.retry_count >= settings.FILE_MAX_RETRY_COUNT:
                    _send_failure_notification(file_log, task_type="Transcript")
                    continue

                _transcript_generator_worker.delay(file_log.raw_file_key, file_log.file_type)
                time.sleep(30)

            except Exception as e:
                logging.error(f"Failed to process transcript {file_log.raw_file_key}: {str(e)}")
                Exception(f"Error: {str(e)}")