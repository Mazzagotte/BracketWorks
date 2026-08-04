from __future__ import annotations

from fastapi import Request

from app.core.config import settings


def create_security_headers_middleware():
    async def middleware(request: Request, call_next):
        response = await call_next(request)

        if not settings.SECURITY_HEADERS_ENABLED:
            return response

        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault(
            "Permissions-Policy",
            "camera=(), microphone=(), geolocation=(), payment=()",
        )
        response.headers.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'")

        if settings.is_production:
            response.headers.setdefault(
                "Strict-Transport-Security",
                f"max-age={settings.SECURITY_HEADERS_HSTS_MAX_AGE_SECONDS}; includeSubDomains",
            )

        return response

    return middleware
