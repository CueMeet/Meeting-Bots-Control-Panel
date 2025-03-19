from django.utils import timezone
from django.conf import settings
import logging


def _send_failure_notification(file_log, task_type: str = "File"):
    highlight_io = settings.HIGHLIGHT_IO
    file_id = file_log.get("raw_file_key", "unknown")
    error_details = {
        "message": f"{task_type} Processing Failed After {settings.FILE_MAX_RETRY_COUNT} attempts",
        "task_type": task_type,
        "file_key": file_log.get("raw_file_key", "unknown"),
        "file_type": file_log.get("file_type", "unknown"),
        "organization_id": file_log.get("organization_id", "unknown"),
        "last_retry": str(timezone.now()),
        "severity": "celery_worker_error",
    }

    try:
        raise Exception(f"{task_type} Processing Failed After {settings.FILE_MAX_RETRY_COUNT} attempts for the id: {file_id}")
    except Exception as e:
        if highlight_io:
            highlight_io.record_exception(e, error_details)
        logging.exception("Exception recorded in Highlight.io")

    logging.error(f"[ALERT] Max retries reached: {error_details}")