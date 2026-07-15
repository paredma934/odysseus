import { useCallback, useEffect, useRef, useState } from 'react'

export function useSpeechRecognition(onFinal:(text:string)=>void, onInterim?:(text:string)=>void) {
  const recognitionRef = useRef<SpeechRecognition|null>(null)
  const callbacks = useRef({onFinal,onInterim}); callbacks.current={onFinal,onInterim}
  const [listening,setListening]=useState(false)
  const supported=typeof window !== 'undefined' && Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition)
  const stop=useCallback(()=>{recognitionRef.current?.stop()},[])
  const start=useCallback(()=>{
    if(!supported || recognitionRef.current) return false
    const Recognition=window.SpeechRecognition ?? window.webkitSpeechRecognition
    if(!Recognition) return false
    const recognition=new Recognition(); recognition.continuous=true; recognition.interimResults=true; recognition.lang='en-US'
    recognition.onresult=(event)=>{let finalText='';let interim='';for(let i=event.resultIndex;i<event.results.length;i+=1){const result=event.results[i];if(!result) continue;const text=result[0]?.transcript ?? '';if(result.isFinal)finalText+=text;else interim+=text} if(interim)callbacks.current.onInterim?.(interim.trim());if(finalText.trim())callbacks.current.onFinal(finalText.trim())}
    recognition.onerror=()=>{setListening(false);recognitionRef.current=null}
    recognition.onend=()=>{setListening(false);recognitionRef.current=null}
    recognitionRef.current=recognition; recognition.start(); setListening(true); return true
  },[supported])
  useEffect(()=>()=>{recognitionRef.current?.abort();recognitionRef.current=null},[])
  return {supported,listening,start,stop}
}
