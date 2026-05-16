import json
import logging
import os
from urllib import error as url_error
from urllib.parse import urlencode
from urllib import request as url_request

from ..core.config import settings

logger = logging.getLogger(__name__)

RESET_PASSWORD_TEMPLATE_ID = "reset-password"
RESET_PASSWORD_SUBJECT = "Reset your BracketWorks password"
RESET_PASSWORD_SUPPORT_EMAIL = "support@bracketworks.app"
RESET_PASSWORD_EXPIRATION_MINUTES = 10
RESET_PASSWORD_FROM = "BracketWorks <no-reply@bracketworks.app>"
VERIFY_EMAIL_TEMPLATE_ID = "verify-email"
VERIFY_EMAIL_SUBJECT = "Verify your BracketWorks email"
VERIFY_EMAIL_EXPIRATION_MINUTES = 30
VERIFY_EMAIL_FROM = "BracketWorks <no-reply@bracketworks.app>"
WELCOME_EMAIL_TEMPLATE_ID = "welcome-email"
WELCOME_EMAIL_SUBJECT = "Welcome to BracketWorks"
WELCOME_EMAIL_FROM = "BracketWorks <no-reply@bracketworks.app>"
PASSWORD_CHANGE_TEMPLATE_ID = "password-change"
PASSWORD_CHANGE_SUBJECT = "Your BracketWorks password was changed"
PASSWORD_CHANGE_FROM = "BracketWorks <no-reply@bracketworks.app>"
EMAIL_CHANGE_TEMPLATE_ID = "email-change"
EMAIL_CHANGE_SUBJECT = "Your BracketWorks email was changed"
EMAIL_CHANGE_FROM = "BracketWorks <no-reply@bracketworks.app>"


def _base_template_variables() -> dict[str, str]:
    return {
        "logo_url": _frontend_url("/logo.svg"),
        "support_email": RESET_PASSWORD_SUPPORT_EMAIL,
    }


def _reset_password_template_variables(reset_url: str) -> dict[str, str]:
    return {
        **_base_template_variables(),
        "reset_url": reset_url,
        "expiration_minutes": str(RESET_PASSWORD_EXPIRATION_MINUTES),
    }


def _verify_email_template_variables(verification_url: str) -> dict[str, str]:
    return {
        **_base_template_variables(),
        "verify_url": verification_url,
        "verification_url": verification_url,
        "verify_email_url": verification_url,
        "verification_link": verification_url,
        "action_url": verification_url,
        "button_url": verification_url,
        "link_url": verification_url,
        "expiration_minutes": str(VERIFY_EMAIL_EXPIRATION_MINUTES),
    }


def _welcome_email_template_variables(first_name: str) -> dict[str, str]:
    return {
        **_base_template_variables(),
        "first_name": first_name,
    }


def _password_change_template_variables(first_name: str) -> dict[str, str]:
    return {
        **_base_template_variables(),
        "first_name": first_name,
    }


def _email_change_template_variables(first_name: str, previous_email: str, new_email: str) -> dict[str, str]:
    return {
        **_base_template_variables(),
        "first_name": first_name,
        "previous_email": previous_email,
        "new_email": new_email,
    }


def build_reset_password_payload(user_email: str, *, reset_token: str | None = None, reset_url: str | None = None) -> dict | None:
    resolved_reset_url = (reset_url or "").strip() or build_reset_password_url((reset_token or "").strip())
    if not resolved_reset_url:
        logger.error("Missing reset token or reset URL for password reset email")
        return None

    return {
        "from": RESET_PASSWORD_FROM,
        "to": user_email,
        "subject": RESET_PASSWORD_SUBJECT,
        "template": {
            "id": RESET_PASSWORD_TEMPLATE_ID,
            "variables": _reset_password_template_variables(resolved_reset_url),
        },
    }


def build_verify_email_payload(user_email: str, *, verification_token: str | None = None, verification_url: str | None = None) -> dict | None:
    resolved_verification_url = (verification_url or "").strip() or build_verify_email_url((verification_token or "").strip())
    if not resolved_verification_url:
        logger.error("Missing verification token or verification URL for verify email")
        return None

    return {
        "from": VERIFY_EMAIL_FROM,
        "to": user_email,
        "subject": VERIFY_EMAIL_SUBJECT,
        "template": {
            "id": VERIFY_EMAIL_TEMPLATE_ID,
            "variables": _verify_email_template_variables(resolved_verification_url),
        },
    }


def build_welcome_email_payload(user_email: str, *, first_name: str | None = None) -> dict:
    resolved_first_name = (first_name or "").strip()
    return {
        "from": WELCOME_EMAIL_FROM,
        "to": user_email,
        "subject": WELCOME_EMAIL_SUBJECT,
        "template": {
            "id": WELCOME_EMAIL_TEMPLATE_ID,
            "variables": _welcome_email_template_variables(resolved_first_name),
        },
    }


def build_password_change_email_payload(user_email: str, *, first_name: str | None = None) -> dict:
    resolved_first_name = (first_name or "").strip()
    return {
        "from": PASSWORD_CHANGE_FROM,
        "to": user_email,
        "subject": PASSWORD_CHANGE_SUBJECT,
        "template": {
            "id": PASSWORD_CHANGE_TEMPLATE_ID,
            "variables": _password_change_template_variables(resolved_first_name),
        },
    }


def build_email_change_email_payload(
    user_email: str,
    *,
    first_name: str | None = None,
    previous_email: str | None = None,
    new_email: str | None = None,
) -> dict:
    resolved_first_name = (first_name or "").strip()
    resolved_previous_email = (previous_email or "").strip().lower()
    resolved_new_email = (new_email or "").strip().lower()
    return {
        "from": EMAIL_CHANGE_FROM,
        "to": user_email,
        "subject": EMAIL_CHANGE_SUBJECT,
        "template": {
            "id": EMAIL_CHANGE_TEMPLATE_ID,
            "variables": _email_change_template_variables(
                resolved_first_name,
                resolved_previous_email,
                resolved_new_email,
            ),
        },
    }


def _frontend_url(path: str) -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}{path}"


def build_reset_password_url(reset_token: str) -> str:
    query_string = urlencode({"token": reset_token})
    return f"{_frontend_url('/reset-password')}?{query_string}"


def build_verify_email_url(verification_token: str) -> str:
    query_string = urlencode({"token": verification_token})
    return f"{_frontend_url('/verify-email')}?{query_string}"


def _send_template_email(payload: dict, *, log_context: str, recipient_email: str) -> bool:
    resend_api_key = os.getenv("RESEND_API_KEY", settings.RESEND_API_KEY).strip()
    if not resend_api_key:
        logger.error("RESEND_API_KEY is not configured; email not sent", extra={"context": log_context})
        return False

    request_body = json.dumps(payload).encode("utf-8")
    request = url_request.Request(
        "https://api.resend.com/emails",
        data=request_body,
        headers={
            "Authorization": f"Bearer {resend_api_key}",
            "Content-Type": "application/json",
            "User-Agent": "BracketWorks/1.0",
        },
        method="POST",
    )

    try:
        with url_request.urlopen(request, timeout=15) as response:
            status_code = getattr(response, "status", None) or response.getcode()
            if 200 <= status_code < 300:
                logger.info("Resend hosted template email sent", extra={"context": log_context, "email": recipient_email})
                return True

            logger.error(
                "Resend hosted template send failed with non-success status",
                extra={"context": log_context, "email": recipient_email, "status_code": status_code},
            )
            return False
    except url_error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="replace")
        logger.error(
            "Resend hosted template send failed",
            extra={"context": log_context, "email": recipient_email, "status_code": exc.code, "details": details},
        )
        return False
    except Exception as exc:
        logger.exception(
            "Unexpected error while sending hosted template email",
            extra={"context": log_context, "email": recipient_email, "error": str(exc)},
        )
        return False


def sendResetPasswordEmail(user_email: str, reset_token: str | None = None, reset_url: str | None = None) -> bool:
    payload = build_reset_password_payload(user_email, reset_token=reset_token, reset_url=reset_url)
    if not payload:
        return False

    return _send_template_email(payload, log_context="password-reset", recipient_email=user_email)


def sendVerifyEmail(user_email: str, verification_token: str | None = None, verification_url: str | None = None) -> bool:
    payload = build_verify_email_payload(user_email, verification_token=verification_token, verification_url=verification_url)
    if not payload:
        return False

    return _send_template_email(payload, log_context="verify-email", recipient_email=user_email)


def sendWelcomeEmail(user_email: str, first_name: str | None = None) -> bool:
    payload = build_welcome_email_payload(user_email, first_name=first_name)

    return _send_template_email(payload, log_context="welcome-email", recipient_email=user_email)


def sendPasswordChangeEmail(user_email: str, first_name: str | None = None) -> bool:
    payload = build_password_change_email_payload(user_email, first_name=first_name)

    return _send_template_email(payload, log_context="password-change", recipient_email=user_email)


def sendEmailChangeEmail(
    user_email: str,
    *,
    first_name: str | None = None,
    previous_email: str | None = None,
    new_email: str | None = None,
) -> bool:
    payload = build_email_change_email_payload(
        user_email,
        first_name=first_name,
        previous_email=previous_email,
        new_email=new_email,
    )

    return _send_template_email(payload, log_context="email-change", recipient_email=user_email)
