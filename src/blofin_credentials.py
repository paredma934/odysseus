"""Encrypted, server-only credential storage for the BloFin connector."""

from __future__ import annotations

import json
import os
from pathlib import Path

from core.constants import DATA_DIR
from core.platform_compat import safe_chmod
from src.blofin_client import BlofinConfig
from src.secret_storage import decrypt, encrypt


class BlofinCredentialStore:
    def __init__(self, path: str | Path | None = None) -> None:
        self.path = Path(path) if path else Path(DATA_DIR) / "blofin_credentials.json"

    @staticmethod
    def _env_config() -> BlofinConfig | None:
        values = {
            "api_key": os.getenv("BLOFIN_API_KEY", "").strip(),
            "api_secret": os.getenv("BLOFIN_API_SECRET", "").strip(),
            "passphrase": os.getenv("BLOFIN_PASSPHRASE", "").strip(),
        }
        if not any(values.values()):
            return None
        raw_key_type = os.getenv("BLOFIN_API_KEY_TYPE", "").strip()
        key_type = int(raw_key_type) if raw_key_type in {"1", "2"} else None
        return BlofinConfig(
            environment=os.getenv("BLOFIN_ENV", "demo"),
            key_type=key_type,
            source="environment",
            **values,
        )

    def load(self) -> BlofinConfig:
        env_config = self._env_config()
        if env_config is not None:
            return env_config
        if not self.path.exists():
            return BlofinConfig(environment=os.getenv("BLOFIN_ENV", "demo"), source="unconfigured")
        try:
            payload = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return BlofinConfig(environment=os.getenv("BLOFIN_ENV", "demo"), source="unconfigured")
        if not isinstance(payload, dict):
            return BlofinConfig(environment=os.getenv("BLOFIN_ENV", "demo"), source="unconfigured")
        return BlofinConfig(
            environment=str(payload.get("environment") or "demo"),
            api_key=decrypt(str(payload.get("api_key") or "")),
            api_secret=decrypt(str(payload.get("api_secret") or "")),
            passphrase=decrypt(str(payload.get("passphrase") or "")),
            key_type=(
                int(payload["key_type"])
                if str(payload.get("key_type") or "") in {"1", "2"}
                else None
            ),
            source="encrypted_store",
        )

    def save(self, config: BlofinConfig) -> None:
        if not config.credentials_configured:
            raise ValueError("A complete API key, secret, and passphrase are required.")
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "version": 2,
            "environment": config.environment,
            "key_type": config.key_type,
            "api_key": encrypt(config.api_key),
            "api_secret": encrypt(config.api_secret),
            "passphrase": encrypt(config.passphrase),
        }
        temporary = self.path.with_suffix(self.path.suffix + ".tmp")
        temporary.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
        safe_chmod(temporary, 0o600)
        os.replace(temporary, self.path)
        safe_chmod(self.path, 0o600)

    def clear(self) -> None:
        try:
            self.path.unlink()
        except FileNotFoundError:
            pass

    def status(self) -> dict[str, object]:
        config = self.load()
        return {
            "environment": config.environment,
            "baseUrl": config.base_url,
            "credentialsConfigured": config.credentials_configured,
            "credentialSource": config.source,
            "connectionMode": config.connection_mode,
            "readOnly": True,
            "execution": "locked",
            "liveTradingEnabled": False,
            "message": (
                (
                    "READ-only BloFin MCP account link connected. Order execution remains locked."
                    if config.connection_mode == "mcp"
                    else "READ-only BloFin account link connected. Order execution remains locked."
                )
                if config.credentials_configured
                else "Public market data is available. Add a READ-only BloFin MCP key for balances and positions."
            ),
        }
