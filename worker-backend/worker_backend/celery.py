import os
from . import tokenizer
from celery import Celery
from django.conf import settings


os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'worker_backend.settings')

app = Celery('Worker-Backend', broker=settings.CELERY_BROKER_URL)

app.config_from_object('django.conf:settings', namespace='CELERY')

app.conf.broker_connection_retry_on_startup = True

app.autodiscover_tasks()

app.conf.update(
    task_acks_late=True,
)

@app.on_after_configure.connect
def setup_init(sender, **kwargs):
    ## NLTK ##
    tokenizer.init(settings.NLTK_DOWNLOAD_DIR)


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')