import { useState } from "react";
import { createPortal } from "react-dom";

function displayPrice(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: parsed >= 100 ? 2 : 6 }).format(parsed);
}

export default function BlofinPanel({ blofin, onRefresh, onConnect, onDisconnect }) {
  const [setupOpen, setSetupOpen] = useState(false);
  const [environment, setEnvironment] = useState("production");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  // The bridge loads asynchronously when Mission Control first mounts. Keep the
  // Vega console render-safe until the first status/snapshot response arrives.
  const bridge = blofin ?? {};
  const snapshot = bridge.snapshot ?? {};

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      await onConnect({ environment, apiKey, apiSecret, passphrase });
      setApiKey("");
      setApiSecret("");
      setPassphrase("");
      setSetupOpen(false);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect the encrypted BloFin account link? Public market data will remain available.")) return;
    try {
      await onDisconnect();
    } catch (error) {
      setFormError(error.message);
    }
  }

  const modal = setupOpen ? createPortal(
    <div className="blofin-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) setSetupOpen(false);
    }}>
      <form className="blofin-connect-modal" onSubmit={submit} autoComplete="off">
        <div className="blofin-modal-header">
          <div><span>BLOFIN SECURE LINK</span><h2>Connect Vega</h2></div>
          <button type="button" onClick={() => setSetupOpen(false)} aria-label="Close BloFin setup">×</button>
        </div>
        <p>Use the <strong>READ-only BloFin MCP</strong> key you created. JARVIS verifies it with BloFin, encrypts it locally, and keeps exchange order execution locked.</p>
        <label>Environment<select data-testid="blofin-environment" value={environment} onChange={(event) => setEnvironment(event.target.value)}><option value="production">Production · read-only account</option><option value="demo">Demo trading</option></select></label>
        <label>API key<input data-testid="blofin-api-key" required value={apiKey} onChange={(event) => setApiKey(event.target.value)} autoComplete="off" spellCheck="false" /></label>
        <label>Secret key<input data-testid="blofin-api-secret" required type="password" value={apiSecret} onChange={(event) => setApiSecret(event.target.value)} autoComplete="new-password" spellCheck="false" /></label>
        <label>Passphrase<input data-testid="blofin-passphrase" required type="password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} autoComplete="new-password" spellCheck="false" /></label>
        {formError && <div className="blofin-form-error" role="alert">{formError}</div>}
        <small>Enter these values only here on your Mac. They are tested with a signed READ request, encrypted by Odysseus, and never stored in this browser.</small>
        <div className="blofin-modal-actions"><button type="button" onClick={() => setSetupOpen(false)}>CANCEL</button><button type="submit" disabled={submitting}>{submitting ? "VERIFYING…" : "CONNECT MCP KEY"}</button></div>
      </form>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <section className={`blofin-strip bridge-${bridge.status || "loading"}`} aria-label="BloFin connection status">
        <div className="blofin-brand"><span>BLOFIN</span><strong>{bridge.connectionMode === "mcp" ? "MCP · " : ""}{String(bridge.environment || "demo").toUpperCase()}</strong></div>
        <div className="blofin-quote"><span>{snapshot.instId || "BTC-USDT"}</span><strong>{displayPrice(snapshot.last)}</strong><em className={Number(snapshot.change24hPct) >= 0 ? "up" : "down"}>{snapshot.change24hPct == null ? "MARKET LINK" : `${Number(snapshot.change24hPct) >= 0 ? "+" : ""}${snapshot.change24hPct}%`}</em></div>
        <div className="blofin-lock"><span>{bridge.credentialsConfigured ? "ACCOUNT LINKED" : "PUBLIC DATA"}</span><strong>EXECUTION LOCKED</strong></div>
        <div className="blofin-actions"><button type="button" onClick={onRefresh} title="Refresh BloFin">↻</button>{bridge.credentialsConfigured ? <button type="button" onClick={disconnect}>DISCONNECT</button> : <button type="button" onClick={() => setSetupOpen(true)}>CONNECT READ-ONLY</button>}</div>
      </section>
      {modal}
    </>
  );
}
