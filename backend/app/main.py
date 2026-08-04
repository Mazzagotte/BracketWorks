from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.middleware import (
    create_legal_disclosure_gate,
    create_rate_limit_middleware,
    create_security_headers_middleware,
)

app = FastAPI(title="BracketWorks API", version="0.0.1", redirect_slashes=False)


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


origins = _split_csv(settings.CORS_ORIGINS)
allow_origin_regex = None
if settings.is_development:
    origins = list(dict.fromkeys(origins + _split_csv(settings.DEV_CORS_ORIGINS)))
    allow_origin_regex = r"https?://(localhost|127\.0\.0\.1|\d{1,3}(?:\.\d{1,3}){3})(:\d+)?"

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Accept",
        "Authorization",
        "Content-Type",
        "Idempotency-Key",
        settings.CSRF_HEADER_NAME,
    ],
)

app.middleware("http")(create_legal_disclosure_gate())
app.middleware("http")(create_rate_limit_middleware())
app.middleware("http")(create_security_headers_middleware())


@app.get("/")
async def root():
    return {
        "message": "BracketWorks API is running!",
        "version": "0.0.1",
        "status": "healthy",
    }


@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "API is running"}


app.include_router(api_router, prefix="/api/v1")