import { useCallback } from 'react'
import { submitOdysseusCommand } from '../services/odysseusApi'
import { useJarvis } from '../state/JarvisContext'

export function useJarvisVoice(){
  const {patch}=useJarvis()
  const playAcknowledgement=useCallback(()=>{const AudioContextClass=window.AudioContext;const context=new AudioContextClass();const oscillator=context.createOscillator();const gain=context.createGain();oscillator.frequency.setValueAtTime(620,context.currentTime);oscillator.frequency.exponentialRampToValueAtTime(880,context.currentTime+.1);gain.gain.setValueAtTime(.06,context.currentTime);gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+.14);oscillator.connect(gain).connect(context.destination);oscillator.start();oscillator.stop(context.currentTime+.15);oscillator.onended=()=>void context.close()},[])
  const sendCommand=useCallback(async(command:string)=>{if(!command.trim())return;patch({transcript:command,interimTranscript:'',orbState:'thinking',activeAgent:'Odysseus'});try{const answer=await submitOdysseusCommand(command);patch({currentResponse:answer,orbState:'speaking',isConnectedToOdysseus:true});if('speechSynthesis'in window){const utterance=new SpeechSynthesisUtterance(answer);utterance.onend=()=>patch({orbState:'wake-listening'});window.speechSynthesis.cancel();window.speechSynthesis.speak(utterance)}else patch({orbState:'wake-listening'})}catch{patch({currentResponse:'Odysseus connection unavailable. Command retained locally.',orbState:'warning',isConnectedToOdysseus:false})}},[patch])
  return {playAcknowledgement,sendCommand}
}
