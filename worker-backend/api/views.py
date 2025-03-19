from rest_framework.filters import SearchFilter
from rest_framework.response import Response
from rest_framework.views import APIView


class ApiRootView(APIView):
    """
    REST API Documentation
    """
    swagger_schema = None

    def get(self, request, *args, **kwargs):
        apidocs = {
            'worker_backend': request.build_absolute_uri('worker_backend/'),
        }
        return Response(apidocs)
    

class HealthCheckView(APIView):
    """
    Health Check
    """
    swagger_schema = None

    def get(self, request, *args, **kwargs):
        return Response({'status': 'ok'})