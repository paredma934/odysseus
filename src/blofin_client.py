"""Safe BloFin REST client used by Vega and Mission Control.

The connector is intentionally read-only.  It supports public market data and
authenticated account/position/order-history reads, but it does not expose an
order-placement method.  Trading execution can only be added later behind a
separate, explicit approval workflow.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import re
import time
import uuid
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any, Mapping
from urllib.parse import urlencode

import httpx


PRODUCTION_REST_URL = "https://openapi.blofin.com"
DEMO_REST_URL = "https://demo-trading-openapi.blofin.com"
ENVIRONMENT_URLS = {
    "demo": DEMO_REST_URL,
    "production": PRODUCTION_REST_URL,
}

INSTRUMENT_PATTERN = re.compile(r"^[A-Z0-9]{2,20}-[A-Z0-9]{2,12}$")
SUPPORTED_BARS = {
    "1m", "3m", "5m", "15m", "30m", "1H", "2H", "4H", "6H", "8H",
    "12H", "1D", "3D", "1W", "1M",
}


class BlofinError(RuntimeError):
    """Base exception for controlled, secret-free BloFin failures."""


class BlofinConfigurationError(BlofinError):
    """Raised when an authenticated request has no complete credentials."""


class BlofinAPIError(BlofinError):
    """A controlled failure returned by BloFin or the transport."""

    def __init__(self, message: str, *, status_code: int = 502, api_code: str | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.api_code = api_code


@dataclass(frozen=True)
class BlofinConfig:
    environment: str = "demo"
    api_key: str = ""
    api_secret: str = ""
    passphrase: str = ""
    key_type: int | None = None
    source: str = "unconfigured"

    def __post_init__(self) -> None:
        normalized = self.environment.strip().lower()
        if normalized not in ENVIRONMENT_URLS:
            raise BlofinConfigurationError("BloFin environment must be demo or production.")
        object.__setattr__(self, "environment", normalized)
        if self.key_type not in (None, 1, 2):
            raise BlofinConfigurationError("BloFin API key type must be Transaction or MCP.")

    @property
    def base_url(self) -> str:
        return ENVIRONMENT_URLS[self.environment]

    @property
    def credentials_configured(self) -> bool:
        return all((self.api_key, self.api_secret, self.passphrase))

    @property
    def connection_mode(self) -> str:
        return {1: "transaction", 2: "mcp"}.get(self.key_type, "unverified")

    def require_credentials(self) -> None:
        if not self.credentials_configured:
            raise BlofinConfigurationError(
                "BloFin account access is not connected. Add a READ-only API key in Vega's BloFin panel."
            )


def normalize_instrument(inst_id: str) -> str:
    value = str(inst_id or "").strip().upper()
    if not INSTRUMENT_PATTERN.fullmatch(value):
        raise ValueError("Instrument must look like BTC-USDT.")
    return value


def _compact_json(payload: Mapping[str, Any] | list[Any] | None) -> str:
    if payload is None:
        return ""
    return json.dumps(payload, separators=(",", ":"), ensure_ascii=False)


def sign_request(
    secret: str,
    method: str,
    request_path: str,
    timestamp: str,
    nonce: str,
    body: str = "",
) -> str:
    """Create BloFin's Base64-encoded HMAC-SHA256 hexadecimal signature."""

    prehash = f"{request_path}{method.upper()}{timestamp}{nonce}{body}"
    hex_digest = hmac.new(secret.encode("utf-8"), prehash.encode("utf-8"), hashlib.sha256).hexdigest()
    return base64.b64encode(hex_digest.encode("ascii")).decode("ascii")


class BlofinClient:
    """Minimal asynchronous BloFin client with deterministic request signing."""

    def __init__(
        self,
        config: BlofinConfig,
        *,
        timeout_seconds: float = 8.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.config = config
        self.timeout_seconds = timeout_seconds
        self.transport = transport

    @staticmethod
    def _request_path(path: str, params: Mapping[str, Any] | None = None) -> str:
        filtered = {
            str(key): str(value)
            for key, value in (params or {}).items()
            if value is not None and str(value) != ""
        }
        if not filtered:
            return path
        return f"{path}?{urlencode(sorted(filtered.items()))}"

    def _auth_headers(self, method: str, request_path: str, body: str) -> dict[str, str]:
        self.config.require_credentials()
        timestamp = str(int(time.time() * 1000))
        nonce = str(uuid.uuid4())
        return {
            "ACCESS-KEY": self.config.api_key,
            "ACCESS-SIGN": sign_request(
                self.config.api_secret,
                method,
                request_path,
                timestamp,
                nonce,
                body,
            ),
            "ACCESS-TIMESTAMP": timestamp,
            "ACCESS-NONCE": nonce,
            "ACCESS-PASSPHRASE": self.config.passphrase,
        }

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: Mapping[str, Any] | None = None,
        payload: Mapping[str, Any] | list[Any] | None = None,
        authenticated: bool = False,
    ) -> dict[str, Any]:
        request_path = self._request_path(path, params)
        body = _compact_json(payload)
        headers = {"Accept": "application/json"}
        if body:
            headers["Content-Type"] = "application/json"
        if authenticated:
            headers.update(self._auth_headers(method, request_path, body))

        try:
            async with httpx.AsyncClient(
                base_url=self.config.base_url,
                timeout=httpx.Timeout(self.timeout_seconds),
                follow_redirects=False,
                trust_env=False,
                transport=self.transport,
            ) as client:
                response = await client.request(
                    method.upper(),
                    request_path,
                    headers=headers,
                    content=body.encode("utf-8") if body else None,
                )
        except httpx.TimeoutException as exc:
            raise BlofinAPIError("BloFin did not respond before the safety timeout.", status_code=504) from exc
        except httpx.HTTPError as exc:
            raise BlofinAPIError("BloFin could not be reached from this device.", status_code=502) from exc

        if response.status_code >= 400:
            raise BlofinAPIError(
                f"BloFin returned HTTP {response.status_code}.",
                status_code=502,
            )
        try:
            result = response.json()
        except ValueError as exc:
            raise BlofinAPIError("BloFin returned an unreadable response.") from exc
        if not isinstance(result, dict):
            raise BlofinAPIError("BloFin returned an unexpected response shape.")
        code = str(result.get("code", ""))
        if code != "0":
            message = str(result.get("msg") or "BloFin rejected the request.").strip()[:240]
            raise BlofinAPIError(message, api_code=code)
        return result

    async def instruments(self, inst_id: str | None = None) -> list[dict[str, Any]]:
        params = {"instId": normalize_instrument(inst_id)} if inst_id else None
        result = await self._request("GET", "/api/v1/market/instruments", params=params)
        return list(result.get("data") or [])

    async def ticker(self, inst_id: str = "BTC-USDT") -> dict[str, Any]:
        result = await self._request(
            "GET",
            "/api/v1/market/tickers",
            params={"instId": normalize_instrument(inst_id)},
        )
        data = result.get("data") or []
        if not data:
            raise BlofinAPIError("BloFin returned no ticker for that instrument.", status_code=404)
        return dict(data[0])

    async def mark_price(self, inst_id: str = "BTC-USDT") -> dict[str, Any]:
        result = await self._request(
            "GET",
            "/api/v1/market/mark-price",
            params={"instId": normalize_instrument(inst_id)},
        )
        data = result.get("data") or []
        return dict(data[0]) if data else {}

    async def funding_rate(self, inst_id: str = "BTC-USDT") -> dict[str, Any]:
        result = await self._request(
            "GET",
            "/api/v1/market/funding-rate",
            params={"instId": normalize_instrument(inst_id)},
        )
        data = result.get("data") or []
        return dict(data[0]) if data else {}

    async def candles(self, inst_id: str, *, bar: str = "15m", limit: int = 100) -> list[list[str]]:
        if bar not in SUPPORTED_BARS:
            raise ValueError(f"Unsupported candle bar: {bar}")
        safe_limit = max(1, min(int(limit), 500))
        result = await self._request(
            "GET",
            "/api/v1/market/candles",
            params={"instId": normalize_instrument(inst_id), "bar": bar, "limit": safe_limit},
        )
        return list(result.get("data") or [])

    async def account_config(self) -> dict[str, Any]:
        result = await self._request("GET", "/api/v1/account/config", authenticated=True)
        return dict(result.get("data") or {})

    async def api_key_info(self) -> dict[str, Any]:
        """Return the permissions attached to the currently configured key."""

        result = await self._request("GET", "/api/v1/user/query-apikey", authenticated=True)
        return dict(result.get("data") or {})

    async def balance(self) -> dict[str, Any]:
        result = await self._request("GET", "/api/v1/account/balance", authenticated=True)
        return dict(result.get("data") or {})

    async def positions(self, inst_id: str | None = None) -> list[dict[str, Any]]:
        params = {"instId": normalize_instrument(inst_id)} if inst_id else None
        result = await self._request(
            "GET", "/api/v1/account/positions", params=params, authenticated=True
        )
        return list(result.get("data") or [])

    async def pending_orders(self, inst_id: str | None = None, *, limit: int = 20) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"limit": max(1, min(int(limit), 100))}
        if inst_id:
            params["instId"] = normalize_instrument(inst_id)
        result = await self._request(
            "GET", "/api/v1/trade/orders-pending", params=params, authenticated=True
        )
        return list(result.get("data") or [])

    async def order_history(self, inst_id: str | None = None, *, limit: int = 20) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"limit": max(1, min(int(limit), 100))}
        if inst_id:
            params["instId"] = normalize_instrument(inst_id)
        result = await self._request(
            "GET", "/api/v1/trade/orders-history", params=params, authenticated=True
        )
        return list(result.get("data") or [])

    async def market_snapshot(self, inst_id: str = "BTC-USDT") -> dict[str, Any]:
        normalized = normalize_instrument(inst_id)
        ticker, mark, funding = await asyncio.gather(
            self.ticker(normalized),
            self.mark_price(normalized),
            self.funding_rate(normalized),
        )
        change_24h: str | None = None
        try:
            last = Decimal(str(ticker.get("last")))
            opened = Decimal(str(ticker.get("open24h")))
            if opened:
                change_24h = str(((last - opened) / opened * Decimal("100")).quantize(Decimal("0.01")))
        except (InvalidOperation, TypeError, ValueError):
            change_24h = None
        return {
            "instId": normalized,
            "last": ticker.get("last"),
            "bidPrice": ticker.get("bidPrice"),
            "askPrice": ticker.get("askPrice"),
            "high24h": ticker.get("high24h"),
            "low24h": ticker.get("low24h"),
            "volCurrency24h": ticker.get("volCurrency24h"),
            "change24hPct": change_24h,
            "markPrice": mark.get("markPrice"),
            "indexPrice": mark.get("indexPrice"),
            "fundingRate": funding.get("fundingRate"),
            "fundingTime": funding.get("fundingTime"),
            "ts": ticker.get("ts"),
            "source": "BloFin REST API",
            "environment": self.config.environment,
        }
