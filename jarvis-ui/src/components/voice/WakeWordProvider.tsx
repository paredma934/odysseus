import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition'
import { useWakeWord } from '../../hooks/useWakeWord'
import { useJarvisVoice } from '../../hooks/useJarvisVoice'
import { JarvisProvider, useJarvis } from '../../state/JarvisContext'

function WakeRuntime({children}:{children:ReactNode}){
  const{state,patch}=useJarvis();const{playAcknowledgement,sendCommand}=useJarvisVoice();const commandMode=useRef(false)
  const wake=useCallback(()=>{commandMode.current=true;playAcknowledgement();patch({orbState:'wake-detected',lastWakeTime:Date.now(),interimTranscript:''});window.setTimeout(()=>patch({orbState:'command-listening'}),650)},[patch,playAcknowledgement])
  const{inspect}=useWakeWord(wake)
  const onFinal=useCallback((text:string)=>{if(commandMode.current){commandMode.current=false;void sendCommand(text);return}inspect(text)},[inspect,sendCommand])
  const onInterim=useCallback((text:string)=>{patch({interimTranscript:text});if(!commandMode.current)inspect(text)},[inspect,patch])
  const recognition=useSpeechRecognition(onFinal,onInterim)
  const {listening,start,stop,supported}=recognition
  useEffect(()=>{if(state.voiceEnabled&&state.wakeWordEnabled&&!listening){const started=start();if(started)patch({microphoneActive:true,microphonePermission:'granted',orbState:'wake-listening'})}if(!state.voiceEnabled&&listening){stop();patch({microphoneActive:false,orbState:'sleeping'})}},[state.voiceEnabled,state.wakeWordEnabled,listening,start,stop,patch])
  useEffect(()=>{if(!supported)patch({microphonePermission:'unsupported'})},[supported,patch])
  return <>{children}</>
}
export function WakeWordProvider({children}:{children:ReactNode}){return <JarvisProvider><WakeRuntime>{children}</WakeRuntime></JarvisProvider>}
