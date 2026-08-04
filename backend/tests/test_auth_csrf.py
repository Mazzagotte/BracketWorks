from collections.abc import Callable

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api import deps
from app.api.v1 import users as users_module
from app.core import models
from app.core.config import settings
from app.main import app, rate_limiter


engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _create_user(username: str = "csrf_user", password: str = "StrongPass1!") -> models.User:
    db = TestingSessionLocal()
    try:
        user = models.User(
            username=username,
            email=f"{username}@example.com",
            first_name="CSRF",
            last_name="Tester",
            password=users_module.pwd_context.hash(password),
            is_admin=False,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    finally:
        db.close()


def _make_client() -> tuple[TestClient, Callable[[], None]]:
    models.Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[deps.get_db] = override_get_db

    # Secure cookies are blocked on plain-http test clients; disable only for tests.
    original_refresh_secure = settings.REFRESH_TOKEN_COOKIE_SECURE
    original_csrf_secure = settings.CSRF_COOKIE_SECURE
    original_csrf_toggle = settings.CSRF_PROTECT_REFRESH_AND_LOGOUT
    original_require_redis = rate_limiter._require_redis

    settings.REFRESH_TOKEN_COOKIE_SECURE = False
    settings.CSRF_COOKIE_SECURE = False
    settings.CSRF_PROTECT_REFRESH_AND_LOGOUT = True
    rate_limiter._require_redis = False

    client = TestClient(app)

    def cleanup() -> None:
        client.close()
        app.dependency_overrides.clear()
        settings.REFRESH_TOKEN_COOKIE_SECURE = original_refresh_secure
        settings.CSRF_COOKIE_SECURE = original_csrf_secure
        settings.CSRF_PROTECT_REFRESH_AND_LOGOUT = original_csrf_toggle
        rate_limiter._require_redis = original_require_redis
        models.Base.metadata.drop_all(bind=engine)

    return client, cleanup


def test_refresh_requires_csrf_header_and_accepts_matching_token():
    client, cleanup = _make_client()
    try:
        _create_user(username="csrf_refresh")

        login_response = client.post(
            "/api/v1/users/login-json",
            json={"username": "csrf_refresh", "password": "StrongPass1!"},
        )
        assert login_response.status_code == 200

        csrf_cookie_name = settings.CSRF_COOKIE_NAME
        csrf_token = client.cookies.get(csrf_cookie_name)
        assert csrf_token

        missing_csrf_response = client.post("/api/v1/users/refresh", json={})
        assert missing_csrf_response.status_code == 403

        bad_csrf_response = client.post(
            "/api/v1/users/refresh",
            json={},
            headers={settings.CSRF_HEADER_NAME: "bad-token"},
        )
        assert bad_csrf_response.status_code == 403

        good_csrf_response = client.post(
            "/api/v1/users/refresh",
            json={},
            headers={settings.CSRF_HEADER_NAME: csrf_token},
        )
        assert good_csrf_response.status_code == 200
        data = good_csrf_response.json()
        assert data.get("access_token")
        assert data.get("refresh_token") is None
    finally:
        cleanup()


def test_logout_requires_csrf_header():
    client, cleanup = _make_client()
    try:
        _create_user(username="csrf_logout")

        login_response = client.post(
            "/api/v1/users/login-json",
            json={"username": "csrf_logout", "password": "StrongPass1!"},
        )
        assert login_response.status_code == 200

        csrf_token = client.cookies.get(settings.CSRF_COOKIE_NAME)
        assert csrf_token

        access_token = login_response.json()["access_token"]

        missing_csrf_response = client.post(
            "/api/v1/users/logout",
            json={"all_sessions": False},
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert missing_csrf_response.status_code == 403

        valid_csrf_response = client.post(
            "/api/v1/users/logout",
            json={"all_sessions": False},
            headers={
                "Authorization": f"Bearer {access_token}",
                settings.CSRF_HEADER_NAME: csrf_token,
            },
        )
        assert valid_csrf_response.status_code == 200
        assert "revoked_sessions" in valid_csrf_response.json()
    finally:
        cleanup()
