export function StatusBadge({label,online=true}:{label:string;online?:boolean}){return <span className={`status-badge ${online?'online':'offline'}`}><i/>{label}</span>}
