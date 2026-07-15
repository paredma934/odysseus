export function OrbWaveform(){return <div className="orb-waveform" aria-hidden="true">{Array.from({length:28},(_,index)=><i key={index} style={{animationDelay:`${index*-35}ms`}}/>)}</div>}
