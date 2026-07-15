import { useCallback, useRef } from 'react'

const COOLDOWN_MS=2500
export function useWakeWord(onWake:()=>void) {
  const lastWake=useRef(0)
  const inspect=useCallback((text:string)=>{if(!/\bjarvis\b/i.test(text)) return false;const now=Date.now();if(now-lastWake.current<COOLDOWN_MS)return false;lastWake.current=now;onWake();return true},[onWake])
  return {inspect,lastWake}
}
