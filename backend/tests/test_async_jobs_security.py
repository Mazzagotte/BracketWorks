import pytest
from fastapi import HTTPException

from app.api.v1.brackets import get_bracket_job_status
from app.api.v1.payouts import get_payout_job_status
from app.core import models
from app.core.async_jobs import AsyncJobStore, to_dict
from app.core.async_jobs import job_store


def test_job_records_are_owned_and_do_not_expose_tracebacks():
    store = AsyncJobStore(max_jobs=2)
    job = store.create("test.failure", owner_user_id=42, tournament_id=7)

    def fail():
        raise RuntimeError("sensitive database detail")

    store.run(job.job_id, fail)
    record = store.get(job.job_id)

    assert record is not None
    assert record.owner_user_id == 42
    assert record.tournament_id == 7
    assert record.status == "failed"
    assert "sensitive database detail" not in (record.error or "")
    assert "Traceback" not in (record.error or "")
    assert "owner_user_id" not in to_dict(record)


def test_job_store_evicts_completed_jobs_at_capacity():
    store = AsyncJobStore(max_jobs=1)
    first = store.create("test.first", owner_user_id=1)
    store.run(first.job_id, lambda: {"ok": True})

    second = store.create("test.second", owner_user_id=1)

    assert store.get(first.job_id) is None
    assert store.get(second.job_id) is not None


@pytest.mark.parametrize(
    ("job_type", "status_reader"),
    [
        ("brackets.generate", get_bracket_job_status),
        ("payouts.save", get_payout_job_status),
    ],
)
def test_job_status_rejects_another_user(job_type, status_reader):
    owner = models.User(id=101, username="owner", email="owner@example.com", password="unused")
    other = models.User(id=202, username="other", email="other@example.com", password="unused")
    job = job_store.create(job_type, owner_user_id=owner.id, tournament_id=9)

    assert status_reader(job.job_id, owner)["job_id"] == job.job_id
    with pytest.raises(HTTPException) as error:
        status_reader(job.job_id, other)

    assert error.value.status_code == 404
