import copy
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

TOKEN = "t" * 40
AUTH = {"Authorization": f"Bearer {TOKEN}"}
URL = "/api/v1/planos/muro-contencion"
SAMPLE = json.loads((Path(__file__).parent / "fixtures" / "muro-7.4m.json").read_text(encoding="utf-8"))


def make_client(**overrides) -> TestClient:
    settings = Settings(_env_file=None, api_token=TOKEN, **overrides)
    return TestClient(create_app(settings), raise_server_exceptions=False)


@pytest.fixture
def client() -> TestClient:
    return make_client()


@pytest.fixture
def sample() -> dict:
    return copy.deepcopy(SAMPLE)
