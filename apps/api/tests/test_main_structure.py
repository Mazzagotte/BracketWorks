import sys
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.api.router import api_router
from app.main import app


def test_api_router_is_available_and_health_endpoints_work():
    assert api_router is not None
    assert len(api_router.routes) > 0

    client = TestClient(app)
    assert client.get("/").status_code == 200
    assert client.get("/health").status_code == 200
