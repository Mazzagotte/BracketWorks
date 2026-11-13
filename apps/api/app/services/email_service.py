import json
import logging
import os
from urllib import error as url_error
from urllib.parse import urlencode
from urllib import request as url_request

from ..core.config import settings
from .email_brands import EmailBrand, get_brand

logger = logging.getLogger(__name__)

# Hosted Resend template ids. The templates are shared by BracketWorks and Tournament Central and
# take the brand variables from ``EmailBrand.template_variables``.
RESET_PASSWORD_TEMPLATE_ID = "reset-password"
VERIFY_EMAIL_TEMPLATE_ID = "verify-email"
WELCOME_EMAIL_TEMPLATE_ID = "welcome-email"
PASSWORD_CHANGE_TEMPLATE_ID = "password-change"
EMAIL_CHANGE_TEMPLATE_ID = "email-change"
STAFF_INVITE_TEMPLATE_ID = "tournament-staff-invite"

SUPPORT_EMAIL = "support@bracketworks.app"
# Kept for older imports; the support address is the same for both brands.
RESET_PASSWORD_SUPPORT_EMAIL = SUPPORT_EMAIL
RESET_PASSWORD_EXPIRATION_MINUTES = 10
VERIFY_EMAIL_EXPIRATION_MINUTES = 30


def _base_template_variables(brand: EmailBrand) -> dict[str, str]:
    return {
        **brand.template_variables(),
        "support_email": SUPPORT_EMAIL,
    }


def _payload(brand: EmailBrand, to: str, subject: str, template_id: str, variables: dict[str, str]) -> dict:
    """A hosted-template email. The subject is set here, so it is branded too: the API's subject
    replaces the template's own."""
    return {
        "from": brand.from_address,
        "to": to,
        "subject": subject,
        "template": {"id": template_id, "variables": {**_base_template_variables(brand), **variables}},
    }


def build_reset_password_url(reset_token: str, *, site: str | None = None) -> str:
    return f"{get_brand(site).url('/reset-password')}?{urlencode({'token': reset_token})}"


def build_verify_email_url(verification_token: str, *, site: str | None = None) -> str:
    return f"{get_brand(site).url('/verify-email')}?{urlencode({'token': verification_token})}"


def build_reset_password_payload(
    user_email: str,
    *,
    reset_token: str | None = None,
    reset_url: str | None = None,
    site: str | None = None,
) -> dict | None:
    brand = get_brand(site)
    resolved_reset_url = (reset_url or "").strip()
    if not resolved_reset_url and (reset_token or "").strip():
        resolved_reset_url = build_reset_password_url(reset_token.strip(), site=brand.site)
    if not resolved_reset_url:
        logger.error("Missing reset token or reset URL for password reset email")
        return None

    return _payload(
        brand,
        user_email,
        f"Reset your {brand.product_name} password",
        RESET_PASSWORD_TEMPLATE_ID,
        {"reset_url": resolved_reset_url, "expiration_minutes": str(RESET_PASSWORD_EXPIRATION_MINUTES)},
    )


def build_verify_email_payload(
    user_email: str,
    *,
    verification_token: str | None = None,
    verification_url: str | None = None,
    site: str | None = None,
) -> dict | None:
    brand = get_brand(site)
    resolved_url = (verification_url or "").strip()
    if not resolved_url and (verification_token or "").strip():
        resolved_url = build_verify_email_url(verification_token.strip(), site=brand.site)
    if not resolved_url:
        logger.error("Missing verification token or verification URL for verify email")
        return None

    return _payload(
        brand,
        user_email,
        f"Verify your {brand.product_name} email",
        VERIFY_EMAIL_TEMPLATE_ID,
        {
            "verification_url": resolved_url,
            # Older names for the same link, kept for templates that still use them.
            "verify_url": resolved_url,
            "verify_email_url": resolved_url,
            "verification_link": resolved_url,
            "action_url": resolved_url,
            "button_url": resolved_url,
            "link_url": resolved_url,
            "expiration_minutes": str(VERIFY_EMAIL_EXPIRATION_MINUTES),
        },
    )


def build_welcome_email_payload(user_email: str, *, first_name: str | None = None, site: str | None = None) -> dict:
    brand = get_brand(site)
    return _payload(
        brand,
        user_email,
        f"Welcome to {brand.product_name}",
        WELCOME_EMAIL_TEMPLATE_ID,
        {"first_name": (first_name or "").strip(), "login_url": brand.url("/login")},
    )


def build_password_change_email_payload(
    user_email: str, *, first_name: str | None = None, site: str | None = None
) -> dict:
    brand = get_brand(site)
    return _payload(
        brand,
        user_email,
        f"Your {brand.product_name} password was changed",
        PASSWORD_CHANGE_TEMPLATE_ID,
        {"first_name": (first_name or "").strip()},
    )


def build_email_change_email_payload(
    user_email: str,
    *,
    first_name: str | None = None,
    previous_email: str | None = None,
    new_email: str | None = None,
    site: str | None = None,
) -> dict:
    brand = get_brand(site)
    return _payload(
        brand,
        user_email,
        f"Your {brand.product_name} email was changed",
        EMAIL_CHANGE_TEMPLATE_ID,
        {
            "first_name": (first_name or "").strip(),
            "previous_email": (previous_email or "").strip().lower(),
            "new_email": (new_email or "").strip().lower(),
        },
    )


def sendTournamentStaffInviteEmail(
    user_email: str,
    *,
    tournament_name: str,
    role: str,
    invitation_id: int,
    invitation_token: str,
    site: str | None = None,
) -> bool:
    brand = get_brand(site)
    query_string = urlencode({"staff_invitation_id": invitation_id, "staff_invitation_token": invitation_token})
    payload = _payload(
        brand,
        user_email,
        f"You were invited to a {brand.product_name} tournament",
        STAFF_INVITE_TEMPLATE_ID,
        {
            "tournament_name": tournament_name,
            "role": role.replace("_", " ").title(),
            "action_url": f"{brand.url('/dashboard')}?{query_string}",
        },
    )
    return _send_template_email(payload, log_context="tournament-staff-invite", recipient_email=user_email)


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


def sendResetPasswordEmail(
    user_email: str,
    reset_token: str | None = None,
    reset_url: str | None = None,
    *,
    site: str | None = None,
) -> bool:
    payload = build_reset_password_payload(user_email, reset_token=reset_token, reset_url=reset_url, site=site)
    if not payload:
        return False
    return _send_template_email(payload, log_context="password-reset", recipient_email=user_email)


def sendVerifyEmail(
    user_email: str,
    verification_token: str | None = None,
    verification_url: str | None = None,
    *,
    site: str | None = None,
) -> bool:
    payload = build_verify_email_payload(
        user_email, verification_token=verification_token, verification_url=verification_url, site=site
    )
    if not payload:
        return False
    return _send_template_email(payload, log_context="verify-email", recipient_email=user_email)


def sendWelcomeEmail(user_email: str, first_name: str | None = None, *, site: str | None = None) -> bool:
    payload = build_welcome_email_payload(user_email, first_name=first_name, site=site)
    return _send_template_email(payload, log_context="welcome-email", recipient_email=user_email)


def sendPasswordChangeEmail(user_email: str, first_name: str | None = None, *, site: str | None = None) -> bool:
    payload = build_password_change_email_payload(user_email, first_name=first_name, site=site)
    return _send_template_email(payload, log_context="password-change", recipient_email=user_email)


def sendEmailChangeEmail(
    user_email: str,
    *,
    first_name: str | None = None,
    previous_email: str | None = None,
    new_email: str | None = None,
    site: str | None = None,
) -> bool:
    payload = build_email_change_email_payload(
        user_email,
        first_name=first_name,
        previous_email=previous_email,
        new_email=new_email,
        site=site,
    )
    return _send_template_email(payload, log_context="email-change", recipient_email=user_email)
