import type { JarvisOrbState } from '../../state/JarvisContext'
import { EarthHologram } from './EarthHologram'
import { OrbRings } from './OrbRings'
import { OrbWaveform } from './OrbWaveform'
import './orb.css'

export function IntelligenceOrb({state,earthOpen,onDoubleClick,onActivate}:{state:JarvisOrbState;earthOpen:boolean;onDoubleClick:()=>void;onActivate:()=>void}){
  return <button className={`intelligence-orb state-${state}`} onDoubleClick={onDoubleClick} onClick={onActivate} aria-label={`Jarvis intelligence core. Current state: ${state}. Double click for Earth hologram.`}>
    <OrbRings/>{earthOpen?<EarthHologram/>:<div className="orb-core"><div className="core-mesh"/><span>J</span><small>{state.replace('-',' ')}</small></div>}
    {(state==='command-listening'||state==='speaking')&&<OrbWaveform/>}<div className="energy-pulse" aria-hidden="true"/>
  </button>
}
