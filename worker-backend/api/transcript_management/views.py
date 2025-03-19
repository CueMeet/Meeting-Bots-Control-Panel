from rest_framework.routers import APIRootView
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.views.generic.base import View
from .models import FileLog, FileState
from django.http import HttpResponseBadRequest, HttpResponse
from api.transcript_management.worker import _transcript_generator_worker
from .utils.sns_verifier import verify_event_message, confirm_sns_subscription
from django.conf import settings
import logging
import json


class FileManagementRootView(APIRootView):
    """
    REST API Documentation for Inventory App
    """
    permission_classes = []


@method_decorator(csrf_exempt, name='dispatch')
class S3SNSEventWebhookView(View):

    def post(self, request, *args, **kwargs):
        raw_json = request.body

        try:
            notification = json.loads(raw_json.decode('utf-8'))
        except ValueError as e:
            logging.warning('Received notification with bad JSON: "%s"', e)
            return HttpResponseBadRequest("The request body could not be deserialized. Bad JSON.")

        if settings.AWS_SNS_VERIFY_EVENT_SIGNATURES and not self.verify_event_message(notification):
            logging.info('Received unverified notification: Type: %s', notification.get('Type'))
            return HttpResponseBadRequest("Signature verification failed.")

        notification_type = notification.get('Type')
        if notification_type == 'SubscriptionConfirmation':
            self.handle_subscription_confirmation(notification)
        elif notification_type == 'UnsubscribeConfirmation':
            self.handle_unsubscribe_confirmation(notification)
        elif notification_type == 'Notification':
            message_str = notification.get('Message')
            if message_str:
                try:
                    message = json.loads(message_str)
                    records = message.get('Records', [])
                    if records:
                        for record in records:
                            s3_event_type = record.get('eventName')
                            if s3_event_type:
                                return self.handle_s3_create_event(s3_event_type, record)
                            else:
                                self.handle_unknown_event_type(s3_event_type, record)
                except ValueError as e:
                    logging.warning('Failed to parse Message JSON: "%s"', e)
                    return HttpResponseBadRequest("Failed to parse Message JSON.")
        else:
            logging.info('Received unknown notification type: %s', notification.get('Type'))
            return HttpResponseBadRequest("Unknown notification type received.")
        return HttpResponse("Notification processed successfully.")

    def verify_event_message(self, notification):
        return verify_event_message(notification)

    def handle_subscription_confirmation(self, notification):
        confirm_sns_subscription(notification)
        return HttpResponse("Subscription confirmed.")

    def handle_unsubscribe_confirmation(self, notification):
        logging.info('Handling Unsubscribe Confirmation')
        return HttpResponse("Unsubscribe confirmed.")

    def handle_unknown_event_type(self, notification, message):
        logging.warning('Received unknown event type', extra={'notification': notification})
        return HttpResponseBadRequest("Received unknown event type.")
    

    def handle_s3_create_event(self, event_type, record):
        # Map event types to specific handler methods
        handlers = {
            'ObjectCreated:Put': self.handle_put,
            'ObjectCreated:Post': self.handle_post,
            'ObjectCreated:Copy': self.handle_copy,
            'ObjectCreated:CompleteMultipartUpload': self.handle_complete_multipart_upload,
        }
        handler = handlers.get(event_type)
        if handler:
            return handler(record)
        else:
            logging.warning('Received unknown S3 create event type: %s', event_type)
            return HttpResponseBadRequest("Unknown S3 event type.")


    def handle_put(self, record):
        try: 
            bucket, key, size = self.extract_s3_object_details(record)
            obj, created = FileLog.objects.get_or_create(raw_file_key=key)
            obj.status = FileState.NOTIFICATION_RECEIVED
            obj.save()
            _transcript_generator_worker.delay(key)
            logging.info(f"File log (PUT) {'created' if created else 'updated'} successfully.")
            logging.info('Handling S3 Put Event')
            return HttpResponse("Handled S3 Put Event.")
        except Exception as e:
            logging.error('Failed to create transcript worker log: %s', e)
            return HttpResponseBadRequest("Failed to handled S3 Put Event.", status=500)

    def handle_post(self, record):
        try:
            bucket, key, size = self.extract_s3_object_details(record)
            obj, created = FileLog.objects.get_or_create(raw_file_key=key)
            obj.status = FileState.NOTIFICATION_RECEIVED
            obj.save()
            _transcript_generator_worker.delay(key)
            logging.info(f"File log (POST) {'created' if created else 'updated'} successfully.")
            logging.info('Handling S3 Post Event')
            return HttpResponse("Handled S3 Post Event.")
        except Exception as e:
            logging.error('Failed to create transcript worker log: %s', e)
            return HttpResponseBadRequest("Failed to handled S3 Post Event.", status=500)


    def handle_copy(self, record):
        logging.info('Handling S3 Copy Event')
        return HttpResponse("Handled S3 Copy Event.")

    def handle_complete_multipart_upload(self, record):
        logging.info('Handling S3 Multipart Upload Completion Event')
        return HttpResponse("Handled S3 Multipart Upload Completion Event.")
    
    def extract_s3_object_details(self, record):
        bucket_name = record['s3']['bucket']['name']
        object_key = record['s3']['object']['key']
        object_size = record['s3']['object'].get('size', 0)  # Default to 0 if size is not present
        return bucket_name, object_key, object_size