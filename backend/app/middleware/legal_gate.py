from __future__ import annotations

from fastapi import Request
from fastapi.responses import JSONResponse

from app.api import deps as api_deps
from app.core import legal_disclosure, utils
from app.core.config import settings
from app.api.v1 import users


LEGAL_GATE_EXACT_EXEMPTIONS = {
    "/api/v1/users/login",
    "/api/v1/users/login-json",
    "/api/v1/users/signup",
    "/api/v1/users/refresh",
    "/api/v1/users/logout",
    "/api/v1/users/request-password-reset",
    "/api/v1/users/verify-reset-code",
    "/api/v1/users/reset-password",
    "/api/v1/users/request-email-verification",
    "/api/v1/users/verify-email",
    "/api/v1/users/check-username",
    "/api/v1/users/dev-notice/accept",
    "/api/v1/users/legal-disclosure/status",
    "/api/v1/users/legal-disclosure/accept",
}


def _legal_gate_exempt(path: str) -> bool:
    return (
        path in LEGAL_GATE_EXACT_EXEMPTIONS
        or path.startswith("/api/v1/public")
        or path.startswith("/api/v1/health")
        or not path.startswith("/api/v1/")
    )


def create_legal_disclosure_gate():
    async def middleware(request: Request, call_next):
        if request.method == "OPTIONS" or _legal_gate_exempt(request.url.path):
            return await call_next(request)

        token = (request.headers.get("Authorization") or "").removeprefix("Bearer ").strip()
        if not token:
            token = (request.cookies.get(settings.ACCESS_TOKEN_COOKIE_NAME) or "").strip()
        if not token:
            return await call_next(request)

        try:
            payload = utils.decode_access_token(token)
            user_id = int(payload["sub"])
        except Exception:
            return await call_next(request)

        db = api_deps.SessionLocal()
        try:
            now = users._utcnow()
            if legal_disclosure.acceptance_required(db, user_id, now):
                return JSONResponse(
                    status_code=428,
                    content={
                        "detail": "Current legal disclosure acceptance is required.",
                        "code": "legal_disclosure_required",
                        "version": legal_disclosure.VERSION,
                    },
                )
        finally:
            db.close()

        return await call_next(request)

    return middleware
