from django.db import models
from dirtyfields import DirtyFieldsMixin
from api.models import BaseModel
import uuid


class FileState(models.IntegerChoices):
    NOTIFICATION_RECEIVED = 0
    PROCESSING = 1
    PROCESSED = 2
    FAILED = 3
    INITIALIZED = 4


class BotUsed(models.IntegerChoices):
    Google = 0
    MS_TEAMS = 1
    ZOOM = 2


class TaskStatus(models.IntegerChoices):
    PENDING = 0
    IN_PROGRESS = 1
    COMPLETED = 2


class FileLog(BaseModel, DirtyFieldsMixin):
    """
    Model to store logs of raw audio files
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=True, db_index=True)
    raw_file_key = models.CharField(max_length=255, blank=False, null=False, unique=True)
    audio_file_key = models.CharField(max_length=255, blank=True, null=True, unique=True)
    transcription_file_key = models.CharField(max_length=255, blank=True, null=True, unique=True)
    status = models.IntegerField(choices=FileState.choices, default=FileState.INITIALIZED)
    bot_used = models.IntegerField(choices=BotUsed.choices, blank=True, null=True)
    meeting_timezone = models.CharField(max_length=255, blank=True, null=True)

    meeting_title = models.CharField(max_length=255, blank=True, null=True)
    meeting_meeting_start_time = models.DateTimeField(blank=True, null=True)
    meeting_meeting_end_time = models.DateTimeField(blank=True, null=True)

    execution_id = models.UUIDField(blank=True, null=True, db_index=True)
    meeting_ical_uid = models.CharField(max_length=255, blank=True, null=True)
    meeting_scheduled_time = models.DateTimeField(blank=True, null=True)

    process_started_at = models.DateTimeField(blank=True, null=True)
    process_completed_at = models.DateTimeField(blank=True, null=True)

    created_by_user_id = models.UUIDField(blank=True, null=True, db_index=True)
    
    retry_count = models.IntegerField(default=0)

    notes = models.JSONField(blank=True, null=True)

    class Meta:
        db_table = 'file_log'
        indexes = [models.Index(fields=['created_at', ]), ]


class TranscriptionLog(BaseModel, DirtyFieldsMixin):
    """
    Model to store logs of transcriptions
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=True, db_index=True)
    file_log = models.ForeignKey(FileLog, on_delete=models.CASCADE, related_name='transcription_logs', blank=True, null=True, db_index=True)
    
    speaker = models.CharField(max_length=200, blank=True, null=True)
    transcription_start_time_milliseconds = models.DurationField(blank=True, null=True)
    transcription_end_time_milliseconds = models.DurationField(blank=True, null=True)
    transcription_Data = models.TextField(blank=True, null=True)
    created_by_user_id = models.UUIDField(blank=True, null=True, db_index=True)

    class Meta:
        db_table = 'transcription_log'
        indexes = [models.Index(fields=['created_at', ]), ]