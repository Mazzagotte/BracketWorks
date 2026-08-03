from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from threading import Lock
from typing import Any, Callable
import traceback
import uuid


@dataclass
class JobRecord:
    job_id: str
    job_type: str
    status: str = "queued"
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: datetime | None = None
    completed_at: datetime | None = None
    result: dict[str, Any] | None = None
    error: str | None = None


class AsyncJobStore:
    def __init__(self) -> None:
        self._lock = Lock()
        self._jobs: dict[str, JobRecord] = {}

    def create(self, job_type: str) -> JobRecord:
        with self._lock:
            job = JobRecord(job_id=str(uuid.uuid4()), job_type=job_type)
            self._jobs[job.job_id] = job
            return job

    def get(self, job_id: str) -> JobRecord | None:
        with self._lock:
            return self._jobs.get(job_id)

    def list_recent(self, limit: int = 100) -> list[JobRecord]:
        with self._lock:
            return sorted(self._jobs.values(), key=lambda job: job.created_at, reverse=True)[:limit]

    def run(self, job_id: str, fn: Callable[[], dict[str, Any]]) -> None:
        job = self.get(job_id)
        if not job:
            return
        job.status = "running"
        job.started_at = datetime.now(timezone.utc)
        try:
            result = fn()
            job.status = "succeeded"
            job.result = result
            job.error = None
        except Exception as exc:
            job.status = "failed"
            job.error = f"{exc}\n{traceback.format_exc()}"
            job.result = None
        finally:
            job.completed_at = datetime.now(timezone.utc)


job_store = AsyncJobStore()


def to_dict(job: JobRecord) -> dict[str, Any]:
    return {
        "job_id": job.job_id,
        "job_type": job.job_type,
        "status": job.status,
        "created_at": job.created_at.isoformat(),
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "result": job.result,
        "error": job.error,
    }
