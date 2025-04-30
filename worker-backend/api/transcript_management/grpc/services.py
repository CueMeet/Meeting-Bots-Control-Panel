from django_socio_grpc.generics import AsyncListService, GenericService
from .serializers import FileManagementProtoSerializer, TranscriptionLogProtoSerializer
from .filters import fileLogIdGrpcFilterBackend, IdGrpcFilterBackend
from api.transcript_management.models import FileLog, TranscriptionLog
from django_filters.rest_framework import DjangoFilterBackend
from django_socio_grpc.filters import OrderingFilter
from django_socio_grpc.decorators import grpc_action
from api.transcript_management.worker import _transcript_generator_worker

from .transcript_management_pb2 import HealthCheckhealthCheckResponse


class DocumentFileManagementService(GenericService):
    queryset = FileLog.objects.all()
    serializer_class = FileManagementProtoSerializer

    @grpc_action(
        request=FileManagementProtoSerializer,
        response=FileManagementProtoSerializer,
    )
    async def DocumentCreate(self, request, context):
        serializer = await self.aget_serializer(message=request)
        await serializer.ais_valid(raise_exception=True)
        
        instance = await serializer.asave()
        raw_file_key = instance.raw_file_key
        if raw_file_key:
            _transcript_generator_worker.delay(raw_file_key)
        
        return await serializer.amessage

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