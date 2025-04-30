from django_socio_grpc.proto_serializers import ModelProtoSerializer
from api.transcript_management.models import FileLog, TranscriptionLog

from .transcript_management_pb2 import TranscriptionLogListResponse, TranscriptionLogResponse, FileManagementResponse


class FileManagementProtoSerializer(ModelProtoSerializer):

    class Meta:
        model = FileLog
        proto_class = FileManagementResponse
        fields = ['id', 'raw_file_key', 'audio_file_key', 'meeting_title', 'meeting_meeting_start_time', 'meeting_meeting_end_time', 'execution_id', 'bot_used', 'status', 'created_by_user_id']
        read_only_fields = ('id', 'created_at', 'audio_file_key', 'updated_at', 'status', 'process_started_at', 'process_completed_at', 'meeting_meeting_start_time', 'meeting_meeting_end_time', 'meeting_timezone', 'bot_used', 'execution_id',)


class TranscriptionLogProtoSerializer(ModelProtoSerializer):

    class Meta:
        model = TranscriptionLog
        proto_class = TranscriptionLogResponse
        proto_class_list = TranscriptionLogListResponse
        fields = ['id', 'speaker', 'transcription_start_time_milliseconds', 'transcription_end_time_milliseconds', 'transcription_Data']
