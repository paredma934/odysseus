/* oxlint-disable react/only-export-components -- context hook and provider intentionally share one typed module */
import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react'

export type JarvisOrbState = 'sleeping' | 'wake-listening' | 'wake-detected' | 'command-listening' | 'thinking' | 'speaking' | 'warning' | 'error'
export type MicrophonePermission = 'unknown' | 'prompt' | 'granted' | 'denied' | 'unsupported'

interface JarvisState {
  orbState: JarvisOrbState; voiceEnabled: boolean; wakeWordEnabled: boolean
  microphonePermission: MicrophonePermission; microphoneActive: boolean
  transcript: string; interimTranscript: string; lastWakeTime: number
  isConnectedToOdysseus: boolean; activeAgent: string; currentResponse: string
}

type Action = { type: 'patch'; patch: Partial<JarvisState> }
const initialState: JarvisState = { orbState:'sleeping', voiceEnabled:localStorage.getItem('jarvis.voiceEnabled') === 'true', wakeWordEnabled:localStorage.getItem('jarvis.wakeWordEnabled') !== 'false', microphonePermission:'unknown', microphoneActive:false, transcript:'', interimTranscript:'', lastWakeTime:0, isConnectedToOdysseus:true, activeAgent:'Atlas', currentResponse:'' }

const Context = createContext<{state:JarvisState; patch:(patch:Partial<JarvisState>)=>void; setOrbState:(orbState:JarvisOrbState)=>void}|null>(null)
function reducer(state:JarvisState, action:Action):JarvisState { return {...state,...action.patch} }

export function JarvisProvider({children}:{children:ReactNode}) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const value = useMemo(() => ({state, patch:(patch:Partial<JarvisState>)=>dispatch({type:'patch',patch}), setOrbState:(orbState:JarvisOrbState)=>dispatch({type:'patch',patch:{orbState}})}), [state])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useJarvis() { const value=useContext(Context); if(!value) throw new Error('useJarvis must be used inside JarvisProvider'); return value }
