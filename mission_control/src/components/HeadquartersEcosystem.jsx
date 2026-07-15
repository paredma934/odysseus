import { useMemo, useState } from "react";
import "./HeadquartersEcosystem.css";

const departments = [
  { id: "forge", index: "01", name: "FORGE LABS", role: "Build + Creative Systems", agents: ["zeus", "aura"], metric: "19", unit: "ACTIVE BUILDS", glyph: "◇" },
  { id: "intel", index: "02", name: "INTEL WING", role: "Research + Memory", agents: ["atlas", "echo"], metric: "12K", unit: "KNOWLEDGE LINKS", glyph: "⌘" },
  { id: "finance", index: "03", name: "FINANCE OPS", role: "Markets + Treasury", agents: ["vega", "nova"], metric: "07", unit: "LIVE SIGNALS", glyph: "▥" },
  { id: "sentinel", index: "04", name: "SENTINEL GRID", role: "Security + Resilience", agents: ["sentinel"], metric: "99.9", unit: "UPTIME %", glyph: "⬡" },
  { id: "hermes", index: "05", name: "HERMES HUB", role: "Home + Media Systems", agents: ["hermes"], metric: "26", unit: "CONNECTED DEVICES", glyph: "⌁" },
];

export default function HeadquartersEcosystem({ agents, activeAgentId, jarvisState, onSelectAgent, onOpenHeadquarters, onCoreActivate }) {
  const [selectedId, setSelectedId] = useState("forge");
  const selected = departments.find((department) => department.id === selectedId) ?? departments[0];
  const departmentAgents = useMemo(() => selected.agents.map((id) => agents.find((agent) => agent.id === id)).filter(Boolean), [agents, selected]);

  function inspectDepartment(department) {
    setSelectedId(department.id);
    const active = department.agents.find((id) => id === activeAgentId);
    const agent = agents.find((candidate) => candidate.id === (active ?? department.agents[0]));
    if (agent) onSelectAgent(agent);
  }

  return (
    <section className="ecosystem-view" aria-label="JARVIS connected headquarters ecosystem">
      <div className="ecosystem-grid" aria-hidden="true" />
      <header className="ecosystem-heading">
        <div><span>HEADQUARTERS ECOSYSTEM</span><small>CONNECTED FACILITY MAP // LIVE OPERATIONS</small></div>
        <p><b>05</b> FACILITIES <i /> <b>08</b> AGENTS <i /> <b>01</b> CORE</p>
      </header>

      <div className="ecosystem-campus">
        <div className="campus-ring ring-one" /><div className="campus-ring ring-two" />
        {departments.map((department) => {
          const active = department.agents.includes(activeAgentId);
          return <button key={department.id} className={`ecosystem-building building-${department.id} ${selectedId === department.id ? "is-selected" : ""} ${active ? "is-active" : ""}`} onClick={() => inspectDepartment(department)} aria-pressed={selectedId === department.id}>
            <span>{department.index}</span><i>{department.glyph}</i><b>{department.name}</b><small>{department.role}</small><em><u />{active ? "MISSION ACTIVE" : "SYSTEMS ONLINE"}</em>
          </button>;
        })}
        <button className={`ecosystem-core core-${jarvisState}`} onClick={onCoreActivate} aria-label={`Activate JARVIS core. Current state ${jarvisState}`}><i /><span>J</span><small>CORE</small></button>
        <div className="energy-line line-forge" /><div className="energy-line line-intel" /><div className="energy-line line-finance" /><div className="energy-line line-sentinel" /><div className="energy-line line-hermes" />
        <span className="campus-coordinate coordinate-a">41.8781° N // 87.6298° W</span><span className="campus-coordinate coordinate-b">ODYSSEUS SECURE MESH</span>
      </div>

      <aside className="ecosystem-inspector">
        <div className="inspector-head"><span>{selected.index} / FACILITY</span><b>{selected.name}</b><small>{selected.role}</small></div>
        <div className="inspector-metric"><strong>{selected.metric}</strong><span>{selected.unit}</span></div>
        <div className="department-agents">{departmentAgents.map((agent) => <button key={agent.id} style={{ "--department-color": agent.color }} onClick={() => onSelectAgent(agent)}><i>{agent.name[0]}</i><span><b>{agent.name}</b><small>{agent.shortRole}</small></span><em>{agent.id === activeAgentId ? "ACTIVE" : `${agent.readiness}%`}</em></button>)}</div>
        <button className="enter-headquarters" onClick={onOpenHeadquarters}>ENTER 3D HEADQUARTERS <span>↗</span></button>
      </aside>
    </section>
  );
}
