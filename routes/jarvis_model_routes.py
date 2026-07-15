"""Authenticated diagnostics for the local JARVIS Ollama router."""

from fastapi import APIRouter

from src.ollama_model_router import diagnostic_status


def setup_jarvis_model_routes() -> APIRouter:
    router = APIRouter()

    @router.get("/api/jarvis/models/health")
    async def jarvis_model_health():
        return await diagnostic_status()

    return router
