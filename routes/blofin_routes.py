"""BloFin integration routes for Vega and JARVIS Mission Control.

Only public market reads and authenticated READ operations are exposed.  This
router deliberately has no exchange order-placement endpoint.
"""

from __future__ import annotations

import asyncio
import os
from decimal import Decimal, InvalidOperation
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field, SecretStr

from src.blofin_client import (
    BlofinAPIError,
    BlofinClient,
    BlofinConfig,
    BlofinConfigurationError,
    normalize_instrument,
)
from src.auth_helpers import require_user
from src.blofin_credentials import BlofinCredentialStore


class BlofinCredentialsInput(BaseModel):
    environment: Literal["demo", "production"] = "demo"
    api_key: SecretStr = Field(min_length=1, max_length=256)
    api_secret: SecretStr = Field(min_length=1, max_length=256)
    passphrase: SecretStr = Field(min_length=1, max_length=256)


class BlofinOrderPlanInput(BaseModel):
    inst_id: str = "BTC-USDT"
    side: Literal["buy", "sell"]
    order_type: Literal["market", "limit", "post_only", "fok", "ioc"] = "limit"
    size: Decimal = Field(gt=0)
    price: Decimal | None = Field(default=None, gt=0)
    margin_mode: Literal["cross", "isolated"] = "isolated"
    position_side: Literal["net", "long", "short"] = "net"
    leverage: Decimal = Field(default=Decimal("1"), ge=1)
    reduce_only: bool = False
    stop_loss: Decimal | None = Field(default=None, gt=0)
    take_profit: Decimal | None = Field(default=None, gt=0)


def _client(store: BlofinCredentialStore) -> BlofinClient:
    return BlofinClient(store.load())


def _http_error(error: Exception) -> HTTPException:
    if isinstance(error, BlofinConfigurationError):
        return HTTPException(status_code=409, detail=str(error))
    if isinstance(error, BlofinAPIError):
        return HTTPException(status_code=error.status_code, detail=str(error))
    if isinstance(error, (ValueError, InvalidOperation)):
        return HTTPException(status_code=400, detail=str(error))
    return HTTPException(status_code=502, detail="BloFin integration request failed safely.")


def setup_blofin_routes(store: BlofinCredentialStore | None = None) -> APIRouter:
    router = APIRouter(prefix="/api/blofin", tags=["blofin"])
    credential_store = store or BlofinCredentialStore()

    @router.get("/status")
    async def status(request: Request):
        require_user(request)
        return credential_store.status()

    @router.post("/credentials")
    async def connect_credentials(payload: BlofinCredentialsInput, request: Request):
        require_user(request)
        current = credential_store.load()
        if current.source == "environment":
            raise HTTPException(
                status_code=409,
                detail="BloFin credentials are managed by server environment variables.",
            )
        candidate = BlofinConfig(
            environment=payload.environment,
            api_key=payload.api_key.get_secret_value().strip(),
            api_secret=payload.api_secret.get_secret_value().strip(),
            passphrase=payload.passphrase.get_secret_value().strip(),
            source="encrypted_store",
        )
        try:
            # Verify both authentication and the actual server-side permission
            # before anything is persisted. BloFin reports 1 for READ-only and
            # 0 for a key that can also write/trade. Key type 2 is the official
            # BloFin MCP key; type 1 is a direct Transaction API key.
            client = BlofinClient(candidate)
            key_info = await client.api_key_info()
            try:
                is_read_only = int(key_info.get("readOnly")) == 1
                key_type = int(key_info.get("type"))
            except (TypeError, ValueError):
                is_read_only = False
                key_type = 0
            if not is_read_only:
                raise ValueError(
                    "JARVIS only accepts a BloFin READ-only key. Disable TRADE and TRANSFER, then create a new key."
                )
            if key_type not in {1, 2}:
                raise ValueError("BloFin returned an unsupported API key type.")
            await client.account_config()
            candidate = BlofinConfig(
                environment=candidate.environment,
                api_key=candidate.api_key,
                api_secret=candidate.api_secret,
                passphrase=candidate.passphrase,
                key_type=key_type,
                source=candidate.source,
            )
            credential_store.save(candidate)
        except Exception as error:
            raise _http_error(error) from error
        return credential_store.status()

    @router.delete("/credentials")
    async def disconnect_credentials(request: Request):
        require_user(request)
        if credential_store.load().source == "environment":
            raise HTTPException(
                status_code=409,
                detail="Remove BloFin credentials from the server environment to disconnect.",
            )
        credential_store.clear()
        return credential_store.status()

    @router.get("/market/snapshot")
    async def market_snapshot(
        request: Request,
        inst_id: str = Query(default="BTC-USDT", alias="instId", max_length=40),
    ):
        require_user(request)
        try:
            return await _client(credential_store).market_snapshot(inst_id)
        except Exception as error:
            raise _http_error(error) from error

    @router.get("/market/candles")
    async def market_candles(
        request: Request,
        inst_id: str = Query(default="BTC-USDT", alias="instId", max_length=40),
        bar: str = Query(default="15m", max_length=4),
        limit: int = Query(default=100, ge=1, le=500),
    ):
        require_user(request)
        try:
            data = await _client(credential_store).candles(inst_id, bar=bar, limit=limit)
            return {"instId": normalize_instrument(inst_id), "bar": bar, "data": data}
        except Exception as error:
            raise _http_error(error) from error

    @router.get("/account/overview")
    async def account_overview(request: Request):
        require_user(request)
        client = _client(credential_store)
        try:
            balance, positions, pending = await asyncio.gather(
                client.balance(),
                client.positions(),
                client.pending_orders(limit=20),
            )
            return {
                "environment": client.config.environment,
                "readOnly": True,
                "balance": balance,
                "positions": positions,
                "pendingOrders": pending,
                "execution": "locked",
            }
        except Exception as error:
            raise _http_error(error) from error

    @router.get("/orders/history")
    async def order_history(
        request: Request,
        inst_id: str | None = Query(default=None, alias="instId", max_length=40),
        limit: int = Query(default=20, ge=1, le=100),
    ):
        require_user(request)
        try:
            orders = await _client(credential_store).order_history(inst_id, limit=limit)
            return {"orders": orders, "readOnly": True}
        except Exception as error:
            raise _http_error(error) from error

    @router.post("/order-plans/validate")
    async def validate_order_plan(payload: BlofinOrderPlanInput, request: Request):
        """Validate a paper/demo plan. This never submits anything to BloFin."""

        require_user(request)
        client = _client(credential_store)
        try:
            inst_id = normalize_instrument(payload.inst_id)
            instruments, ticker = await asyncio.gather(
                client.instruments(inst_id),
                client.ticker(inst_id),
            )
            if not instruments:
                raise ValueError("BloFin did not return contract details for that instrument.")
            instrument = instruments[0]
            contract_value = Decimal(str(instrument.get("contractValue") or "0"))
            min_size = Decimal(str(instrument.get("minSize") or "0"))
            lot_size = Decimal(str(instrument.get("lotSize") or "0"))
            reference_price = payload.price or Decimal(str(ticker.get("last") or "0"))
            notional = payload.size * contract_value * reference_price
            max_notional = Decimal(os.getenv("BLOFIN_MAX_PAPER_NOTIONAL_USDT", "50"))
            max_leverage = Decimal(os.getenv("BLOFIN_MAX_PAPER_LEVERAGE", "3"))
            violations: list[str] = []
            warnings: list[str] = []

            if payload.order_type != "market" and payload.price is None:
                violations.append("A price is required for non-market orders.")
            if payload.size < min_size:
                violations.append(f"Size is below BloFin's minimum of {min_size} contracts.")
            if lot_size and payload.size % lot_size:
                violations.append(f"Size must use BloFin's {lot_size}-contract increment.")
            if notional > max_notional:
                violations.append(f"Estimated notional exceeds the local {max_notional} USDT paper limit.")
            if payload.leverage > max_leverage:
                violations.append(f"Leverage exceeds the local {max_leverage}x paper limit.")
            if not payload.reduce_only and payload.stop_loss is None:
                violations.append("Opening plans require a defined stop-loss before approval.")
            if payload.stop_loss is not None:
                if payload.side == "buy" and payload.stop_loss >= reference_price:
                    violations.append("A buy plan stop-loss must be below the entry/reference price.")
                if payload.side == "sell" and payload.stop_loss <= reference_price:
                    violations.append("A sell plan stop-loss must be above the entry/reference price.")
            if payload.take_profit is None:
                warnings.append("No take-profit target is defined.")

            estimated_risk = None
            if payload.stop_loss is not None:
                estimated_risk = payload.size * contract_value * abs(reference_price - payload.stop_loss)

            return {
                "valid": not violations,
                "submissionPerformed": False,
                "execution": "locked",
                "environment": client.config.environment,
                "plan": {
                    "instId": inst_id,
                    "side": payload.side,
                    "orderType": payload.order_type,
                    "sizeContracts": str(payload.size),
                    "referencePrice": str(reference_price),
                    "marginMode": payload.margin_mode,
                    "positionSide": payload.position_side,
                    "leverage": str(payload.leverage),
                    "reduceOnly": payload.reduce_only,
                    "stopLoss": str(payload.stop_loss) if payload.stop_loss is not None else None,
                    "takeProfit": str(payload.take_profit) if payload.take_profit is not None else None,
                },
                "risk": {
                    "contractValue": str(contract_value),
                    "estimatedNotionalUsdt": str(notional.quantize(Decimal("0.01"))),
                    "estimatedStopRiskUsdt": (
                        str(estimated_risk.quantize(Decimal("0.01"))) if estimated_risk is not None else None
                    ),
                    "maxLocalNotionalUsdt": str(max_notional),
                    "maxLocalLeverage": str(max_leverage),
                },
                "violations": violations,
                "warnings": warnings,
                "nextStep": (
                    "Plan passed local paper-risk checks. It was not submitted."
                    if not violations
                    else "Correct every violation before considering a demo order."
                ),
            }
        except Exception as error:
            raise _http_error(error) from error

    return router
