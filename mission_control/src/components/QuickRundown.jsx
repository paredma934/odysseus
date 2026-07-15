import { useEffect } from "react";
import AgentPortrait from "./AgentPortrait";

function buildTrace(logs, activeAgent, taskProgress) {
  const values = [10, ...logs.slice(-8).map((log, index) => {
    if (log.source === "YOU") return 34 + index * 2;
    if (log.source === "JARVIS") return 25 + index * 2.5;
    return 17 + index * 2;
  }), activeAgent ? Math.max(taskProgress, 12) : 12];
  const width = 600;
  const height = 150;
  const max = Math.max(100, ...values);
  return values.map((value, index) => `${(index / Math.max(1, values.length - 1)) * width},${height - (value / max) * (height - 20)}`).join(" ");
}

export default function QuickRundown({ agents, activeAgentId, currentTask, taskProgress, jarvisState, logs, localAI, agentLearning, onClose, onSelectAgent }) {
  const activeAgent = agents.find((agent) => agent.id === activeAgentId);
  const averageReadiness = Math.round(agents.reduce((total, agent) => total + agent.readiness, 0) / agents.length);
  const sessionCommands = logs.filter((log) => log.source === "YOU").length;
  const timestamp = new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date());
  const trace = buildTrace(logs, activeAgent, taskProgress);
  const lessonCount = Object.values(agentLearning).reduce((total, learning) => total + learning.lessons, 0);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <section className="quick-rundown operations-dashboard interactive" role="dialog" aria-modal="false" aria-labelledby="rundown-title">
      <div className="rundown-scan" aria-hidden="true" />
      <header className="rundown-head operations-head">
        <div><span className="eyebrow">J.A.R.V.I.S. // OPERATIONS</span><h2 id="rundown-title">MISSION CONTROL</h2><p>Real-time operational overview of this local JARVIS session.</p></div>
        <div className="rundown-head-actions"><time>{timestamp}</time><span>LOCAL SESSION TELEMETRY</span><button onClick={onClose}>RETURN TO HQ ×</button></div>
      </header>

      <div className="rundown-stats operations-stats">
        <div className="rundown-stat"><span>AGENT PROFILES</span><strong>{String(agents.length).padStart(2, "0")}</strong><small>CONFIGURED</small></div>
        <div className="rundown-stat"><span>ACTIVE DIRECTIVES</span><strong>{activeAgent ? "01" : "00"}</strong><small>THIS SESSION</small></div>
        <div className="rundown-stat"><span>SESSION COMMANDS</span><strong>{String(sessionCommands).padStart(2, "0")}</strong><small>OPERATOR INPUTS</small></div>
        <div className="rundown-stat"><span>PROFILE READINESS</span><strong>{averageReadiness}%</strong><small>CONFIGURED METRIC</small></div>
        <div className={`rundown-stat is-${localAI.status}`}><span>LIVE AGENT BRIDGE</span><strong>{localAI.status.toUpperCase()}</strong><small>{localAI.model}</small></div>
        <div className="rundown-stat"><span>ADAPTIVE MEMORY</span><strong>{String(lessonCount).padStart(2, "0")}</strong><small>VALIDATED LESSONS</small></div>
      </div>

      <div className="operations-main">
        <section className="operations-chart-panel">
          <div className="operations-panel-title"><div><span className="eyebrow">TASK ACTIVITY // SESSION</span><strong>{activeAgent ? currentTask : "Headquarters standing by"}</strong></div><em>{jarvisState.toUpperCase()}</em></div>
          <div className="operations-chart" aria-label="Session activity trace based on recent local events">
            <svg viewBox="0 0 600 150" preserveAspectRatio="none" role="img">
              <defs><linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#63e7ff" stopOpacity=".28" /><stop offset="1" stopColor="#63e7ff" stopOpacity="0" /></linearGradient></defs>
              {[30, 60, 90, 120].map((y) => <line key={y} x1="0" x2="600" y1={y} y2={y} className="operations-gridline" />)}
              <polygon points={`0,150 ${trace} 600,150`} fill="url(#activityFill)" />
              <polyline points={trace} className="operations-trace" />
            </svg>
            <div className="operations-axis"><span>BOOT</span><span>COMMANDS</span><span>AGENT ROUTING</span><span>NOW</span></div>
          </div>
          <div className="operations-assessment">
            <span>JARVIS ASSESSMENT</span>
            <strong>{activeAgent ? `${activeAgent.name.toUpperCase()} IS EXECUTING` : "ALL AGENT PROFILES ARE READY"}</strong>
            <p>{activeAgent ? currentTask : localAI.status === "online" ? "The private Odysseus model and persistent agent journals are ready for directives." : "Headquarters is ready; start Odysseus and Ollama to bring the local intelligence bridge online."}</p>
            <div><i style={{ width: `${activeAgent ? Math.max(taskProgress, 12) : averageReadiness}%` }} /></div>
          </div>
        </section>

        <aside className="operations-agent-status">
          <div className="operations-panel-title"><div><span className="eyebrow">AGENT STATUS</span><strong>{activeAgent ? "01 ACTIVE" : "ALL READY"}</strong></div></div>
          <div className="operations-agent-list">
            {agents.map((agent) => {
              const active = agent.id === activeAgentId;
              return (
                <button key={agent.id} style={{ "--agent-color": agent.color }} className={active ? "is-active" : ""} onClick={() => onSelectAgent(agent)}>
                  <AgentPortrait agent={agent} active={active} size="tiny" />
                  <span><strong>{agent.name}</strong><small>{agent.shortRole} · {agentLearning[agent.id]?.lessons ?? 0} lessons</small></span>
                  <em>{active ? "EXECUTING" : "READY"}</em>
                  <i>{active ? Math.max(taskProgress, 12) : agent.readiness}%</i>
                </button>
              );
            })}
          </div>
        </aside>
      </div>

      <section className="operations-directives" aria-label="Recent session directives">
        <div className="operations-panel-title"><div><span className="eyebrow">RECENT DIRECTIVES</span><strong>LOCAL MISSION FEED</strong></div></div>
        {logs.slice(-3).reverse().map((log) => (
          <div className="operations-directive-row" key={log.id}>
            <time>{log.time}</time>
            <strong style={{ color: log.color ?? "#77e8ff" }}>{log.source}</strong>
            <p>{log.message}</p>
            <span className={activeAgent && log.source === activeAgent.name.toUpperCase() ? "is-running" : ""}>{activeAgent && log.source === activeAgent.name.toUpperCase() ? "RUNNING" : "SESSION"}</span>
          </div>
        ))}
      </section>
    </section>
  );
}
