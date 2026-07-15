"""Memory-conscious model routing for the local JARVIS Ollama runtime.

This module is deliberately independent from sessions and authentication.  It
only chooses among an operator-controlled set of *local* Ollama models after
the normal Odysseus route has already resolved and authorized an endpoint.
Cloud providers and manually selected non-managed models are left untouched.
"""

from __future__ import annotations

import logging
import os
import re
import threading
import time
from dataclasses import asdict, dataclass
from typing import Any, Iterable, Mapping, Sequence
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_CACHE_TTL_SECONDS = 30.0
_DISCOVERY_TIMEOUT_SECONDS = 2.5
_cache_lock = threading.Lock()
_model_cache: dict[str, tuple[float, tuple[str, ...]]] = {}
_active_model: str | None = None
_last_decision: dict[str, Any] | None = None

_CODING_RE = re.compile(
    r"\b(code|coding|debug|debugging|bug|exception|traceback|stack trace|"
    r"refactor|react|typescript|javascript|python|pytest|terminal error|"
    r"compile|compiler|lint|function|class|api route|css|html|sql)\b",
    re.IGNORECASE,
)
_REASONING_RE = re.compile(
    r"\b(plan|planning|multi[- ]step|architecture|architect|design system|"
    r"root cause|difficult|complex|troubleshoot|troubleshooting|investigate|"
    r"strategy|trade[- ]off|reason through|analy[sz]e deeply)\b",
    re.IGNORECASE,
)
_AGENT_RE = re.compile(r"\byou are\s+([a-z][a-z0-9_-]{1,30})\b", re.IGNORECASE)
_INCOMPATIBLE_MODEL_RE = re.compile(r"(embed|embedding|nomic|bge-|minilm)", re.IGNORECASE)

_AGENT_TASKS = {
    "zeus": "coding",
    "atlas": "general",
    "echo": "general",
    "vega": "general",
    "nova": "general",
    "aura": "general",
    "sentinel": "reasoning",
    "hermes": "general",
}


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() not in {"0", "false", "no", "off"}


def _env_int(name: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        value = default
    return max(minimum, min(maximum, value))


@dataclass(frozen=True)
class RouterConfig:
    base_url: str
    default_model: str
    coder_model: str
    reasoning_model: str
    light_model: str
    keep_alive: str
    normal_num_ctx: int
    light_num_ctx: int
    low_memory_mode: bool
    enabled: bool
    force_managed_routing: bool
    unload_on_switch: bool

    @property
    def recommended_models(self) -> tuple[str, ...]:
        return (self.default_model, self.coder_model, self.reasoning_model, self.light_model)


def get_router_config(base_url: str | None = None) -> RouterConfig:
    return RouterConfig(
        base_url=normalize_ollama_base_url(base_url or os.getenv("OLLAMA_BASE_URL") or "http://localhost:11434"),
        default_model=os.getenv("JARVIS_DEFAULT_MODEL", "llama3.2:3b").strip() or "llama3.2:3b",
        coder_model=os.getenv("JARVIS_CODER_MODEL", "qwen2.5-coder:3b").strip() or "qwen2.5-coder:3b",
        reasoning_model=os.getenv("JARVIS_REASONING_MODEL", "deepseek-r1:1.5b").strip() or "deepseek-r1:1.5b",
        light_model=os.getenv("JARVIS_LIGHT_MODEL", "gemma2:2b").strip() or "gemma2:2b",
        keep_alive=os.getenv("OLLAMA_KEEP_ALIVE", "2m").strip() or "2m",
        normal_num_ctx=_env_int("OLLAMA_NUM_CTX", 4096, 512, 4096),
        light_num_ctx=_env_int("OLLAMA_LIGHT_NUM_CTX", 2048, 512, 2048),
        low_memory_mode=_env_bool("JARVIS_LOW_MEMORY_MODE", False),
        enabled=_env_bool("JARVIS_MODEL_ROUTING", True),
        force_managed_routing=_env_bool("JARVIS_MODEL_ROUTING_FORCE", False),
        unload_on_switch=_env_bool("OLLAMA_UNLOAD_ON_SWITCH", True),
    )


def normalize_ollama_base_url(url: str) -> str:
    value = (url or "http://localhost:11434").strip().rstrip("/")
    parsed = urlparse(value)
    if not parsed.scheme or not parsed.netloc:
        return "http://localhost:11434"
    return f"{parsed.scheme}://{parsed.netloc}"


def is_local_ollama_url(url: str) -> bool:
    parsed = urlparse(normalize_ollama_base_url(url))
    return (parsed.hostname or "").lower() in {"localhost", "127.0.0.1", "0.0.0.0", "::1", "host.docker.internal"}


def _extract_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return " ".join(
            str(block.get("text") or "")
            for block in content
            if isinstance(block, Mapping) and block.get("type") == "text"
        )
    return str(content or "")


def request_text(messages: Sequence[Mapping[str, Any]] | None) -> str:
    for message in reversed(messages or []):
        if isinstance(message, Mapping) and message.get("role") == "user":
            return _extract_text(message.get("content")).strip()
    return ""


def infer_agent(text: str) -> str:
    match = _AGENT_RE.search(text or "")
    if match:
        candidate = match.group(1).lower()
        if candidate in _AGENT_TASKS:
            return candidate
    lowered = (text or "").lower()
    for agent in _AGENT_TASKS:
        if re.search(rf"\b{re.escape(agent)}\b", lowered):
            return agent
    return "jarvis"


def classify_task(text: str, *, agent: str = "jarvis", low_memory_mode: bool = False) -> tuple[str, str]:
    clean = (text or "").strip()
    if _CODING_RE.search(clean) or _AGENT_TASKS.get(agent) == "coding":
        return "coding", "coding/debugging language or engineering agent selected"
    if _REASONING_RE.search(clean) or _AGENT_TASKS.get(agent) == "reasoning":
        return "reasoning", "planning, architecture, or difficult troubleshooting detected"
    word_count = len(re.findall(r"\b\w+\b", clean))
    if low_memory_mode:
        return "light", "low-memory mode enabled"
    if 0 < word_count <= _env_int("JARVIS_LIGHT_MAX_WORDS", 8, 1, 32):
        return "light", "simple short request"
    return "general", "general conversation, summary, command, or tool routing"


def _model_key(model: str) -> str:
    return (model or "").strip().lower()


def _find_installed(preferred: str, installed: Iterable[str]) -> str | None:
    models = [str(model).strip() for model in installed if str(model).strip()]
    preferred_key = _model_key(preferred)
    for model in models:
        if _model_key(model) == preferred_key:
            return model
    if ":" not in preferred_key:
        for model in models:
            if _model_key(model).split(":", 1)[0] == preferred_key:
                return model
    return None


def _compatible_models(installed: Iterable[str]) -> list[str]:
    return [model for model in installed if model and not _INCOMPATIBLE_MODEL_RE.search(model)]


def should_route_model(requested_model: str, config: RouterConfig) -> bool:
    if not config.enabled or not is_local_ollama_url(config.base_url):
        return False
    if config.force_managed_routing:
        return True
    managed = {_model_key(model) for model in config.recommended_models}
    managed.update({"qwen2.5:3b", "qwen3:4b-instruct"})
    key = _model_key(requested_model)
    return key in managed or (":" not in key and any(item.split(":", 1)[0] == key for item in managed))


@dataclass(frozen=True)
class RoutingDecision:
    requested_model: str
    selected_model: str
    task_type: str
    agent: str
    reason: str
    fallback: bool
    num_ctx: int
    keep_alive: str
    suppress_reasoning: bool


def select_model(
    requested_model: str,
    messages: Sequence[Mapping[str, Any]] | None,
    installed_models: Sequence[str],
    *,
    config: RouterConfig | None = None,
) -> RoutingDecision:
    cfg = config or get_router_config()
    text = request_text(messages)
    agent = infer_agent(text)
    task_type, reason = classify_task(text, agent=agent, low_memory_mode=cfg.low_memory_mode)
    preferred = {
        "coding": cfg.coder_model,
        "reasoning": cfg.reasoning_model,
        "light": cfg.light_model,
        "general": cfg.default_model,
    }[task_type]

    if not should_route_model(requested_model, cfg):
        decision = RoutingDecision(
            requested_model=requested_model,
            selected_model=requested_model,
            task_type="manual",
            agent=agent,
            reason="manual or non-managed model preserved",
            fallback=False,
            num_ctx=cfg.normal_num_ctx,
            keep_alive=cfg.keep_alive,
            suppress_reasoning=False,
        )
        record_decision(decision)
        return decision

    installed = _compatible_models(installed_models)
    selected = _find_installed(preferred, installed)
    fallback = selected is None
    if selected is None:
        fallback_order = (cfg.default_model, "qwen2.5:3b", requested_model, cfg.light_model, cfg.coder_model, cfg.reasoning_model)
        for candidate in fallback_order:
            selected = _find_installed(candidate, installed)
            if selected:
                break
    if selected is None:
        selected = installed[0] if installed else cfg.default_model
    if fallback:
        reason = f"{reason}; preferred {preferred} unavailable, using {selected}"

    decision = RoutingDecision(
        requested_model=requested_model,
        selected_model=selected,
        task_type=task_type,
        agent=agent,
        reason=reason,
        fallback=fallback,
        num_ctx=cfg.light_num_ctx if task_type == "light" else cfg.normal_num_ctx,
        keep_alive=cfg.keep_alive,
        suppress_reasoning=task_type == "reasoning",
    )
    record_decision(decision)
    return decision


def _parse_tags(payload: Any) -> tuple[str, ...]:
    if not isinstance(payload, Mapping):
        return ()
    found: list[str] = []
    for item in payload.get("models") or []:
        if not isinstance(item, Mapping):
            continue
        name = str(item.get("name") or item.get("model") or "").strip()
        if name and name not in found:
            found.append(name)
    return tuple(found)


def _cached_models(base_url: str) -> tuple[str, ...] | None:
    with _cache_lock:
        cached = _model_cache.get(base_url)
        if cached and time.monotonic() - cached[0] < _CACHE_TTL_SECONDS:
            return cached[1]
    return None


def _store_models(base_url: str, models: tuple[str, ...]) -> tuple[str, ...]:
    with _cache_lock:
        _model_cache[base_url] = (time.monotonic(), models)
    return models


def discover_models_sync(base_url: str, *, force: bool = False) -> tuple[str, ...]:
    base = normalize_ollama_base_url(base_url)
    if not force:
        cached = _cached_models(base)
        if cached is not None:
            return cached
    response = httpx.get(f"{base}/api/tags", timeout=_DISCOVERY_TIMEOUT_SECONDS)
    response.raise_for_status()
    return _store_models(base, _parse_tags(response.json()))


async def discover_models_async(base_url: str, *, force: bool = False, client: httpx.AsyncClient | None = None) -> tuple[str, ...]:
    base = normalize_ollama_base_url(base_url)
    if not force:
        cached = _cached_models(base)
        if cached is not None:
            return cached
    owns_client = client is None
    http_client = client or httpx.AsyncClient()
    try:
        response = await http_client.get(f"{base}/api/tags", timeout=_DISCOVERY_TIMEOUT_SECONDS)
        response.raise_for_status()
        return _store_models(base, _parse_tags(response.json()))
    finally:
        if owns_client:
            await http_client.aclose()


def route_sync(requested_model: str, messages: Sequence[Mapping[str, Any]] | None, base_url: str) -> RoutingDecision:
    cfg = get_router_config(base_url)
    if not should_route_model(requested_model, cfg):
        return select_model(requested_model, messages, (), config=cfg)
    try:
        installed = discover_models_sync(cfg.base_url)
    except Exception as exc:
        installed = ()
        logger.warning("[jarvis-router] model discovery failed base=%s error=%s", cfg.base_url, type(exc).__name__)
    return select_model(requested_model, messages, installed, config=cfg)


async def route_async(requested_model: str, messages: Sequence[Mapping[str, Any]] | None, base_url: str) -> RoutingDecision:
    cfg = get_router_config(base_url)
    if not should_route_model(requested_model, cfg):
        return select_model(requested_model, messages, (), config=cfg)
    try:
        installed = await discover_models_async(cfg.base_url)
    except Exception as exc:
        installed = ()
        logger.warning("[jarvis-router] model discovery failed base=%s error=%s", cfg.base_url, type(exc).__name__)
    return select_model(requested_model, messages, installed, config=cfg)


def record_decision(decision: RoutingDecision) -> None:
    global _last_decision
    _last_decision = {**asdict(decision), "timestamp": time.time()}
    level = logging.WARNING if decision.fallback else logging.INFO
    logger.log(
        level,
        "[jarvis-router] agent=%s task=%s requested=%s selected=%s fallback=%s reason=%s",
        decision.agent,
        decision.task_type,
        decision.requested_model,
        decision.selected_model,
        decision.fallback,
        decision.reason,
    )


def _previous_model(next_model: str, config: RouterConfig) -> str | None:
    global _active_model
    previous = _active_model
    _active_model = next_model
    if not config.unload_on_switch or not previous or previous == next_model:
        return None
    return previous


def prepare_switch_sync(base_url: str, next_model: str) -> None:
    cfg = get_router_config(base_url)
    previous = _previous_model(next_model, cfg)
    if not previous:
        return
    try:
        httpx.post(f"{cfg.base_url}/api/generate", json={"model": previous, "keep_alive": 0}, timeout=_DISCOVERY_TIMEOUT_SECONDS).raise_for_status()
        logger.info("[jarvis-router] unloaded previous model=%s before loading=%s", previous, next_model)
    except Exception as exc:
        logger.warning("[jarvis-router] could not unload previous model=%s error=%s", previous, type(exc).__name__)


async def prepare_switch_async(base_url: str, next_model: str, client: httpx.AsyncClient | None = None) -> None:
    cfg = get_router_config(base_url)
    previous = _previous_model(next_model, cfg)
    if not previous:
        return
    owns_client = client is None
    http_client = client or httpx.AsyncClient()
    try:
        response = await http_client.post(f"{cfg.base_url}/api/generate", json={"model": previous, "keep_alive": 0}, timeout=_DISCOVERY_TIMEOUT_SECONDS)
        response.raise_for_status()
        logger.info("[jarvis-router] unloaded previous model=%s before loading=%s", previous, next_model)
    except Exception as exc:
        logger.warning("[jarvis-router] could not unload previous model=%s error=%s", previous, type(exc).__name__)
    finally:
        if owns_client:
            await http_client.aclose()


async def diagnostic_status(base_url: str | None = None) -> dict[str, Any]:
    cfg = get_router_config(base_url)
    installed: tuple[str, ...] = ()
    running: list[str] = []
    error = ""
    running_error = ""
    try:
        installed = await discover_models_async(cfg.base_url, force=True)
    except Exception as exc:
        error = f"{type(exc).__name__}: {exc}"
    if not error:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{cfg.base_url}/api/ps", timeout=_DISCOVERY_TIMEOUT_SECONDS)
                if response.is_success:
                    payload = response.json()
                    running = [str(item.get("name") or item.get("model")) for item in payload.get("models") or [] if isinstance(item, Mapping)]
                else:
                    running_error = f"HTTP {response.status_code}"
        except Exception as exc:
            running_error = f"{type(exc).__name__}: {exc}"
    missing = [model for model in cfg.recommended_models if _find_installed(model, installed) is None]
    return {
        "connected": not error,
        "base_url": cfg.base_url,
        "installed_models": list(installed),
        "running_models": running,
        "active_model": _active_model,
        "defaults": {
            "conversation": cfg.default_model,
            "coding": cfg.coder_model,
            "reasoning": cfg.reasoning_model,
            "light": cfg.light_model,
        },
        "missing_recommended_models": missing,
        "configuration": {
            "keep_alive": cfg.keep_alive,
            "normal_num_ctx": cfg.normal_num_ctx,
            "light_num_ctx": cfg.light_num_ctx,
            "low_memory_mode": cfg.low_memory_mode,
            "unload_on_switch": cfg.unload_on_switch,
        },
        "last_decision": _last_decision,
        "error": error or None,
        "running_models_error": running_error or None,
    }


def reset_router_state() -> None:
    """Clear process-local state for tests and controlled reloads."""
    global _active_model, _last_decision
    with _cache_lock:
        _model_cache.clear()
    _active_model = None
    _last_decision = None
