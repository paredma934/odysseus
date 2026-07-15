const API_BASE = (import.meta.env.VITE_ODYSSEUS_API_BASE || "/odysseus-api").replace(/\/$/, "");

export class BlofinBridgeError extends Error {
  constructor(message, code = "BLOFIN_ERROR") {
    super(message);
    this.name = "BlofinBridgeError";
    this.code = code;
  }
}

async function request(path, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
    let payload = {};
    try {
      payload = await response.json();
    } catch {
      // The controlled fallback below is safer than exposing an HTML response.
    }
    if (!response.ok) {
      const detail = payload.detail || payload.message || `BloFin bridge returned ${response.status}.`;
      throw new BlofinBridgeError(detail, response.status === 409 ? "NOT_CONNECTED" : "REQUEST");
    }
    return payload;
  } catch (error) {
    if (error instanceof BlofinBridgeError) throw error;
    if (error?.name === "AbortError") throw new BlofinBridgeError("BloFin bridge timed out.", "TIMEOUT");
    throw new BlofinBridgeError("The BloFin bridge is unavailable until Odysseus restarts.", "OFFLINE");
  } finally {
    window.clearTimeout(timer);
  }
}

export function getBlofinStatus() {
  return request("/api/blofin/status", {}, 5000);
}

export function getBlofinSnapshot(instId = "BTC-USDT") {
  return request(`/api/blofin/market/snapshot?instId=${encodeURIComponent(instId)}`);
}

export function getBlofinAccountOverview() {
  return request("/api/blofin/account/overview");
}

export function connectBlofinCredentials({ environment, apiKey, apiSecret, passphrase }) {
  return request("/api/blofin/credentials", {
    method: "POST",
    body: JSON.stringify({
      environment,
      api_key: apiKey,
      api_secret: apiSecret,
      passphrase,
    }),
  });
}

export function disconnectBlofinCredentials() {
  return request("/api/blofin/credentials", { method: "DELETE" });
}

export function formatBlofinVegaContext(snapshot) {
  if (!snapshot?.instId || !snapshot?.last) return "";
  return [
    `Source: ${snapshot.source || "BloFin REST API"}`,
    `Environment: ${String(snapshot.environment || "demo").toUpperCase()}`,
    `Instrument: ${snapshot.instId}`,
    `Last: ${snapshot.last}`,
    `Bid / Ask: ${snapshot.bidPrice || "unknown"} / ${snapshot.askPrice || "unknown"}`,
    `24h High / Low: ${snapshot.high24h || "unknown"} / ${snapshot.low24h || "unknown"}`,
    `24h Change: ${snapshot.change24hPct ?? "unknown"}%`,
    `Mark / Index: ${snapshot.markPrice || "unknown"} / ${snapshot.indexPrice || "unknown"}`,
    `Funding rate: ${snapshot.fundingRate || "unknown"}`,
    `Exchange timestamp: ${snapshot.ts || "unknown"}`,
    "Execution state: LOCKED. This data is for analysis and paper planning only.",
  ].join("\n");
}

