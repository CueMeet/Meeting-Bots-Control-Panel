import os
from distutils.util import strtobool
from pathlib import Path
from dotenv import load_dotenv
from . import monitoring
from celery.schedules import crontab

# Load environment variables from .env file
load_dotenv('.env')
BASE_DIR = Path(__file__).resolve().parent.parent

ALLOWED_HOSTS = []

INSTALLED_APPS = [
    'rest_framework',
    'corsheaders',
    'api.apps.ApiConfig',
    'api.transcript_management.apps.TranscriptManagementConfig',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'drf_yasg',
    'django_filters',
    'django_restql',
    'django_socio_grpc',
]


REST_FRAMEWORK = {
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.OrderingFilter',
        'rest_framework.filters.SearchFilter',
    ],
    'PAGE_SIZE': 20,
    'DEFAULT_PAGINATION_CLASS': 'api.pagination.ResultsPagination',
}

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'worker_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'worker_backend.wsgi.application'


STORAGES = {
    "default": {
        "BACKEND": os.environ.get('FILE_BACKEND', default='django.core.files.storage.FileSystemStorage')
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}


# Database
# https://docs.djangoproject.com/en/5.0/ref/settings/#databases

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME'),
        'USER': os.environ.get('DB_USERNAME'),
        'PASSWORD': os.environ.get('DB_PASSWORD'),
        'HOST': os.environ.get('DB_HOST', default='127.0.0.1'),
        'PORT': int(os.environ.get('DB_PORT', default=5432)),
    }
}


# Password validation
# https://docs.djangoproject.com/en/5.0/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/5.0/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True

STATIC_URL = os.environ.get('STATIC_URL', default='/static/')
STATIC_ROOT = os.path.join(BASE_DIR, os.environ.get('STATIC_ROOT', default='static'))

CORS_ORIGINS = os.environ.get("CORS_ALLOWED_ORIGINS", "*")
if CORS_ORIGINS == "*":
    CORS_ALLOW_ALL_ORIGINS = True
else:
    CORS_ALLOW_ALL_ORIGINS = False
    CORS_ALLOWED_ORIGINS = CORS_ORIGINS.split(",")

CSRF_COOKIE_SECURE = os.environ.get('CSRF_COOKIE_SECURE', default=False)
SESSION_COOKIE_SECURE = os.environ.get('SESSION_COOKIE_SECURE', default=False)
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', default='7bc48b9050830030150a66385ad038fd2490df1a166a07c128112115e353ce4c')

ENV_ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS')
ALLOWED_HOSTS = ENV_ALLOWED_HOSTS.split(',') if ENV_ALLOWED_HOSTS is not None else []

DEBUG = bool(strtobool(os.environ.get('DEBUG', default='True')))
if DEBUG is False: 
    CSRF_COOKIE_SECURE=True
    SESSION_COOKIE_SECURE=True


DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

SWAGGER_SETTINGS = {
    'SECURITY_DEFINITIONS': {
        'Bearer': {
            'type': 'apiKey',
            'name': 'Authorization',
            'in': 'header'
        }
    },
    'USE_SESSION_AUTH': False
}

## GRPC ##
GRPC_FRAMEWORK = {
    "ROOT_HANDLERS_HOOK": 'api.grpc_backend.initialize_grpc_apps',
    "GRPC_ASYNC": True,
    'DEFAULT_PAGINATION_CLASS': 'api.pagination.ResultsPagination',
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.OrderingFilter',
        'rest_framework.filters.SearchFilter',
    ],
}

GRPC_APPS = [
    'api.transcript_management',
]


## HIGHLIGHT ##
if DEBUG is False: 
    HIGHLIGHT_IO = monitoring.init_highlight(
        os.environ.get("HIGHLIGHT_PROJECT_ID", default=None),
        os.environ.get("HIGHLIGHT_ENVIRONMENT_NAME", default=None),
        os.environ.get("SERVICE_NAME", default="CueCard-worker-backend")
    )

## NLTK ##
NLTK_DOWNLOAD_DIR = os.environ.get("NLTK_DOWNLOAD_DIR", default="./nltk")

## CELERY SETTINGS ##
CELERY_BROKER_URL = "redis://{host}:{port}/{db}".format(host=os.environ.get('REDIS_HOST', default="localhost"), port=os.environ.get('REDIS_PORT', default=6379), db=os.environ.get('REDIS_DB', default=2))
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60
# Celery Beat Schedule
CELERY_BEAT_SCHEDULE = {
    'transcription_failed_files': {
        'task': 'api.transcript_management.worker._transcript_retry_cronjob',
        'schedule': crontab(hour='*/4'),  # Run every 4 hours
        'args': (),
        'options': {
            'queue': 'celery',
            'expires': 14400,  # Reduced expiry time to 4 hours
        }
    },
}

# AWS S3
AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')
AWS_REGION = os.environ.get('AWS_REGION')

AWS_STORAGE_BUCKET_NAME = os.environ.get('AWS_STORAGE_BUCKET_NAME', default='meeting-bot-bucket')
AWS_QUERYSTRING_EXPIRE = os.environ.get('_SIGNED_URL_EXPIRY_TIME', default='360') # 6 minutes

## AWS SNS ##
AWS_SNS_VERIFY_EVENT_SIGNATURES = bool(strtobool(os.environ.get('VERIFY_EVENT_SIGNATURES', default='True')))

## ASSEMBLY AI ##
ASSEMBLY_AI_API_KEY = os.environ.get('ASSEMBLY_AI_API_KEY', default='')
