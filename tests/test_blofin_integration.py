import base64
import hashlib
import hmac

import httpx
import pytest

from routes.blofin_routes import setup_blofin_routes
from src.blofin_client import (
    DEMO_REST_URL,
    BlofinClient,
    BlofinConfig,
    BlofinConfigurationError,
    normalize_instrument,
    sign_request,
)


def test_signature_matches_blofin_hex_then_base64_contract():
    signature = sign_request(
        "test-secret",
        "GET",
        "/api/v1/account/balance",
        "1597026383085",
        "123e4567-e89b-12d3-a456-426614174000",
    )
    assert signature == "OWRiNzg2NjY2YWI0MTdmNTcxZWZjOGJmOTk2OWNmMDhhYzlkNzAzYWYyYjkxMjZkNmFlOTE2ZTZmMTRkMzM2Yw=="

    decoded = base64.b64decode(signature).decode("ascii")
    expected = hmac.new(
        b"test-secret",
        b"/api/v1/account/balanceGET1597026383085123e4567-e89b-12d3-a456-426614174000",
        hashlib.sha256,
    ).hexdigest()
    assert decoded == expected


def test_demo_is_the_safe_default_and_instruments_are_normalized():
    config = BlofinConfig()
    assert config.environment == "demo"
    assert config.base_url == DEMO_REST_URL
    assert config.credentials_configured is False
    assert normalize_instrument(" btc-usdt ") == "BTC-USDT"
    with pytest.raises(ValueError):
        normalize_instrument("BTC/USDT")


def test_blofin_key_types_are_labeled_without_enabling_execution():
    assert BlofinConfig(key_type=2).connection_mode == "mcp"
    assert BlofinConfig(key_type=1).connection_mode == "transaction"
    assert BlofinConfig().connection_mode == "unverified"
    with pytest.raises(BlofinConfigurationError, match="key type"):
        BlofinConfig(key_type=3)


@pytest.mark.asyncio
async def test_public_ticker_has_no_private_headers_and_uses_encoded_query():
    captured = {}

    async def handler(request: httpx.Request):
        captured["request"] = request
        return httpx.Response(200, json={"code": "0", "msg": "success", "data": [{"instId": "BTC-USDT", "last": "50000"}]})

    client = BlofinClient(BlofinConfig(), transport=httpx.MockTransport(handler))
    ticker = await client.ticker("btc-usdt")
    request = captured["request"]
    assert ticker["last"] == "50000"
    assert request.url.path == "/api/v1/market/tickers"
    assert request.url.params["instId"] == "BTC-USDT"
    assert "ACCESS-KEY" not in request.headers
    assert "ACCESS-SIGN" not in request.headers


@pytest.mark.asyncio
async def test_private_read_fails_closed_without_complete_credentials():
    client = BlofinClient(BlofinConfig())
    with pytest.raises(BlofinConfigurationError, match="READ-only API key"):
        await client.balance()


@pytest.mark.asyncio
async def test_private_read_sends_all_required_auth_headers(monkeypatch):
    captured = {}

    async def handler(request: httpx.Request):
        captured["request"] = request
        return httpx.Response(200, json={"code": "0", "msg": "success", "data": {"totalEquity": "10"}})

    monkeypatch.setattr("src.blofin_client.time.time", lambda: 1597026383.085)
    monkeypatch.setattr("src.blofin_client.uuid.uuid4", lambda: "nonce-123")
    config = BlofinConfig(
        environment="demo",
        api_key="read-key",
        api_secret="secret-key",
        passphrase="passphrase",
    )
    client = BlofinClient(config, transport=httpx.MockTransport(handler))
    balance = await client.balance()
    headers = captured["request"].headers
    assert balance["totalEquity"] == "10"
    assert headers["ACCESS-KEY"] == "read-key"
    assert headers["ACCESS-TIMESTAMP"] == "1597026383085"
    assert headers["ACCESS-NONCE"] == "nonce-123"
    assert headers["ACCESS-PASSPHRASE"] == "passphrase"
    assert headers["ACCESS-SIGN"] == sign_request(
        "secret-key",
        "GET",
        "/api/v1/account/balance",
        "1597026383085",
        "nonce-123",
    )


@pytest.mark.asyncio
async def test_api_key_info_uses_permission_inspection_endpoint():
    captured = {}

    async def handler(request: httpx.Request):
        captured["request"] = request
        return httpx.Response(
            200,
            json={"code": "0", "msg": "success", "data": {"readOnly": 1, "type": 2}},
        )

    config = BlofinConfig(
        environment="demo",
        api_key="read-key",
        api_secret="secret-key",
        passphrase="passphrase",
    )
    info = await BlofinClient(config, transport=httpx.MockTransport(handler)).api_key_info()
    assert info["readOnly"] == 1
    assert info["type"] == 2
    assert captured["request"].url.path == "/api/v1/user/query-apikey"


def test_router_exposes_validation_but_no_exchange_order_submission():
    router = setup_blofin_routes()
    paths = {(method, route.path) for route in router.routes for method in (route.methods or set())}
    assert ("POST", "/api/blofin/order-plans/validate") in paths
    assert not any(method == "POST" and path.endswith("/trade/order") for method, path in paths)
    assert not any("place" in path or "submit" in path for _method, path in paths)
