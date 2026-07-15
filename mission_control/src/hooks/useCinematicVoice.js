import { useCallback, useEffect, useRef, useState } from "react";

const noveltyVoices = /Albert|Bad News|Bells|Boing|Bubbles|Cellos|Deranged|Hysterical|Jester|Organ|Superstar|Trinoids|Whisper|Zarvox/i;
const britishMaleVoices = /Daniel|Arthur|George|Ryan|Oliver|Alfie|Elliot|Edward|Thomas|Google UK English Male|Microsoft (Ryan|George|Thomas)/i;
const likelyFemaleVoices = /Hazel|Kate|Libby|Maisie|Martha|Serena|Sonia|Susan|Google UK English Female|Microsoft (Abbi|Libby|Maisie|Sonia)/i;

function scoreVoice(voice) {
  let score = 0;
  const language = voice.lang?.toLowerCase() ?? "";
  if (language.startsWith("en-gb")) score += 120;
  else if (language.startsWith("en-ie")) score += 55;
  else if (language.startsWith("en-au")) score += 42;
  else if (language.startsWith("en")) score += 25;
  if (britishMaleVoices.test(voice.name)) score += 110;
  if (likelyFemaleVoices.test(voice.name)) score -= 80;
  if (/Apple|Microsoft|Google/i.test(voice.name)) score += 8;
  if (voice.localService) score += 4;
  if (noveltyVoices.test(voice.name)) score -= 200;
  return score;
}

function chooseBritishMaleVoice(voices) {
  const usable = voices.filter((voice) => !noveltyVoices.test(voice.name));
  const best = (candidates) => [...candidates].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
  const isBritish = (voice) => voice.lang?.toLowerCase().startsWith("en-gb");
  const isEnglish = (voice) => voice.lang?.toLowerCase().startsWith("en");

  return best(usable.filter((voice) => isBritish(voice) && britishMaleVoices.test(voice.name)))
    ?? best(usable.filter((voice) => isBritish(voice) && !likelyFemaleVoices.test(voice.name)))
    ?? best(usable.filter(isBritish))
    ?? best(usable.filter((voice) => isEnglish(voice) && britishMaleVoices.test(voice.name)))
    ?? best(usable.filter(isEnglish))
    ?? best(usable);
}

export default function useCinematicVoice(enabled) {
  const selectedVoice = useRef(null);
  const speechId = useRef(0);
  const [voiceName, setVoiceName] = useState("British male profile");
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return undefined;
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;
      const best = chooseBritishMaleVoice(voices);
      selectedVoice.current = best;
      setVoiceName(best?.name || "British male profile");
    };
    loadVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", loadVoices);
  }, []);

  const cancel = useCallback(() => {
    speechId.current += 1;
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  const speak = useCallback((text, onComplete, force = false) => {
    if ((!enabled && !force) || !("speechSynthesis" in window)) return false;
    const currentSpeechId = speechId.current + 1;
    speechId.current = currentSpeechId;
    window.speechSynthesis.cancel();
    setIsSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(text);
    if (selectedVoice.current) utterance.voice = selectedVoice.current;
    utterance.lang = selectedVoice.current?.lang || "en-GB";
    utterance.rate = 0.86;
    utterance.pitch = 0.72;
    utterance.volume = 1;
    const finish = () => {
      if (speechId.current !== currentSpeechId) return;
      setIsSpeaking(false);
      onComplete?.();
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.speak(utterance);
    return true;
  }, [enabled]);

  return { speak, cancel, voiceName, isSpeaking };
}
