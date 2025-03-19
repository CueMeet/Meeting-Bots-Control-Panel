from django.conf.urls import include
from django.urls import path, re_path
from rest_framework.routers import DefaultRouter

from .views import (
    FileManagementRootView,
    S3SNSEventWebhookView
)


router = DefaultRouter()
router.APIRootView = FileManagementRootView
router.trailing_slash = '/?'

urlpatterns = [
    path('notification/s3_event_webhook/', S3SNSEventWebhookView.as_view(), name='s3_sns_event_webhook'),
    re_path('^', include(router.urls)),   
]