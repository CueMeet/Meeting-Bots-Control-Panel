from django_socio_grpc.generics import AsyncListService, AsyncCreateService, GenericService
from .serializers import FileManagementProtoSerializer, TranscriptionLogProtoSerializer
from .filters import fileLogIdGrpcFilterBackend, IdGrpcFilterBackend
from api.transcript_management.models import FileLog, TranscriptionLog
from django_filters.rest_framework import DjangoFilterBackend
from django_socio_grpc.filters import OrderingFilter
from django_socio_grpc.decorators import grpc_action

from .transcript_management_pb2 import HealthCheckhealthCheckResponse

class FileManagementService(AsyncCreateService):
    queryset = FileLog.objects.all()
    serializer_class = FileManagementProtoSerializer
    async def create(self, request, context):
        serializer = self.get_serializer(data=request)
        await serializer.is_valid(raise_exception=True)
        instance = await serializer.save()
        return self.get_serializer(instance)


class FileManagementListService(AsyncListService):
    queryset = FileLog.objects.all()
    serializer_class = FileManagementProtoSerializer
    filter_backends = [IdGrpcFilterBackend, DjangoFilterBackend, OrderingFilter]
    filterset_fields = {
        'id': ['exact', 'in'],
        'raw_file_key': ['exact', 'in'],
        'status': ['exact', 'in'],
        'execution_id': ['exact', 'in'],
        'created_by_user_id': ['exact', 'in'],
        'process_started_at': ['exact', 'gte', 'lte'],
        'process_completed_at': ['exact', 'gte', 'lte'],
        'created_at': ['exact', 'gte', 'lte'],
    }
    ordering_fields = '__all__'
    ordering = ['-created_at']


class TranscriptionLogListService(AsyncListService):
    queryset = TranscriptionLog.objects.all()
    serializer_class = TranscriptionLogProtoSerializer
    filter_backends = [fileLogIdGrpcFilterBackend, DjangoFilterBackend, OrderingFilter]
    ordering_fields = '__all__'
    ordering = ['created_at']


class HealthCheck(GenericService):
    @grpc_action(
        request={},
        response=[{"name": "ServingStatus", "type": "string"}],
    )
    async def healthCheck(self, request, context):
        return HealthCheckhealthCheckResponse(ServingStatus='200')    