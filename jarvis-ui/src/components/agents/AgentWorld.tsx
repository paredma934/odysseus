import { AgentCharacter } from './AgentCharacter'
import './agents.css'
export function AgentWorld(){return <div className="agent-world" aria-label="Three active agents"><AgentCharacter name="Atlas" angle={12}/><AgentCharacter name="Echo" angle={138}/><AgentCharacter name="Odysseus" angle={252}/></div>}
