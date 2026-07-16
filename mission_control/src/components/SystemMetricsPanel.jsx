import useSystemMetrics from "../hooks/useSystemMetrics";

function Metric({ label, value, detail, status = "normal" }) {
  return <div className={`system-metric metric-${status}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small><i /></div>;
}

export default function SystemMetricsPanel({ localAI, activeAgentId, agentCount, voiceStatus }) {
  const metrics = useSystemMetrics();
  const micValue = voiceStatus.active ? "LIVE" : voiceStatus.enabled ? "ARMED" : "OFF";
  const micStatus = voiceStatus.error ? "warning" : voiceStatus.active ? "online" : "normal";
  return (
    <section className="system-metrics interactive" aria-label="Local system telemetry">
      <div className="system-metrics-title"><span>SYSTEM TELEMETRY</span><small>LOCAL SESSION</small></div>
      <Metric label="CPU" value={`${metrics.cpu}%`} detail={`${metrics.cores} CORES`} />
      <Metric label="MEMORY" value={`${metrics.memory}%`} detail="BROWSER" status={metrics.memory > 75 ? "warning" : "normal"} />
      <Metric label="NETWORK" value={metrics.network} detail="LOCAL LINK" status={metrics.network === "OFFLINE" ? "warning" : "online"} />
      <Metric label="ODYSSEUS" value={localAI.status.toUpperCase()} detail={localAI.model} status={localAI.status === "online" ? "online" : "warning"} />
      <Metric label="AGENTS" value={`${activeAgentId ? "01" : "00"}/${String(agentCount).padStart(2, "0")}`} detail={activeAgentId ? activeAgentId.toUpperCase() : "STANDBY"} status={activeAgentId ? "online" : "normal"} />
      <Metric label="MICROPHONE" value={micValue} detail={voiceStatus.engine.toUpperCase()} status={micStatus} />
    </section>
  );
}
