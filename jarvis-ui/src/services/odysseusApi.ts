const API_URL=(import.meta.env.VITE_ODYSSEUS_API_URL || '').replace(/\/$/,'')
const CONFIGURED_SESSION=import.meta.env.VITE_ODYSSEUS_SESSION_ID || ''

interface OdysseusSession { id:string }

async function resolveSessionId():Promise<string>{
  if(CONFIGURED_SESSION)return CONFIGURED_SESSION
  const stored=localStorage.getItem('lastSessionId')
  if(stored)return stored
  const response=await fetch(`${API_URL}/api/sessions`,{credentials:'include',headers:{Accept:'application/json'}})
  if(!response.ok)throw new Error(`Odysseus session lookup returned ${response.status}`)
  const data:unknown=await response.json()
  if(Array.isArray(data)){
    const session=data.find((candidate):candidate is OdysseusSession=>typeof candidate==='object'&&candidate!==null&&typeof (candidate as Record<string,unknown>).id==='string')
    if(session){localStorage.setItem('lastSessionId',session.id);return session.id}
  }
  throw new Error('Open the Odysseus workspace and create a model session before sending commands.')
}

export async function submitOdysseusCommand(command:string):Promise<string>{
  const session=await resolveSessionId()
  const response=await fetch(`${API_URL}/api/chat`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:command,session,attachments:[],use_web:false,use_research:false,time_filter:null,preset_id:null})})
  if(!response.ok) throw new Error(`Odysseus returned ${response.status}`)
  const data:unknown=await response.json()
  if(typeof data==='object'&&data!==null){const record=data as Record<string,unknown>;for(const key of ['response','message','content']){if(typeof record[key]==='string')return record[key]}}
  return 'Command completed.'
}
