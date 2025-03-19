from django.conf.urls import include
from django.urls import include, path, re_path
from drf_yasg import openapi
from drf_yasg.views import get_schema_view
from rest_framework import permissions
from django.conf import settings
from .views import ApiRootView, HealthCheckView


schema_view = get_schema_view(
    openapi.Info(
        title="CueCard MeetingBots | Worker Backend Service",
        default_version='v1',
        description="Data Management API",
    ),
    public = True if settings.DEBUG else False,
    permission_classes = [permissions.AllowAny] if settings.DEBUG else [permissions.IsAuthenticated],
)


urlpatterns = [
    path('', ApiRootView.as_view()),
    path('health_check/', HealthCheckView.as_view()),
    path('transcript_management/', include('api.transcript_management.urls')),
    re_path(r'^swagger(?P<format>\.json|\.yaml)$',schema_view.without_ui(cache_timeout=0), name='schema-json'),
    re_path(r'^swagger/$', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
]