import type { MicrophonePermission } from '../../state/JarvisContext'
export function MicrophoneStatus({active,permission}:{active:boolean;permission:MicrophonePermission}){return <span className={`micro-status ${active?'active':''}`}><i/>{active?'MIC LIVE':permission==='denied'?'MIC DENIED':permission==='unsupported'?'UNSUPPORTED':'MIC STANDBY'}</span>}
