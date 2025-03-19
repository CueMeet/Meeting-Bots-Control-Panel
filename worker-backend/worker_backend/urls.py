from django.contrib import admin
from django.urls import path
from django.urls import include, path
from django.conf import settings
from django.contrib.staticfiles.urls import staticfiles_urlpatterns

urlpatterns = [
    path('api/', include('api.urls'))
]

if settings.DEBUG:
    urlpatterns += staticfiles_urlpatterns()