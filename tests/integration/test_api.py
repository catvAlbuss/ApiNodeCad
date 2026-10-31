import json
import logging
import time

import pytest

from app.api.errors import ApiError
from app.generation import run_with_timeout
from tests.conftest import AUTH, TOKEN, URL, make_client


def test_health_is_public_and_has_no_internals(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert set(response.json()) == {"status", "version"}


@pytest.mark.parametrize("path", ["/docs", "/redoc", "/openapi.json", "/documents/x.dxf", "/exportar"])
def test_unknown_paths_use_error_format(client, path):
    response = client.get(path)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer malo"}, {"Authorization": TOKEN}])
def test_rejects_missing_or_wrong_token(client, sample, headers):
    response = client.post(URL, json=sample, headers=headers)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_authentication_runs_before_parsing(client):
    response = client.post(URL, content=b"{no json", headers={"Content-Type": "application/json"})
    assert response.status_code == 401


def test_valid_contract_reaches_generation(client, sample):
    response = client.post(URL, json=sample, headers=AUTH)
    assert response.status_code == 501
    assert response.json()["error"]["code"] == "NOT_IMPLEMENTED"


def test_invalid_json_is_400(client):
    response = client.post(URL, content=b"{no json", headers={**AUTH, "Content-Type": "application/json"})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_error_matches_contract_and_does_not_echo_input(client, sample):
    sample["geo"]["stem"] = -987.654
    response = client.post(URL, json=sample, headers=AUTH)
    assert response.status_code == 400
    assert response.json() == {
        "error": {
            "code": "VALIDATION_ERROR",
            "message": "geo.stem debe ser mayor que 0",
            "fields": ["geo.stem"],
        }
    }
    assert "987" not in response.text


def test_body_over_limit_with_content_length(sample):
    client = make_client(max_body_bytes=100)
    response = client.post(URL, json=sample, headers=AUTH)
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"


def test_body_over_limit_without_content_length():
    client = make_client(max_body_bytes=100)

    def chunks():
        for _ in range(5):
            yield b"x" * 50

    response = client.post(URL, content=chunks(), headers=AUTH)
    assert response.status_code == 413


def test_rate_limit_returns_429_with_retry_after(sample):
    client = make_client(rate_limit_requests=2)
    statuses = [client.post(URL, json=sample, headers=AUTH).status_code for _ in range(3)]
    assert statuses == [501, 501, 429]


def test_rate_limit_also_counts_failed_tokens(sample):
    client = make_client(rate_limit_requests=1)
    client.post(URL, json=sample)
    response = client.post(URL, json=sample)
    assert response.status_code == 429
    assert int(response.headers["retry-after"]) > 0


def test_rate_limit_does_not_block_health():
    client = make_client(rate_limit_requests=1)
    assert [client.get("/health").status_code for _ in range(3)] == [200, 200, 200]


def test_cors_allows_only_configured_origins(client):
    headers = {"Access-Control-Request-Method": "POST"}
    allowed = client.options(URL, headers={**headers, "Origin": "https://ryaie.com"})
    denied = client.options(URL, headers={**headers, "Origin": "https://evil.example"})
    assert allowed.headers["access-control-allow-origin"] == "https://ryaie.com"
    assert "access-control-allow-origin" not in denied.headers


def test_logs_have_no_project_data(client, sample, caplog):
    sample["project"]["proyecto"] = "DATO-SENSIBLE"
    with caplog.at_level(logging.INFO, logger="app.requests"):
        response = client.post(URL, json=sample, headers=AUTH)
    assert "DATO-SENSIBLE" not in caplog.text
    assert TOKEN not in caplog.text
    entry = json.loads(caplog.records[-1].message)
    assert set(entry) == {"request_id", "method", "path", "status", "duration_ms"}
    assert entry["request_id"] == response.headers["x-request-id"]


def test_unexpected_error_hides_details(sample, monkeypatch, caplog):
    def explode(_):
        raise RuntimeError("secreto interno")

    monkeypatch.setattr("app.api.routes.plans.build_wall_plan", explode)
    client = make_client()
    with caplog.at_level(logging.INFO, logger="app.requests"):
        response = client.post(URL, json=sample, headers=AUTH)
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "INTERNAL_ERROR"
    assert "secreto" not in response.text
    assert "secreto" not in caplog.text
    assert json.loads(caplog.records[-1].message)["error_type"] == "RuntimeError"


@pytest.mark.anyio
async def test_generation_timeout():
    with pytest.raises(ApiError) as error:
        await run_with_timeout(lambda: time.sleep(0.3), 0.01)
    assert (error.value.status, error.value.code) == (500, "GENERATION_TIMEOUT")


@pytest.fixture
def anyio_backend():
    return "asyncio"
