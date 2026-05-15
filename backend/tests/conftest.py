import os
import sys

import pytest
from fastapi.testclient import TestClient


os.environ.setdefault("DATABASE_URL", "sqlite:///./test_auth.db")
os.environ.setdefault("SECRET_KEY", "test-auth-secret")
os.environ.setdefault("RATE_LIMIT_LOGIN_PER_MINUTE", "100")
os.environ.setdefault("RATE_LIMIT_PASSWORD_RESET_PER_MINUTE", "100")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.api.deps import engine
from app.core.models import Base
from app.main import app


@pytest.fixture(scope="function")
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    with TestClient(app) as test_client:
        yield test_client

    Base.metadata.drop_all(bind=engine)