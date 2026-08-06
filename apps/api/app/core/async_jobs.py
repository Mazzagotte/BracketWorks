from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from threading import Lock
from typing import Any, Callable
import uuid


@dataclass
class JobRecord:
    job_id: str
    job_type: str
    owner_user_id: int
    tournament_id: int | None = None
    status: str = "queued"
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: datetime | None = None
    completed_at: datetime | None = None
    result: dict[str, Any] | None = None
    error: str | None = None


class AsyncJobStore:
    def __init__(self, max_jobs: int = 1000) -> None:
        self._lock = Lock()
        self._jobs: dict[str, JobRecord] = {}
        self._max_jobs = max_jobs

    def create(self, job_type: str, *, owner_user_id: int, tournament_id: int | None = None) -> JobRecord:
        with self._lock:
            if len(self._jobs) >= self._max_jobs:
                completed = sorted(
                    (job for job in self._jobs.values() if job.completed_at is not None),
                    key=lambda item: item.completed_at or item.created_at,
                )
                for stale_job in completed[: max(1, len(self._jobs) - self._max_jobs + 1)]:
                    self._jobs.pop(stale_job.job_id, None)
            if len(self._jobs) >= self._max_jobs:
                raise RuntimeError("Job queue capacity reached")
            job = JobRecord(
                job_id=str(uuid.uuid4()),
                job_type=job_type,
                owner_user_id=owner_user_id,
                tournament_id=tournament_id,
            )
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
        except Exception:
            job.status = "failed"
            job.error = "The background operation failed. Check server logs for details."
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
