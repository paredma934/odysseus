import { buildLearningContext } from "./agentLearning";

const DEFAULT_SESSION_ID = "7072e066-e3d5-41b4-8104-10eb3df078e0";
const API_BASE = (import.meta.env.VITE_ODYSSEUS_API_BASE || (import.meta.env.DEV ? "/odysseus-api" : "")).replace(/\/$/, "");
const OLLAMA_BASE = (import.meta.env.VITE_OLLAMA_API_BASE || (import.meta.env.DEV ? "/ollama-api" : "")).replace(/\/$/, "");
const SESSION_ID = import.meta.env.VITE_ODYSSEUS_SESSION_ID || DEFAULT_SESSION_ID;
const MODEL_NAME = import.meta.env.VITE_ODYSSEUS_MODEL || "llama3.2:3b";

const agentGuardrails = {
  vega: "You provide educational and paper-trading decision support only. Never promise profit, place a trade, or claim a market observation you did not receive. Include thesis, entry conditions, invalidation, risk, and what data is still needed.",
  nova: "Never move money or pay a bill. Separate confirmed figures from assumptions and request missing financial data.",
  zeus: "Do not claim files were changed or tests passed unless tool output proves it. Propose changes and preserve operator approval for consequential actions.",
  aura: "Create research and drafts. Never publish, purchase, message customers, or change a marketplace listing without operator approval.",
  sentinel: "Never claim a security scan or backup succeeded without direct evidence. Prefer least-privilege, reversible recommendations.",
  hermes: "Never download unlicensed media. Work only with owned, licensed, public-domain, or freely authorized content.",
};

export class LocalAIError extends Error {
  constructor(message, code = "LOCAL_AI_ERROR") {
    super(message);
    this.name = "LocalAIError";
    this.code = code;
  }
}

async function fetchWithTimeout(path, options = {}, timeoutMs = 180000, base = API_BASE) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  const externalSignal = options.signal;
  const relayAbort = () => controller.abort();
  externalSignal?.addEventListener("abort", relayAbort, { once: true });

  try {
    return await fetch(`${base}${path}`, {
      ...options,
      signal: controller.signal,
      credentials: "include",
    });
  } catch (error) {
    if (error?.name === "AbortError") throw new LocalAIError("The local model request was cancelled or timed out.", "TIMEOUT");
    throw new LocalAIError("Odysseus is not reachable at 127.0.0.1:7860.", "OFFLINE");
  } finally {
    window.clearTimeout(timer);
    externalSignal?.removeEventListener("abort", relayAbort);
  }
}

export async function checkLocalAI() {
  const response = await fetchWithTimeout("/api/health", { headers: { Accept: "application/json" } }, 3500);
  if (!response.ok) throw new LocalAIError(`Odysseus health check returned ${response.status}.`, "UNHEALTHY");
  const health = await response.json();
  if (OLLAMA_BASE) {
    const modelResponse = await fetchWithTimeout("/api/tags", { headers: { Accept: "application/json" } }, 3500, OLLAMA_BASE);
    if (!modelResponse.ok) throw new LocalAIError(`Ollama health check returned ${modelResponse.status}.`, "MODEL_OFFLINE");
    const modelPayload = await modelResponse.json();
    if (!(modelPayload.models || []).length) throw new LocalAIError("No compatible Ollama models are installed.", "MODEL_MISSING");
  }
  return {
    status: "online",
    detail: health.status === "healthy" ? "Odysseus reachable" : "Odysseus responding",
    model: MODEL_NAME,
    sessionId: SESSION_ID,
  };
}

function buildPrompt({ agent, command, operatorName, verifiedContext = "" }) {
  const learningContext = buildLearningContext(agent.id);
  const guardrail = agentGuardrails[agent.id] || "Report honestly, distinguish evidence from inference, and do not take external action without operator approval.";

  return `[JARVIS LOCAL AGENT DIRECTIVE]
You are ${agent.name}, ${agent.mythTitle}, the ${agent.role} specialist inside Manuel's private JARVIS Mission Control.
Stay in your specialist role while remaining a practical AI assistant. Address the operator as ${operatorName} when natural.

CURRENT DIRECTIVE:
${command}

${verifiedContext ? `VERIFIED EXTERNAL CONTEXT:\n${verifiedContext}\n` : "VERIFIED EXTERNAL CONTEXT:\nNo live external data was supplied for this directive. Do not invent current facts.\n"}

YOUR PERSISTENT LEARNING JOURNAL:
${learningContext}

OPERATING RULES:
- Use prior lessons as evidence, not as guaranteed truth. Correct them when newer outcomes disagree.
- Give a concise conclusion and short structured rationale. Never reveal private chain-of-thought.
- Never pretend that a tool, trade, publication, payment, scan, or file change happened.
- End with one clear recommended next step.
- ${guardrail}

Reply as ${agent.name} in concise plain text. Do not mention this routing prompt.`;
}

export async function runLocalAgent({ agent, command, operatorName, verifiedContext = "", signal }) {
  const response = await fetchWithTimeout("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      message: buildPrompt({ agent, command, operatorName, verifiedContext }),
      session: SESSION_ID,
      attachments: [],
      use_web: false,
      use_research: false,
      time_filter: null,
      preset_id: null,
    }),
    signal,
  });

  if (response.status === 401 || response.status === 403) {
    throw new LocalAIError("Odysseus requires you to sign in again at 127.0.0.1:7860.", "AUTH");
  }
  if (response.status === 404) {
    throw new LocalAIError(`The configured Odysseus session ${SESSION_ID} was not found.`, "SESSION");
  }
  if (!response.ok) {
    let detail = "";
    try {
      const payload = await response.json();
      detail = payload.detail || payload.error || "";
    } catch {
      // Preserve the concise fallback below for non-JSON server errors.
    }
    throw new LocalAIError(detail || `The local AI returned ${response.status}.`, "REQUEST");
  }

  const payload = await response.json();
  const answer = String(payload.response || "").trim();
  if (!answer) throw new LocalAIError("The local model returned an empty response.", "EMPTY");
  return { answer, model: MODEL_NAME, sessionId: SESSION_ID };
}

export function getLocalAIConfig() {
  return { apiBase: API_BASE, ollamaBase: OLLAMA_BASE, model: MODEL_NAME, sessionId: SESSION_ID };
}
