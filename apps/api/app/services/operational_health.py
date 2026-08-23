from __future__ import annotations

from collections import deque
from datetime import datetime, timezone
import logging
import os
from threading import Lock

BACKEND_VERSION = os.getenv("APP_VERSION", "0.0.1")
PROCESS_STARTED_AT = datetime.now(timezone.utc)
DEPLOYED_AT = os.getenv("DEPLOYED_AT") or os.getenv("RENDER_DEPLOY_TIMESTAMP") or os.getenv("VERCEL_GIT_COMMIT_SHA")

_errors: deque[dict] = deque(maxlen=50)
_lock = Lock()
_background_jobs = {
    "account_cleanup": {"status": "starting", "last_run_at": None, "last_success_at": None, "last_error": None},
}


class RecentErrorHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        if record.levelno < logging.ERROR:
            return
        entry = {
            "timestamp": datetime.fromtimestamp(record.created, timezone.utc).isoformat(),
            "logger": record.name,
            "level": record.levelname,
            "message": record.getMessage()[:500],
        }
        with _lock:
            _errors.appendleft(entry)


def install_error_capture() -> None:
    root = logging.getLogger()
    if not any(isinstance(handler, RecentErrorHandler) for handler in root.handlers):
        root.addHandler(RecentErrorHandler())


def mark_background_job(name: str, *, status: str, error: str | None = None) -> None:
    now = datetime.now(timezone.utc).isoformat()
    with _lock:
        job = _background_jobs.setdefault(name, {})
        job["status"] = status
        job["last_run_at"] = now
        job["last_error"] = error[:500] if error else None
        if status == "healthy":
            job["last_success_at"] = now


def health_runtime_snapshot() -> dict:
    with _lock:
        return {
            "process_started_at": PROCESS_STARTED_AT.isoformat(),
            "last_deployment": DEPLOYED_AT,
            "background_jobs": {name: dict(value) for name, value in _background_jobs.items()},
            "recent_errors": list(_errors)[:20],
        }
