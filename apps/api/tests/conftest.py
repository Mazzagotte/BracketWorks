from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys
from typing import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.api import deps
from app.api.v1 import users as users_module
from app.core import legal_disclosure, models, utils
from app.core.config import settings
from app.main import app
from app.middleware.rate_limit import rate_limiter


engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def _reset_db() -> Iterator[None]:
    models.Base.metadata.create_all(bind=engine)
    try:
        yield
    finally:
        models.Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db_session() -> Iterator[Session]:
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture()
def api_client() -> Iterator[TestClient]:
    def override_get_db() -> Iterator[Session]:
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[deps.get_db] = override_get_db
    original_session_local = deps.SessionLocal

    original_refresh_secure = settings.REFRESH_TOKEN_COOKIE_SECURE
    original_csrf_secure = settings.CSRF_COOKIE_SECURE
    original_require_redis = rate_limiter._require_redis

    settings.REFRESH_TOKEN_COOKIE_SECURE = False
    settings.CSRF_COOKIE_SECURE = False
    rate_limiter._require_redis = False
    deps.SessionLocal = TestingSessionLocal

    client = TestClient(app)
    try:
        yield client
    finally:
        client.close()
        app.dependency_overrides.clear()
        deps.SessionLocal = original_session_local
        settings.REFRESH_TOKEN_COOKIE_SECURE = original_refresh_secure
        settings.CSRF_COOKIE_SECURE = original_csrf_secure
        rate_limiter._require_redis = original_require_redis


@dataclass
class AuthIdentity:
    user: models.User
    headers: dict[str, str]


def _naive_utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def create_user(db: Session, username: str, *, is_admin: bool = False, password: str = "StrongPass1!") -> models.User:
    user = models.User(
        username=username,
        email=f"{username}@example.com",
        first_name="Test",
        last_name="User",
        password=users_module.pwd_context.hash(password),
        is_admin=is_admin,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    acceptance = models.LegalDisclosureAcceptance(
        user_id=user.id,
        disclosure_version=legal_disclosure.VERSION,
        disclosure_hash=legal_disclosure.content_hash(),
        accepted_at=datetime.now(timezone.utc),
        next_required_at=datetime.now(timezone.utc) + timedelta(days=365),
        acceptance_source="pytest",
    )
    db.add(acceptance)
    db.commit()

    return user


def create_auth_headers(db: Session, user: models.User) -> dict[str, str]:
    session_id = secrets.token_hex(16)
    refresh_hash = secrets.token_hex(32)
    session = models.AuthSession(
        session_id=session_id,
        user_id=user.id,
        token_family=secrets.token_hex(8),
        refresh_token_hash=refresh_hash,
        source_ip_hash=None,
        user_agent_fingerprint=None,
        device_nickname="pytest",
        region_hint=None,
        risk_score=0.0,
        issued_at=_naive_utcnow(),
        last_seen_at=_naive_utcnow(),
        expires_at=_naive_utcnow() + timedelta(hours=12),
        is_revoked=False,
        revoked_at=None,
        replaced_by_session_id=None,
    )
    db.add(session)
    db.commit()

    token = utils.create_access_token(
        {
            "sub": str(user.id),
            "sid": session_id,
            "type": "access",
        }
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def auth_identity(db_session: Session) -> AuthIdentity:
    user = create_user(db_session, "workflow_owner")
    return AuthIdentity(user=user, headers=create_auth_headers(db_session, user))


@pytest.fixture()
def make_user(db_session: Session):
    def factory(username: str, *, is_admin: bool = False) -> models.User:
        return create_user(db_session, username, is_admin=is_admin)

    return factory


@pytest.fixture()
def make_auth_headers(db_session: Session):
    def factory(user: models.User) -> dict[str, str]:
        return create_auth_headers(db_session, user)

    return factory
