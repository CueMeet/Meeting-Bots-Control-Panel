from rest_framework.filters import BaseFilterBackend


class IdGrpcFilterBackend(BaseFilterBackend):
    def filter_queryset(self, request, queryset, view):
        id = request.http_request.__dict__.get('grpc_request_metadata').get('id', None)
        execution_id = request.http_request.__dict__.get('grpc_request_metadata').get('execution_id', None)
        
        filters_applied = False
        if execution_id is not None:
            execution_ids = execution_id.split(',')
            queryset = queryset.filter(execution_id__in=execution_ids)
            filters_applied = True
        if id is not None:
            ids = id.split(',')
            queryset = queryset.filter(id__in=ids)
            filters_applied = True
        return queryset if filters_applied else queryset


class fileLogIdGrpcFilterBackend(BaseFilterBackend):
    def filter_queryset(self, request, queryset, view):
        file_log = request.http_request.__dict__.get('grpc_request_metadata').get('file_log_id', None)
        if file_log is not None:
            return queryset.filter(file_log=file_log)
        return queryset.none()
