import asyncio

import httpx

from src import ollama_model_router as router
from src.llm_core import _build_ollama_payload


MODELS = (
    "llama3.2:3b",
    "qwen2.5-coder:3b",
    "deepseek-r1:1.5b",
    "gemma2:2b",
)


def _messages(text: str):
    return [{"role": "user", "content": text}]


def setup_function():
    router.reset_router_state()


def test_routes_coding_to_specialized_coder():
    decision = router.select_model(
        "llama3.2:3b",
        _messages("Debug this React TypeScript exception and refactor the component."),
        MODELS,
    )
    assert decision.task_type == "coding"
    assert decision.selected_model == "qwen2.5-coder:3b"
    assert decision.num_ctx == 4096


def test_routes_planning_to_small_reasoning_model_without_exposing_thoughts():
    decision = router.select_model(
        "llama3.2:3b",
        _messages("Create a complex multi-step architecture plan and discuss trade-offs."),
        MODELS,
    )
    assert decision.task_type == "reasoning"
    assert decision.selected_model == "deepseek-r1:1.5b"
    assert decision.suppress_reasoning is True


def test_routes_general_and_short_requests_by_cost():
    short = router.select_model("llama3.2:3b", _messages("Summarize this."), MODELS)
    general = router.select_model(
        "llama3.2:3b",
        _messages("Please summarize the meeting notes and prepare a useful voice response for me."),
        MODELS,
    )
    assert (short.task_type, short.selected_model, short.num_ctx) == ("light", "gemma2:2b", 2048)
    assert (general.task_type, general.selected_model) == ("general", "llama3.2:3b")


def test_missing_preferred_model_falls_back_to_default():
    decision = router.select_model(
        "qwen2.5:3b",
        _messages("Fix this Python traceback."),
        ("llama3.2:3b", "gemma2:2b"),
    )
    assert decision.selected_model == "llama3.2:3b"
    assert decision.fallback is True
    assert "unavailable" in decision.reason


def test_missing_default_uses_first_compatible_installed_model():
    decision = router.select_model(
        "llama3.2:3b",
        _messages("Tell me about the project in a friendly and concise conversational response."),
        ("nomic-embed-text:latest", "mistral-small:latest"),
    )
    assert decision.selected_model == "mistral-small:latest"
    assert decision.fallback is True


def test_manual_non_managed_model_is_preserved():
    decision = router.select_model(
        "custom-model:latest",
        _messages("Debug this TypeScript code."),
        MODELS,
    )
    assert decision.task_type == "manual"
    assert decision.selected_model == "custom-model:latest"


def test_agent_directive_selects_agent_and_workload():
    decision = router.select_model(
        "llama3.2:3b",
        _messages("You are Zeus, the engineering specialist. Handle this request."),
        MODELS,
    )
    assert decision.agent == "zeus"
    assert decision.task_type == "coding"


def test_dynamic_discovery_uses_ollama_tags(monkeypatch):
    def fake_get(url, timeout):
        request = httpx.Request("GET", url)
        return httpx.Response(200, request=request, json={"models": [{"name": name} for name in MODELS]})

    monkeypatch.setattr(router.httpx, "get", fake_get)
    decision = router.route_sync("llama3.2:3b", _messages("Fix this terminal error."), "http://localhost:11434/v1")
    assert decision.selected_model == "qwen2.5-coder:3b"


def test_switch_unloads_previous_model(monkeypatch):
    calls = []

    def fake_post(url, json, timeout):
        calls.append((url, json))
        return httpx.Response(200, request=httpx.Request("POST", url), json={"done": True})

    monkeypatch.setattr(router.httpx, "post", fake_post)
    router.prepare_switch_sync("http://localhost:11434", "llama3.2:3b")
    router.prepare_switch_sync("http://localhost:11434", "qwen2.5-coder:3b")
    assert calls == [
        ("http://localhost:11434/api/generate", {"model": "llama3.2:3b", "keep_alive": 0})
    ]


def test_diagnostics_reports_missing_models(monkeypatch):
    async def fake_discover(_base_url, *, force=False, client=None):
        return ("llama3.2:3b",)

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def get(self, url, timeout):
            return httpx.Response(200, request=httpx.Request("GET", url), json={"models": []})

    monkeypatch.setattr(router, "discover_models_async", fake_discover)
    monkeypatch.setattr(router.httpx, "AsyncClient", FakeClient)
    status = asyncio.run(router.diagnostic_status())
    assert status["connected"] is True
    assert status["installed_models"] == ["llama3.2:3b"]
    assert "qwen2.5-coder:3b" in status["missing_recommended_models"]


def test_routed_ollama_payload_applies_memory_limits_and_private_reasoning():
    payload = _build_ollama_payload(
        "deepseek-r1:1.5b",
        _messages("Plan this."),
        temperature=0.2,
        max_tokens=100,
        num_ctx=4096,
        keep_alive="2m",
        suppress_reasoning=True,
    )
    assert payload["options"]["num_ctx"] == 4096
    assert payload["keep_alive"] == "2m"
    assert payload["think"] is False
