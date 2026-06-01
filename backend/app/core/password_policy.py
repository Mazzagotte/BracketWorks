import hashlib
from urllib import error as url_error
from urllib import request as url_request

from .config import settings


class PasswordPolicyError(ValueError):
    pass


def _validate_local_policy(password: str) -> None:
    if len(password) < settings.PASSWORD_MIN_LENGTH:
        raise PasswordPolicyError(
            f"Password must be at least {settings.PASSWORD_MIN_LENGTH} characters long"
        )

    if settings.PASSWORD_REQUIRE_UPPERCASE and not any(ch.isupper() for ch in password):
        raise PasswordPolicyError("Password must include at least one uppercase letter")

    if settings.PASSWORD_REQUIRE_LOWERCASE and not any(ch.islower() for ch in password):
        raise PasswordPolicyError("Password must include at least one lowercase letter")

    if settings.PASSWORD_REQUIRE_DIGIT and not any(ch.isdigit() for ch in password):
        raise PasswordPolicyError("Password must include at least one number")

    if settings.PASSWORD_REQUIRE_SYMBOL and not any(not ch.isalnum() for ch in password):
        raise PasswordPolicyError("Password must include at least one symbol")


def _get_pwned_password_count(password: str) -> int | None:
    digest = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()
    prefix, suffix = digest[:5], digest[5:]

    request = url_request.Request(
        f"https://api.pwnedpasswords.com/range/{prefix}",
        headers={
            "User-Agent": "BracketWorks/1.0",
            "Add-Padding": "true",
        },
        method="GET",
    )

    try:
        with url_request.urlopen(
            request, timeout=settings.PASSWORD_BREACH_API_TIMEOUT_SECONDS
        ) as response:
            body = response.read().decode("utf-8", errors="replace")
    except (url_error.URLError, TimeoutError):
        # Fail-open if the external API is unavailable.
        return None

    for line in body.splitlines():
        hash_suffix, _, count_text = line.partition(":")
        if hash_suffix.strip().upper() == suffix:
            try:
                return int(count_text.strip())
            except ValueError:
                return None

    return 0


def validate_password_policy(password: str) -> None:
    _validate_local_policy(password)

    if not settings.PASSWORD_BREACH_CHECK_ENABLED:
        return

    breach_count = _get_pwned_password_count(password)
    if breach_count is None:
        return

    if breach_count > settings.PASSWORD_BREACH_MAX_COUNT:
        raise PasswordPolicyError(
            "Password has appeared in known data breaches. Choose a different password."
        )
