import { useMemo, useState } from "react";
import AgentPortrait from "./AgentPortrait";
import "./HeadquartersEcosystem.css";

const facilities = [
  { id: "forge", index: "00", name: "FORGE LABS", role: "Systems Architecture + Creative Build", agents: ["zeus", "aura"], metric: "19", unit: "ACTIVE BUILDS", color: "#38cfff", className: "facility-forge", icon: "◇" },
  { id: "hermes", index: "01", name: "HERMES HQ", role: "Home, Media + Automation", agents: ["hermes"], metric: "26", unit: "CONNECTED DEVICES", color: "#8af0a8", className: "facility-hermes", icon: "⌁" },
  { id: "intel", index: "02", name: "INTEL ARCHIVE", role: "Research + Living Memory", agents: ["atlas", "echo"], metric: "12K", unit: "KNOWLEDGE LINKS", color: "#a479ff", className: "facility-intel", icon: "⌘" },
  { id: "finance", index: "03", name: "AEGIS EXCHANGE", role: "Markets + Treasury", agents: ["vega", "nova"], metric: "07", unit: "LIVE SIGNALS", color: "#50e9b0", className: "facility-finance", icon: "▥" },
  { id: "sentinel", index: "04", name: "SENTINEL KEEP", role: "Security + Resilience", agents: ["sentinel"], metric: "99.9", unit: "UPTIME %", color: "#ff6c78", className: "facility-sentinel", icon: "⬡" },
];

const treeSeeds = Array.from({ length: 42 }, (_, index) => ({
  id: index,
  x: (index * 37 + 11) % 96,
  y: (index * 61 + 7) % 92,
  scale: 0.62 + ((index * 13) % 7) * 0.08,
  delay: -((index * 17) % 19) / 3,
}));

const lampSeeds = Array.from({ length: 18 }, (_, index) => ({
  id: index,
  x: 16 + ((index * 23) % 69),
  y: 13 + ((index * 31) % 72),
}));

export default function HeadquartersEcosystem({ agents, activeAgentId, jarvisState, onSelectAgent, onCoreActivate, onEarthMode }) {
  const [selectedId, setSelectedId] = useState("forge");
  const selected = facilities.find((facility) => facility.id === selectedId) ?? facilities[0];
  const residents = useMemo(() => selected.agents.map((id) => agents.find((agent) => agent.id === id)).filter(Boolean), [agents, selected]);

  function inspectFacility(facility) {
    setSelectedId(facility.id);
    const activeResident = facility.agents.find((id) => id === activeAgentId);
    const agent = agents.find((candidate) => candidate.id === (activeResident ?? facility.agents[0]));
    if (agent) onSelectAgent(agent);
  }

  return (
    <section className="headquarters-home" aria-label="JARVIS agent headquarters campus">
      <div className="hq-sky" aria-hidden="true"><i /><i /><i /></div>
      <div className="hq-terrain" aria-hidden="true" />
      <header className="hq-home-heading">
        <div><span>ODYSSEUS AGENT HEADQUARTERS</span><small>PRIVATE INTELLIGENCE CAMPUS // ALL SYSTEMS HOME</small></div>
        <p><b>05</b> FACILITIES <i /> <b>08</b> RESIDENT AGENTS <i /> <b>01</b> JARVIS CORE</p>
      </header>

      <div className="hq-campus" aria-label="Interactive headquarters map">
        <div className="campus-water water-left" aria-hidden="true" /><div className="campus-water water-right" aria-hidden="true" />
        <div className="campus-road road-loop" aria-hidden="true" /><div className="campus-road road-north" aria-hidden="true" /><div className="campus-road road-south" aria-hidden="true" /><div className="campus-road road-east" aria-hidden="true" /><div className="campus-road road-west" aria-hidden="true" />
        <div className="campus-plaza" aria-hidden="true"><i /><i /><i /></div>
        <div className="campus-forest" aria-hidden="true">
          {treeSeeds.map((tree) => <i key={tree.id} style={{ "--tree-x": `${tree.x}%`, "--tree-y": `${tree.y}%`, "--tree-scale": tree.scale, "--tree-delay": `${tree.delay}s` }} />)}
        </div>
        <div className="campus-lamps" aria-hidden="true">
          {lampSeeds.map((lamp) => <i key={lamp.id} style={{ "--lamp-x": `${lamp.x}%`, "--lamp-y": `${lamp.y}%` }} />)}
        </div>

        {facilities.map((facility) => {
          const active = facility.agents.includes(activeAgentId);
          const facilityAgents = facility.agents.map((id) => agents.find((agent) => agent.id === id)).filter(Boolean);
          return (
            <button
              key={facility.id}
              className={`hq-facility ${facility.className} ${selectedId === facility.id ? "is-selected" : ""} ${active ? "is-active" : ""}`}
              style={{ "--facility-color": facility.color }}
              onClick={() => inspectFacility(facility)}
              aria-pressed={selectedId === facility.id}
              aria-label={`${facility.name}, ${facility.role}, ${active ? "mission active" : "online"}`}
            >
              <span className="facility-glow" />
              <span className="facility-structure">
                <i className="facility-wing wing-left" /><i className="facility-wing wing-right" />
                <i className="facility-tower tower-left" /><i className="facility-tower tower-center" /><i className="facility-tower tower-right" />
                <i className="facility-roof" /><i className="facility-door" />
                <b>{facility.name}</b>
              </span>
              <span className="facility-status-card"><em>{facility.index}</em><strong>{facility.name}</strong><small>{facility.role}</small><u>{active ? "MISSION ACTIVE" : "SYSTEMS ONLINE"}</u></span>
              <span className="facility-residents">
                {facilityAgents.map((agent) => <i key={agent.id} title={`${agent.name} lives here`}><AgentPortrait agent={agent} active={agent.id === activeAgentId} size="tiny" /><b>{agent.name}</b></i>)}
              </span>
            </button>
          );
        })}

        <button className={`home-core core-${jarvisState}`} onClick={onCoreActivate} onDoubleClick={onEarthMode} aria-label={`Activate JARVIS home core. Current state ${jarvisState}. Double click for Earth.`}>
          <i /><span>J</span><small>HOME CORE</small>
        </button>
        <div className="core-beam beam-forge" aria-hidden="true" /><div className="core-beam beam-hermes" aria-hidden="true" /><div className="core-beam beam-intel" aria-hidden="true" /><div className="core-beam beam-finance" aria-hidden="true" /><div className="core-beam beam-sentinel" aria-hidden="true" />
        <span className="campus-coordinate coordinate-a">41.8781° N // PRIVATE LOCAL MESH</span><span className="campus-coordinate coordinate-b">ODYSSEUS CAMPUS // NIGHT CYCLE</span>
      </div>

      <aside className="hq-home-inspector" style={{ "--facility-color": selected.color }}>
        <div className="home-inspector-head"><span>{selected.index} / AGENT HOME</span><b>{selected.name}</b><small>{selected.role}</small></div>
        <div className="home-inspector-metric"><strong>{selected.metric}</strong><span>{selected.unit}</span><i>ONLINE</i></div>
        <p>This secure facility is the permanent operational home for {residents.map((agent) => agent.name).join(" and ")}. Select a resident to open their intelligence profile.</p>
        <div className="home-resident-list">
          {residents.map((agent) => (
            <button key={agent.id} style={{ "--resident-color": agent.color }} onClick={() => onSelectAgent(agent)}>
              <AgentPortrait agent={agent} active={agent.id === activeAgentId} size="small" />
              <span><b>{agent.name}</b><small>{agent.mythTitle}</small><em>{agent.room}</em></span>
              <strong>{agent.id === activeAgentId ? "ACTIVE" : `${agent.readiness}% READY`}</strong>
            </button>
          ))}
        </div>
        <div className="facility-capabilities"><span>FACILITY CAPABILITIES</span><div><b>DESIGN</b><b>BUILD</b><b>AUTOMATE</b><b>LEARN</b></div></div>
      </aside>
    </section>
  );
}
