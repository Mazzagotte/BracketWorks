
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import admin, health, bowlers, brackets, tournaments, users, squads, bracket_settings, scores, payouts, public
from app.core.config import settings
from app.core.rate_limit import RateLimiter

app = FastAPI(title="BracketWorks API", version="0.0.1", redirect_slashes=False)

def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


origins = _split_csv(settings.CORS_ORIGINS)
allow_origin_regex = None
if settings.is_development:
    origins = list(dict.fromkeys(origins + _split_csv(settings.DEV_CORS_ORIGINS)))
    allow_origin_regex = r"https?://(localhost|127\\.0\\.0\\.1|\\d{1,3}(?:\\.\\d{1,3}){3})(:\\d+)?"

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

rate_limiter = RateLimiter(
    redis_url=settings.REDIS_URL or None,
    key_prefix=settings.RATE_LIMIT_KEY_PREFIX,
)


def _extract_client_identifier(request: Request) -> str:
    trusted_proxies = set(_split_csv(settings.TRUSTED_PROXY_IPS))
    direct_client_ip = request.client.host if request.client else ""

    use_forwarded_header = bool(direct_client_ip and direct_client_ip in trusted_proxies)
    if use_forwarded_header:
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            ip = forwarded_for.split(",")[0].strip()
            return ip or direct_client_ip or "unknown"

        real_ip = (request.headers.get("x-real-ip") or "").strip()
        if real_ip:
            return real_ip

    ip = direct_client_ip if direct_client_ip else "unknown"
    return ip or "unknown"


def _route_rate_limit(path: str, method: str) -> tuple[str, int, int] | None:
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

    return None


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    rule = _route_rate_limit(request.url.path, request.method)
    if not rule:
        return await call_next(request)

    route_name, limit, window_seconds = rule
    client_identifier = _extract_client_identifier(request)
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


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
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

# Root endpoint for basic testing
@app.get("/")
async def root():
    return {
        "message": "BracketWorks API is running!",
        "version": "0.0.1",
        "status": "healthy"
    }

# Basic health endpoint
@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "API is running"}

app.include_router(health.router, prefix="/api/v1/health", tags=["health"])
app.include_router(bowlers.router, prefix="/api/v1/bowlers", tags=["bowlers"])
app.include_router(brackets.router, prefix="/api/v1/brackets", tags=["brackets"])
app.include_router(tournaments.router, prefix="/api/v1/tournaments", tags=["tournaments"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(squads.router, prefix="/api/v1/squads", tags=["squads"])
app.include_router(bracket_settings.router, prefix="/api/v1/bracket-settings", tags=["bracket-settings"])
app.include_router(scores.router, prefix="/api/v1/scores", tags=["scores"])
app.include_router(payouts.router, prefix="/api/v1/payouts", tags=["payouts"])
app.include_router(public.router, prefix="/api/v1/public", tags=["public"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])
