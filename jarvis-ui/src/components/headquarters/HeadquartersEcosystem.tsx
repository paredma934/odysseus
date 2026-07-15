import { useState } from 'react'
import { useJarvis } from '../../state/JarvisContext'
import './headquarters.css'

type ZoneId = 'blueprint' | 'relay' | 'forge' | 'pulse' | 'agents'
interface Zone { id:ZoneId; index:string; name:string; role:string; status:string; metric:string; detail:string; glyph:string }
const zones:Zone[]=[
  {id:'blueprint',index:'01',name:'BLUEPRINT',role:'Workflow Mapper',status:'4 flows active',metric:'12',detail:'Automations designed and monitored from a single visual command surface.',glyph:'⌘'},
  {id:'relay',index:'02',name:'RELAY',role:'Integration Nexus',status:'9 links healthy',metric:'99.2%',detail:'Secure channels between Odysseus, local tools, models, and external services.',glyph:'⌁'},
  {id:'forge',index:'00',name:'FORGE LABS',role:'Systems Architect',status:'Building runtime',metric:'03',detail:'Execution floor for code, research, synthesis, and long-running agent missions.',glyph:'◇'},
  {id:'pulse',index:'03',name:'PULSE',role:'Metrics Analyst',status:'Telemetry live',metric:'18ms',detail:'Tracks system health, agent throughput, model latency, and mission outcomes.',glyph:'▥'},
  {id:'agents',index:'04',name:'AGENT WING',role:'Agent Operations',status:'3 agents online',metric:'03',detail:'Specialist quarters for Atlas, Echo, and Odysseus with shared memory access.',glyph:'◎'},
]

export function HeadquartersEcosystem({onOpenCore}:{onOpenCore:()=>void}){
  const [selected,setSelected]=useState<ZoneId>('forge');const{state}=useJarvis();const active=zones.find(zone=>zone.id===selected)??zones[2]
  return <section className="hq-ecosystem" aria-label="JARVIS headquarters ecosystem">
    <header className="hq-heading"><div><span>HEADQUARTERS ECOSYSTEM</span><small>LIVE FACILITY MAP / SECTOR 01</small></div><div className="hq-summary"><b>05</b> ZONES <i/> <b>03</b> AGENTS <i/> <b>09</b> LINKS</div></header>
    <div className="hq-map">
      <div className="hq-terrain" aria-hidden="true"/><div className="hq-path path-a"/><div className="hq-path path-b"/><div className="hq-path path-c"/><div className="hq-path path-d"/>
      {zones.map(zone=><button key={zone.id} className={`hq-zone zone-${zone.id} ${selected===zone.id?'selected':''}`} onClick={()=>setSelected(zone.id)} aria-pressed={selected===zone.id}>
        <span className="zone-index">{zone.index}</span><i className="zone-glyph">{zone.glyph}</i><b>{zone.name}</b><small>{zone.role}</small><em><i/>{zone.status}</em>
      </button>)}
      <button className={`hq-core state-${state.orbState}`} onClick={onOpenCore} aria-label="Open JARVIS intelligence core"><i/><span>J</span><small>CORE</small></button>
      <div className="map-coordinate top-left">41.8781° N</div><div className="map-coordinate bottom-right">HQ / CHICAGO</div>
    </div>
    <aside className="zone-inspector glass-panel" aria-live="polite"><div className="inspector-title"><span>{active.index} / ACTIVE ZONE</span><b>{active.name}</b><small>{active.role}</small></div><strong>{active.metric}</strong><p>{active.detail}</p><div className="inspector-actions"><button>OPEN CONSOLE</button><button aria-label="Pin active zone">⌖</button></div></aside>
  </section>
}
