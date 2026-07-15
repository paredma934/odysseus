export function AudioVisualizer({active}:{active:boolean}){return <span className={`audio-mini ${active?'active':''}`} aria-hidden="true">{[1,2,3,4].map(value=><i key={value}/>)}</span>}
