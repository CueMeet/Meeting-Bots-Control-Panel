import re
import base64
import logging
from builtins import bytes
from urllib.error import URLError
from urllib.parse import urlparse
from urllib.request import urlopen
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


logger = logging.getLogger(__name__)


_CERT_CACHE = {}

SES_REGEX_CERT_URL = re.compile(
    r"(?i)^https://sns\.[a-z0-9\-]+\.amazonaws\.com(\.cn)?/SimpleNotificationService\-[a-z0-9]+\.pem$"
)

EVENT_CERT_DOMAINS = getattr(
    settings,
    "AWS_SNS_EVENT_CERT_TRUSTED_DOMAINS",
    getattr(
        settings,
        "AWS_SNS_BOUNCE_CERT_TRUSTED_DOMAINS",
        ["amazonaws.com", "amazon.com"],
    ),
)


class EventMessageVerifier(object):
    """
    A utility class for validating event messages

    See: http://docs.amazonwebservices.com/sns/latest/gsg/SendMessageToHttp.verify.signature.html
    """

    _REQ_DEP_TMPL = (
        "%s is required for event message verification. Please install "
        "`django-ses` with the `event` extra - e.g. "
        "`pip install django-ses[events]`."
    )

    def __init__(self, notification):
        """
        Creates a new event message from the given dict.
        """
        self._data = notification
        self._verified = None

    def is_verified(self):
        """
        Verifies an SES event message.

        Sign the bytes from the notification and compare it to the signature in
        the notification. If same, return True; else False.
        """
        if self._verified is not None:
            return self._verified

        signature = self._data.get("Signature")
        if not signature:
            self._verified = False
            return self._verified

        signature = bytes(base64.b64decode(signature))

        sign_bytes = self._get_bytes_to_sign()
        if not sign_bytes:
            self._verified = False
            return self._verified

        if not self.certificate:
            self._verified = False
            return self._verified

        try:
            from cryptography.exceptions import InvalidSignature
            from cryptography.hazmat.primitives import hashes
            from cryptography.hazmat.primitives.asymmetric import padding
        except ImportError:
            raise ImproperlyConfigured(self._REQ_DEP_TMPL % "`cryptography`")
        
        pkey = self.certificate.public_key()
        try:
            pkey.verify(
                signature,
                sign_bytes,
                padding.PKCS1v15(),
                hashes.SHA1(),
            )
        except InvalidSignature:
            logger.warning(
                "Invalid signature on message with ID: %s",
                self._data.get("MessageId"),
            )
            self._verified = False
        else:
            self._verified = True
        return self._verified

    @property
    def certificate(self):
        """
        Retrieves the certificate used to sign the event message.

        :returns: None if the cert cannot be retrieved. Else, gets the cert
        caches it, and returns it, or simply returns it if already cached.
        """
        cert_url = self._get_cert_url()
        if not cert_url:
            return None

        if cert_url in _CERT_CACHE:
            return _CERT_CACHE[cert_url]

        try:
            import requests
            from requests import RequestException
        except ImportError:
            raise ImproperlyConfigured(self._REQ_DEP_TMPL % "`requests`")

        try:
            from cryptography import x509
        except ImportError:
            raise ImproperlyConfigured(self._REQ_DEP_TMPL % "`cryptography`")

        try:
            response = requests.get(cert_url, timeout=10)
            response.raise_for_status()
        except RequestException as exc:
            logger.warning(
                "Network error downloading certificate from " "%s: %s",
                cert_url,
                exc,
            )
            _CERT_CACHE[cert_url] = None
            return _CERT_CACHE[cert_url]

        try:
            _CERT_CACHE[cert_url] = x509.load_pem_x509_certificate(response.content)
        except ValueError as e:
            logger.warning('Could not load certificate from %s: "%s"', cert_url, e)
            _CERT_CACHE[cert_url] = None

        return _CERT_CACHE[cert_url]

    def _get_cert_url(self):
        """
        Get the signing certificate URL.
        Only accept urls that match the domains set in the
        AWS_SNS_EVENT_CERT_TRUSTED_DOMAINS setting. Sub-domains
        are allowed. i.e. if amazonaws.com is in the trusted domains
        then sns.us-east-1.amazonaws.com will match.
        """
        cert_url = self._data.get("SigningCertURL")
        if not cert_url:
            logger.warning('No signing certificate URL: "%s"', cert_url)
            return None

        if not cert_url.startswith("https://"):
            logger.warning('Untrusted certificate URL: "%s"', cert_url)
            return None

        url_obj = urlparse(cert_url)
        for trusted_domain in EVENT_CERT_DOMAINS:
            parts = trusted_domain.split(".")
            if "amazonaws.com" in trusted_domain:
                if not SES_REGEX_CERT_URL.match(cert_url):
                    if len(parts) < 4:
                        return None
                    else:
                        logger.warning('Possible security risk for: "%s"', cert_url)
                        logger.warning(
                            "It is strongly recommended to configure the full domain in EVENT_CERT_DOMAINS. "
                            "See v3.5.0 release notes for more details."
                        )

            if url_obj.netloc.split(".")[-len(parts) :] == parts:
                return cert_url

        return None

    def _get_bytes_to_sign(self):
        """
        Creates the message used for signing SNS notifications.
        This is used to verify the bounce message when it is received.
        """
        msg_type = self._data.get("Type")
        if msg_type == "Notification":
            fields_to_sign = [
                "Message",
                "MessageId",
                "Subject",
                "Timestamp",
                "TopicArn",
                "Type",
            ]
        elif (
            msg_type == "SubscriptionConfirmation"
            or msg_type == "UnsubscribeConfirmation"
        ):
            fields_to_sign = [
                "Message",
                "MessageId",
                "SubscribeURL",
                "Timestamp",
                "Token",
                "TopicArn",
                "Type",
            ]
        else:
            logger.warning('Unrecognized SNS message Type: "%s"', msg_type)
            return None

        bytes_to_sign = []
        for field in fields_to_sign:
            field_value = self._data.get(field)
            if not field_value:
                continue

            bytes_to_sign.append(f"{field}\n{field_value}\n")

        return "".join(bytes_to_sign).encode()


def verify_event_message(notification):
    """
    Verify an SES/SNS event notification message.
    """
    verifier = EventMessageVerifier(notification)
    return verifier.is_verified()


def confirm_sns_subscription(notification):
    logger.info(
        "Received subscription confirmation: TopicArn: %s",
        notification.get("TopicArn"),
        extra={
            "notification": notification,
        },
    )
    subscribe_url = notification.get("SubscribeURL")
    try:
        urlopen(subscribe_url).read()
    except URLError as e:
        logger.error(
            'Could not confirm subscription: "%s"',
            e,
            extra={
                "notification": notification,
            },
            exc_info=True,
        )