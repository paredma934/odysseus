const API_URL=import.meta.env.VITE_ODYSSEUS_API_URL || 'http://localhost:7860'
export async function submitOdysseusCommand(command:string):Promise<string>{
  const response=await fetch(`${API_URL}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:command})})
  if(!response.ok) throw new Error(`Odysseus returned ${response.status}`)
  const data:unknown=await response.json()
  if(typeof data==='object'&&data!==null){const record=data as Record<string,unknown>;for(const key of ['response','message','content']){if(typeof record[key]==='string')return record[key]}}
  return 'Command completed.'
}
