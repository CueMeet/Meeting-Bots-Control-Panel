import string
import uuid
import hashlib
from rapidfuzz import fuzz
from nltk.tokenize import sent_tokenize
from datetime import datetime, timedelta, timezone


# Function to parse timestamps with 'Z' representing UTC
def parse_timestamp(ts_str: str) -> datetime:
    if ts_str.endswith('Z'):
        ts_str = ts_str[:-1] + '+00:00'
    return datetime.strptime(ts_str, '%Y-%m-%dT%H:%M:%S.%f%z')
# Function to generate unique speaker IDs
def unique_speaker_ids():
    md5_hash = hashlib.md5()
    md5_hash.update(str(uuid.uuid4()).encode('utf-8'))
    return md5_hash.hexdigest()

def reconcile_speakers(voice_transcript: list, original_transcript: dict):
    """
    Reconciles the speakers in the voice transcript with the original transcript by assigning
    person names based on timestamp alignment and text similarity.

    :param voice_transcript: List of dicts containing 'Speaker', 'Transcription_Start_Time', and 'Transcription_Data' keys.
    :param original_transcript: Dict containing 'meeting_start_time' and 'transcript' keys.
    :return: The reconciled voice transcript with updated 'personName' and 'Speaker' fields.
    """

    if not original_transcript or not original_transcript.get("transcript"):
        speaker_to_personName = {}
        for entry in voice_transcript:
            if entry['Speaker'] not in speaker_to_personName:
                # Assign a new unique ID if this speaker has not been encountered before
                speaker_to_personName[entry['Speaker']] = unique_speaker_ids()
            # Update the Speaker field to the unique ID
            entry['Speaker'] = speaker_to_personName[entry['Speaker']]
    else:
        # Parse the meeting start time from the original transcript
        meeting_start_time_str = original_transcript.get('meeting_start_time')
        meeting_start_time = parse_timestamp(meeting_start_time_str)

        # Extract the transcript entries from the original transcript
        original_entries = original_transcript.get('transcript', [])

        # Convert voice transcript times to absolute times using meeting_start_time
        for entry in voice_transcript:
            # 'Transcription_Start_Time' is already a timedelta
            entry['absolute_time'] = meeting_start_time + entry['Transcription_Start_Time']
            # Ensure the absolute_time has timezone info
            entry['absolute_time'] = entry['absolute_time'].astimezone(timezone.utc)

        # Parse timestamps and split personTranscripts into sentences
        original_sentences = []
        for entry in original_entries:
            absolute_time = parse_timestamp(entry['timeStamp']).astimezone(timezone.utc)
            personName = entry['personName']
            for sentence in sent_tokenize(entry['personTranscript']):
                original_sentences.append({
                    'personName': personName,
                    'absolute_time': absolute_time,
                    'personTranscript': sentence.strip()
                })

        # Maximum allowed time difference (in seconds)
        MAX_TIME_DIFF = 60
        # Minimum similarity threshold for fuzzy string matching
        SIMILARITY_THRESHOLD = 0.7

        # Initialize index for original transcript
        j = 0
        len_original = len(original_sentences)

        # Process each entry in the voice transcript
        for voice_entry in voice_transcript:
            voice_time = voice_entry['absolute_time']
            min_time_diff = timedelta(seconds=MAX_TIME_DIFF)
            matched_original_entry = None

            # Skip original entries that are too early
            while j < len_original and original_sentences[j]['absolute_time'] < voice_time - timedelta(seconds=MAX_TIME_DIFF):
                j += 1

            # Check original entries within the time window
            k = j
            while k < len_original and original_sentences[k]['absolute_time'] <= voice_time + timedelta(seconds=MAX_TIME_DIFF):
                original_entry = original_sentences[k]
                time_diff = abs(voice_time - original_entry['absolute_time'])
                if time_diff <= timedelta(seconds=MAX_TIME_DIFF):
                    # Compare the personTranscripts using fuzzy string matching
                    voice_text = (str(voice_entry['Transcription_Data'])).strip()
                    original_text = (str(original_entry['personTranscript'])).strip()
                    voice_text_normalized = voice_text.lower().translate(str.maketrans('', '', string.punctuation))
                    original_text_normalized = original_text.lower().translate(str.maketrans('', '', string.punctuation))
                    similarity = max(
                        fuzz.WRatio(voice_text_normalized, original_text_normalized) / 100.0,
                        fuzz.partial_ratio(voice_text_normalized, original_text_normalized) / 100.0
                    )
                    if similarity >= SIMILARITY_THRESHOLD:
                        if time_diff < min_time_diff:
                            min_time_diff = time_diff
                            matched_original_entry = original_entry
                k += 1

            if matched_original_entry:
                # Assign the personName to the voice entry
                voice_entry['Speaker'] = matched_original_entry['personName']
            else:
                # No match found; set personName to None
                voice_entry['Speaker'] = 'Unknown Speaker'

    return voice_transcript