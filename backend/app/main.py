
import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import admin, health, bowlers, brackets, tournaments, users, squads, bracket_settings, scores, payouts, public
from app.core.config import settings
from app.core.rate_limit import RateLimiter

app = FastAPI(title="BracketWorks API", version="0.0.1")

# CORS origins - get from environment variable with fallback to local dev
cors_origins_str = os.getenv("CORS_ORIGINS", "http://localhost:3000")
origins = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]

# Add localhost patterns for development
origins.extend([
    "http://localhost:3000",
    "http://localhost:8000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8000"
])

# Remove duplicates while preserving order
origins = list(dict.fromkeys(origins))

print(f"CORS Origins configured: {origins}")  # For debugging

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https?://(localhost|127\\.0\\.0\\.1)(:\\d+)?",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

rate_limiter = RateLimiter(
    redis_url=settings.REDIS_URL or None,
    key_prefix=settings.RATE_LIMIT_KEY_PREFIX,
)


def _extract_client_identifier(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        ip = forwarded_for.split(",")[0].strip()
    elif request.client:
        ip = request.client.host
    else:
        ip = "unknown"
    return ip or "unknown"


def _route_rate_limit(path: str, method: str) -> tuple[str, int, int] | None:
    if method == "OPTIONS":
        return None

    if path in {"/api/v1/users/login", "/api/v1/users/login-json"}:
        return ("auth-login", settings.RATE_LIMIT_LOGIN_PER_MINUTE, 60)

    if path in {"/api/v1/users/request-password-reset", "/api/v1/users/verify-reset-code", "/api/v1/users/reset-password", "/api/v1/users/request-email-verification", "/api/v1/users/verify-email"}:
        return ("auth-reset", settings.RATE_LIMIT_PASSWORD_RESET_PER_MINUTE, 60)

    if path.startswith("/api/v1/public"):
        return ("public-read", settings.RATE_LIMIT_PUBLIC_PER_MINUTE, 60)

    if path == "/api/v1/brackets/generate-multiple":
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
