from __future__ import annotations

from fastapi import Request
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.rate_limit import RateLimiter
from app.middleware.client_ip import extract_client_identifier


rate_limiter = RateLimiter(
    redis_url=settings.REDIS_URL or None,
    key_prefix=settings.RATE_LIMIT_KEY_PREFIX,
    require_redis=settings.is_production,
)


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def route_rate_limit(path: str, method: str) -> tuple[str, int, int] | None:
    if method == "OPTIONS":
        return None

    if path in {"/api/v1/users/login", "/api/v1/users/login-json"}:
        return ("auth-login", settings.RATE_LIMIT_LOGIN_PER_MINUTE, 60)

    if path == "/api/v1/users/check-username":
        return ("auth-username-check", settings.RATE_LIMIT_USERNAME_CHECK_PER_MINUTE, 60)

    if path in {"/api/v1/users/request-password-reset", "/api/v1/users/verify-reset-code", "/api/v1/users/reset-password", "/api/v1/users/request-email-verification", "/api/v1/users/verify-email"}:
        return ("auth-reset", settings.RATE_LIMIT_PASSWORD_RESET_PER_MINUTE, 60)

    if path.startswith("/api/v1/public"):
        return ("public-read", settings.RATE_LIMIT_PUBLIC_PER_MINUTE, 60)

    if path in {
        "/api/v1/brackets/generate-multiple",
        "/api/v1/brackets/generate-multiple-async",
    }:
        return ("bracket-generate", settings.RATE_LIMIT_BRACKET_GENERATE_PER_MINUTE, 60)

    if path.startswith("/api/v1/payouts/save/") and path.endswith("/async"):
        return ("background-job", settings.RATE_LIMIT_BRACKET_GENERATE_PER_MINUTE, 60)

    return None


def create_rate_limit_middleware():
    async def middleware(request: Request, call_next):
        rule = route_rate_limit(request.url.path, request.method)
        if not rule:
            return await call_next(request)

        route_name, limit, window_seconds = rule
        client_identifier = extract_client_identifier(request)
        scope_key = f"{route_name}:{client_identifier}"
        result = rate_limiter.hit(scope_key, limit=limit, window_seconds=window_seconds)

        if not result.allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Rate limit exceeded. Please retry later.",
                    "code": "rate_limited",
                    "context": {
                        "route": route_name,
                        "retry_after_seconds": result.retry_after_seconds,
                    },
                },
                headers={
                    "Retry-After": str(result.retry_after_seconds),
                    "X-RateLimit-Limit": str(result.limit),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(result.retry_after_seconds),
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(result.limit)
        response.headers["X-RateLimit-Remaining"] = str(result.remaining)
        response.headers["X-RateLimit-Reset"] = str(result.retry_after_seconds)
        return response

    return middleware
