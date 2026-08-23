from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..deps import get_db, require_admin_user
from ...core import models
from ...core.async_jobs import job_store, to_dict as job_to_dict
from ...core.config import settings
from ...services.operational_health import BACKEND_VERSION, health_runtime_snapshot


router = APIRouter()


@router.get("/operations")
def admin_operations(_admin: models.User = Depends(require_admin_user)):
    jobs = [job_to_dict(job) for job in job_store.list_recent(100)]
    return {
        "operations": jobs,
        "summary": {
            "failed": sum(1 for job in jobs if job["status"] == "failed"),
            "running": sum(1 for job in jobs if job["status"] in {"queued", "running"}),
            "succeeded": sum(1 for job in jobs if job["status"] == "succeeded"),
        },
        "note": "Operations are retained for the lifetime of the current backend process.",
    }


@router.get("/system-health")
def admin_system_health(
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin_user),
):
    database_status = "healthy"
    database_error = None
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        database_status = "unhealthy"
        database_error = str(exc)[:300]

    jobs = [job_to_dict(job) for job in job_store.list_recent(100)]
    runtime = health_runtime_snapshot()
    return {
        "checked_at": datetime.now(UTC).isoformat(),
        "frontend_version": None,
        "backend_version": BACKEND_VERSION,
        "environment": settings.ENVIRONMENT,
        "api": {"status": "healthy"},
        "database": {"status": database_status, "error": database_error},
        "email": {
            "status": "configured" if settings.RESEND_API_KEY.strip() else "not_configured",
            "provider": "Resend",
            "sender": settings.FROM_EMAIL,
        },
        "background_jobs": {
            "runtime": runtime["background_jobs"],
            "queued": sum(1 for job in jobs if job["status"] == "queued"),
            "running": sum(1 for job in jobs if job["status"] == "running"),
            "failed": sum(1 for job in jobs if job["status"] == "failed"),
        },
        "process_started_at": runtime["process_started_at"],
        "last_deployment": runtime["last_deployment"],
        "recent_errors": runtime["recent_errors"],
    }
