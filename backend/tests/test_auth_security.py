import os
import sys

import pytest
from fastapi.testclient import TestClient

os.environ["DATABASE_URL"] = "sqlite:///./test_auth_security.db"
os.environ.setdefault("SECRET_KEY", "test-auth-secret")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.models import Base
from app.api.deps import engine
from app.main import app


@pytest.fixture(scope="function")
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    with TestClient(app) as test_client:
        yield test_client

    Base.metadata.drop_all(bind=engine)


@pytest.mark.integration
def test_login_throttle_blocks_after_repeated_failures(client):
    signup = client.post(
        "/api/v1/users/signup",
        json={
            "first_name": "Rate",
            "last_name": "Limited",
            "username": "rate_user",
            "email": "rate_user@example.com",
            "password": "RatePass123!",
        },
    )
    assert signup.status_code == 200

    statuses = []
    for _ in range(7):
        bad_login = client.post(
            "/api/v1/users/login-json",
            json={"username": "rate_user", "password": "wrong-pass", "grant_type": "password"},
        )
        statuses.append(bad_login.status_code)

    assert 429 in statuses


@pytest.mark.integration
def test_login_rate_limited_response_shape_is_consistent(client):
    signup = client.post(
        "/api/v1/users/signup",
        json={
            "first_name": "Shape",
            "last_name": "Check",
            "username": "shape_user",
            "email": "shape_user@example.com",
            "password": "ShapePass123!",
        },
    )
    assert signup.status_code == 200

    response = None
    for _ in range(7):
        response = client.post(
            "/api/v1/users/login-json",
            json={"username": "shape_user", "password": "wrong-pass", "grant_type": "password"},
        )
        if response.status_code == 429:
            break

    assert response is not None
    assert response.status_code == 429
    payload = response.json()
    assert isinstance(payload.get("detail"), str)
    # Existing login throttle emits detailed retry guidance.
    assert "retry" in payload.get("detail", "").lower() or "too many" in payload.get("detail", "").lower()
