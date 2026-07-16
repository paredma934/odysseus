import { useEffect, useRef, useState } from "react";
import AgentPortrait from "./AgentPortrait";
import QuickRundown from "./QuickRundown";
import BlofinPanel from "./BlofinPanel";
import SystemMetricsPanel from "./SystemMetricsPanel";
import { JARVIS_STATE_LABELS } from "../state/jarvisStates";

const missionPhases = [
  ["COMMAND RECEIVED", 12],
  ["AGENT ROUTED", 52],
  ["TASK EXECUTING", 78],
  ["REPORT PREPARED", 100],
];

export default function HudOverlay({ mode, agents, selectedAgent, focusedAgentId, activeAgentId, jarvisState, currentTask, taskProgress, logs, voiceEnabled, voiceName, voiceStatus, operatorName, rundownOpen, localAI, blofin, agentLearning, onRundown, onCloseRundown, onToggleVoice, onModeChange, onClearFocus, onSelectAgent, onRunAgent, onRefreshBlofin, onConnectBlofin, onDisconnectBlofin }) {
  const selectedActive = selectedAgent.id === activeAgentId;
  const selectedFocused = selectedAgent.id === focusedAgentId;
  const displayProgress = selectedActive ? Math.max(taskProgress, 12) : selectedAgent.readiness;
  const selectedLearning = agentLearning[selectedAgent.id] ?? { runs: 0, lessons: 0, winRate: null };
  const [mobileIntelOpen, setMobileIntelOpen] = useState(false);
  const previousSelectedAgent = useRef(selectedAgent.id);

  useEffect(() => {
    if (previousSelectedAgent.current !== selectedAgent.id) {
      setMobileIntelOpen(true);
      previousSelectedAgent.current = selectedAgent.id;
    }
  }, [selectedAgent.id]);

  function inspectAgent(agent) {
    onSelectAgent(agent);
    setMobileIntelOpen(true);
  }

  return (
    <div className="hud-layer">
      <header className="mission-header interactive">
        <div className="brand-lockup">
          <span className="brand-mark"><i /> ODYSSEUS</span>
          <strong>J.A.R.V.I.S.</strong>
          <small>PERSONAL AI OPERATIONS SYSTEM // OPERATOR {operatorName.toUpperCase()}</small>
        </div>
        <div className={`core-status core-dial ${jarvisState}`} aria-live="polite">
          <i className={`status-orb ${jarvisState}`} />
          <span>{JARVIS_STATE_LABELS[jarvisState] ?? jarvisState.toUpperCase()}</span>
          <small title={`${voiceName} · ${localAI.detail}`}>{activeAgentId ? `ROUTING TO ${activeAgentId.toUpperCase()}` : `LOCAL AI ${localAI.status.toUpperCase()} // ${localAI.model}`}</small>
        </div>
        <nav className="header-actions" aria-label="Mission Control views">
          <button aria-label="Operations overview" data-short="OPS" className={rundownOpen ? "is-active" : ""} onClick={onRundown}>OPERATIONS</button>
          <button aria-label="Agent Headquarters" data-short="HQ" className={mode === "headquarters" && !rundownOpen ? "is-active" : ""} onClick={() => onModeChange("headquarters")}>HEADQUARTERS</button>
          <button aria-label="Particle Earth" data-short="EARTH" className={mode === "earth" ? "is-active" : ""} onClick={() => onModeChange("earth")}>PARTICLE EARTH</button>
          {localAI.status === "auth-required" && <button aria-label="Sign in to Odysseus" data-short="SIGN IN" className="is-active" onClick={() => window.location.assign("/odysseus-api/login")}>SIGN IN</button>}
          <button aria-label={voiceEnabled ? "Mute JARVIS voice" : "Enable JARVIS voice"} data-short={voiceEnabled ? "VOICE ON" : "MUTED"} className={`voice-toggle ${voiceEnabled ? "voice-on" : ""}`} onClick={onToggleVoice} title={`British male voice profile: ${voiceName}`}>VOICE {voiceEnabled ? "ON" : "MUTED"}</button>
        </nav>
      </header>

      {!rundownOpen && mode === "headquarters" && <SystemMetricsPanel localAI={localAI} activeAgentId={activeAgentId} agentCount={agents.length} voiceStatus={voiceStatus} />}

      {mode === "headquarters" && rundownOpen && (
        <QuickRundown
          agents={agents}
          activeAgentId={activeAgentId}
          currentTask={currentTask}
          taskProgress={taskProgress}
          jarvisState={jarvisState}
          logs={logs}
          localAI={localAI}
          agentLearning={agentLearning}
          onClose={onCloseRundown}
          onSelectAgent={onSelectAgent}
        />
      )}

      {mode === "world" && !rundownOpen && (
        <>
          <section className="agent-grid interactive" aria-label="JARVIS agent roster">
            {agents.map((agent) => {
              const active = agent.id === activeAgentId;
              const selected = agent.id === selectedAgent.id;
              return (
                <button
                  key={agent.id}
                  className={`agent-touch-card ${selected ? "is-selected" : ""} ${active ? "is-active" : ""}`}
                  style={{ "--agent-color": agent.color }}
                  onClick={() => inspectAgent(agent)}
                  aria-label={`${agent.name}, ${agent.role}, ${active ? "executing" : "ready"}`}
                >
                  <AgentPortrait agent={agent} active={active} selected={selected} size="small" />
                  <span className="agent-card-copy"><strong>{agent.name}</strong><small>{agent.mythTitle}</small><em>{agent.shortRole} · {agent.floor}</em></span>
                  <span className="agent-card-state">{active ? "EXECUTING" : "READY"}</span>
                  <i />
                </button>
              );
            })}
          </section>

          <aside className={`agent-intel mission-stack interactive ${mobileIntelOpen ? "is-mobile-open" : ""}`} style={{ "--agent-color": selectedAgent.color, "--mission-progress": displayProgress }} aria-label={`${selectedAgent.name} intelligence profile`}>
            <div className="panel-corner top-left" /><div className="panel-corner bottom-right" />
            <div className="intel-panel-head"><span className="eyebrow">SELECTED INTELLIGENCE // MISSION CONSOLE</span><button className="agent-intel-close" onClick={() => setMobileIntelOpen(false)} aria-label="Close agent profile">×</button></div>

            <div className="mission-hero">
              <div className="agent-title"><AgentPortrait agent={selectedAgent} active={selectedActive} selected size="large" /><div><h2>{selectedAgent.name}</h2><p>{selectedAgent.mythTitle}</p><small>{selectedAgent.role}</small></div></div>
              <div className={`mission-radial ${selectedActive ? "is-active" : ""}`}><div><strong>{displayProgress}</strong><span>{selectedActive ? "MISSION %" : "READY %"}</span></div></div>
            </div>

            <div className="agent-personality">
              <p>{selectedAgent.personality}</p>
              <q>{selectedAgent.motto}</q>
              <div>{selectedAgent.traits.map((trait) => <span key={trait}>{trait}</span>)}</div>
            </div>

            <div className="agent-level-strip"><span>LVL {selectedAgent.floor.slice(0, 2)}</span><strong>{selectedActive ? "LIVE DIRECTIVE" : "STANDBY PROTOCOL"}</strong></div>
            <div className="room-location"><span>{selectedAgent.floor}</span><strong>{selectedAgent.room}</strong></div>
            <div className="agent-state"><span>STATE</span><strong style={{ color: selectedAgent.color }}>{selectedActive ? "WORKING" : "READY"}</strong></div>

            <div className="telemetry-grid">
              {selectedAgent.telemetry.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
            </div>

            <div className="adaptive-memory-strip">
              <span>ADAPTIVE JOURNAL</span>
              <strong>{selectedLearning.lessons} LESSONS</strong>
              <em>{selectedAgent.id === "vega" && selectedLearning.winRate !== null ? `${selectedLearning.winRate}% RESOLVED WIN RATE` : `${selectedLearning.runs} TASKS RECORDED`}</em>
            </div>

            {selectedAgent.id === "vega" && <BlofinPanel blofin={blofin} onRefresh={onRefreshBlofin} onConnect={onConnectBlofin} onDisconnect={onDisconnectBlofin} />}

            <p className="agent-description">{selectedAgent.activity}</p>
            <div className="task-readout"><span>CURRENT DIRECTIVE</span><strong>{selectedActive ? currentTask : selectedAgent.task}</strong><div><i style={{ width: `${displayProgress}%`, background: selectedAgent.color }} /></div></div>

            <div className="mission-phases">
              <span>MISSION STACK</span>
              <ol>
                {missionPhases.map(([label, threshold], index) => {
                  const complete = selectedActive && taskProgress >= threshold;
                  return <li key={label} className={complete ? "is-complete" : ""}><i>{String(index + 1).padStart(2, "0")}</i><span>{label}</span><b>{complete ? "ONLINE" : "PENDING"}</b></li>;
                })}
              </ol>
            </div>
            <div className="agent-primary-actions">
              <button className="agent-primary-action" onClick={() => onRunAgent(selectedAgent)} disabled={selectedActive}>{selectedActive ? "DIRECTIVE IN PROGRESS" : `REQUEST ${selectedAgent.name.toUpperCase()} BRIEF`}</button>
              {selectedFocused && <button className="hq-overview-action" onClick={() => { setMobileIntelOpen(false); onClearFocus(); }}>RETURN TO FULL HQ</button>}
            </div>
            <small className={`prototype-label bridge-${localAI.status}`}>LOCAL AI {localAI.status.toUpperCase()} · {localAI.model} · ADAPTIVE MEMORY ACTIVE</small>
          </aside>
        </>
      )}

      {!rundownOpen && <section className="mission-log" aria-label="Mission log">
        <span className="eyebrow">LIVE MISSION FEED</span>
        {logs.slice(-3).map((log) => <div key={log.id}><time>{log.time}</time><strong style={{ color: log.color ?? "#77e8ff" }}>{log.source}</strong><p>{log.message}</p></div>)}
      </section>}

      {!rundownOpen && <div className="scene-instruction">
        {mode === "headquarters" ? <><span>SELECT A FACILITY TO VISIT ITS RESIDENT AGENTS</span><strong>ODYSSEUS AGENT HEADQUARTERS // ALL SYSTEMS HOME</strong></> : <><span>DRAG TO ORBIT · DOUBLE CLICK TO RETURN HOME</span><strong>OBSIDIAN PARTICLE EARTH</strong></>}
      </div>}
    </div>
  );
}
