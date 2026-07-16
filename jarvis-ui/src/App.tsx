import { useState } from 'react'
import { AgentWorld } from './components/agents/AgentWorld'
import { NavigationDock } from './components/atlas/NavigationDock'
import { SystemPanel } from './components/atlas/SystemPanel'
import { IntelligenceOrb } from './components/jarvis/IntelligenceOrb'
import { VoiceCommandController } from './components/voice/VoiceCommandController'
import { WakeWordProvider } from './components/voice/WakeWordProvider'
import { HeadquartersEcosystem } from './components/headquarters/HeadquartersEcosystem'
import { useJarvis } from './state/JarvisContext'
import './App.css'

const navItems = ['Core', 'HQ Ecosystem', 'Mission log', 'Systems', 'Workspace']

function MissionControl() {
  const { state, setOrbState } = useJarvis()
  const [activeNav, setActiveNav] = useState('HQ Ecosystem')
  const [earthOpen, setEarthOpen] = useState(false)

  const selectNavigation = (item:string) => {
    if (item === 'Workspace') {
      window.location.assign('/workspace')
      return
    }
    setActiveNav(item)
  }
  return (
    <main className="mission-control">
      <div className="ambient-grid" aria-hidden="true" />
      <header className="topbar">
        <div className="brand-lockup"><span className="brand-mark">J</span><div><b>JARVIS</b><small>MISSION CONTROL / 01</small></div></div>
        <div className="top-status"><span className="status-dot" /> ODYSSEUS ONLINE <time>10:42:18 CST</time></div>
      </header>

      <NavigationDock items={navItems} active={activeNav} onSelect={selectNavigation} />

      {activeNav === 'HQ Ecosystem' ? <HeadquartersEcosystem onOpenCore={() => setActiveNav('Core')} /> :
        <section className="center-stage" aria-label="Jarvis intelligence core">
          <div className="stage-heading"><span>{activeNav === 'Core' ? 'INTELLIGENCE CORE' : activeNav.toUpperCase()}</span><small>NEURAL LINK STABLE</small></div>
          <IntelligenceOrb state={state.orbState} earthOpen={earthOpen} onDoubleClick={() => setEarthOpen((open) => !open)} onActivate={() => setOrbState(state.orbState === 'sleeping' ? 'wake-listening' : 'command-listening')} />
          <AgentWorld />
          <p className="orb-instruction">DOUBLE CLICK CORE TO {earthOpen ? 'CLOSE EARTH LINK' : 'OPEN EARTH LINK'}</p>
        </section>}

      <SystemPanel />
      <VoiceCommandController />
    </main>
  )
}

export default function App() {
  return <WakeWordProvider><MissionControl /></WakeWordProvider>
}
