import { useEffect, useRef, useState } from "react";

const wakePattern = /\bhey[\s,]+jarvis\b[,\s]*/i;
const fatalRecognitionErrors = new Set(["not-allowed", "service-not-allowed", "audio-capture", "language-not-supported"]);

export default function VoiceConsole({ jarvisState, lastResponse, speechActive, onCommand, onWake, onListeningChange }) {
  const [command, setCommand] = useState("");
  const [wakeArmed, setWakeArmed] = useState(false);
  const [recognitionActive, setRecognitionActive] = useState(false);
  const [wakeDetected, setWakeDetected] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const inputRef = useRef();
  const recognitionRef = useRef();
  const recognitionCtorRef = useRef();
  const recognitionActiveRef = useRef(false);
  const wakeArmedRef = useRef(false);
  const wakeDetectedRef = useRef(false);
  const speechActiveRef = useRef(false);
  const pauseForSpeechRef = useRef(false);
  const generationRef = useRef(0);
  const restartTimerRef = useRef();
  const scheduleRestartRef = useRef(() => {});
  const wakeTimerRef = useRef();
  const wakeBufferTimerRef = useRef();
  const wakeBufferRef = useRef("");
  const transientFailuresRef = useRef(0);
  const nextRestartDelayRef = useRef(300);
  const lastDispatchRef = useRef({ text: "", time: 0 });

  function closeWakeWindow() {
    window.clearTimeout(wakeTimerRef.current);
    wakeDetectedRef.current = false;
    setWakeDetected(false);
    setCommand("");
    onListeningChange(false);
  }

  function abortRecognition() {
    generationRef.current += 1;
    const recognition = recognitionRef.current;
    recognitionRef.current = undefined;
    recognitionActiveRef.current = false;
    setRecognitionActive(false);
    try {
      recognition?.abort?.();
    } catch {
      // The recognition service may already be closed.
    }
  }

  function scheduleRestart(delay = 300) {
    window.clearTimeout(restartTimerRef.current);
    if (!wakeArmedRef.current || speechActiveRef.current || pauseForSpeechRef.current || document.visibilityState !== "visible") return;
    restartTimerRef.current = window.setTimeout(() => {
      const SpeechRecognition = recognitionCtorRef.current;
      if (SpeechRecognition) beginRecognition(SpeechRecognition);
    }, delay);
  }

  scheduleRestartRef.current = scheduleRestart;

  function openWakeWindow(hasDirective) {
    window.clearTimeout(wakeTimerRef.current);
    wakeDetectedRef.current = true;
    setWakeDetected(true);
    setVoiceError("");
    onListeningChange(true);

    if (!hasDirective) {
      pauseForSpeechRef.current = true;
      abortRecognition();
      const voiceReplyStarted = onWake(false);
      if (!voiceReplyStarted) {
        pauseForSpeechRef.current = false;
        scheduleRestart(250);
      }
      wakeTimerRef.current = window.setTimeout(closeWakeWindow, 9000);
      return;
    }

    onWake(true);
  }

  function executeDirective(directive) {
    const clean = directive.trim();
    if (!clean) return;

    const normalized = clean.toLowerCase().replace(/\s+/g, " ");
    const timestamp = Date.now();
    if (lastDispatchRef.current.text === normalized && timestamp - lastDispatchRef.current.time < 1600) return;
    lastDispatchRef.current = { text: normalized, time: timestamp };

    closeWakeWindow();
    abortRecognition();
    scheduleRestart(450);
    onCommand(clean);
  }

  function beginRecognition(SpeechRecognition) {
    if (!wakeArmedRef.current || speechActiveRef.current || pauseForSpeechRef.current || document.visibilityState !== "visible" || recognitionRef.current || recognitionActiveRef.current) return;

    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    const isCurrent = () => generationRef.current === generation && recognitionRef.current === recognition;

    recognition.onstart = () => {
      if (!isCurrent()) return;
      recognitionActiveRef.current = true;
      setRecognitionActive(true);
      setVoiceError("");
    };

    recognition.onresult = (event) => {
      if (!isCurrent() || speechActiveRef.current || pauseForSpeechRef.current) return;
      transientFailuresRef.current = 0;
      let transcript = "";
      let finalTranscript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        transcript += `${event.results[index][0].transcript} `;
        if (event.results[index].isFinal) finalTranscript += `${event.results[index][0].transcript} `;
      }

      const finalText = finalTranscript.trim();
      if (!wakeDetectedRef.current) {
        if (!finalText) return;
        wakeBufferRef.current = `${wakeBufferRef.current} ${finalText}`.trim().slice(-180);
        window.clearTimeout(wakeBufferTimerRef.current);
        wakeBufferTimerRef.current = window.setTimeout(() => { wakeBufferRef.current = ""; }, 3500);
        const wakeMatch = wakeBufferRef.current.match(wakePattern);
        if (!wakeMatch) return;
        const directive = wakeBufferRef.current.slice((wakeMatch.index ?? 0) + wakeMatch[0].length).trim();
        wakeBufferRef.current = "";
        window.clearTimeout(wakeBufferTimerRef.current);
        openWakeWindow(Boolean(directive));
        if (directive) executeDirective(directive);
        return;
      }

      setCommand(transcript.replace(wakePattern, "").trim());
      if (finalText) executeDirective(finalText.replace(wakePattern, ""));
    };

    recognition.onerror = (event) => {
      if (!isCurrent()) return;
      if (fatalRecognitionErrors.has(event.error)) {
        wakeArmedRef.current = false;
        setWakeArmed(false);
        setVoiceError(event.error.includes("allowed") ? "Microphone access was not allowed. Enable it, then arm Hey JARVIS again." : "The microphone or speech language is unavailable. Type the command instead.");
        closeWakeWindow();
        abortRecognition();
        return;
      }

      if (event.error === "network") {
        transientFailuresRef.current += 1;
        if (transientFailuresRef.current >= 5) {
          wakeArmedRef.current = false;
          setWakeArmed(false);
          setVoiceError("The wake listener could not reach speech recognition. Press the microphone to retry.");
          abortRecognition();
          return;
        }
        nextRestartDelayRef.current = Math.min(8000, 500 * (2 ** (transientFailuresRef.current - 1)));
        setVoiceError("Wake recognition is reconnecting…");
      } else if (event.error !== "aborted" && event.error !== "no-speech") {
        nextRestartDelayRef.current = 1000;
        setVoiceError("The wake listener lost its voice connection. Reconnecting…");
      }
    };

    recognition.onend = () => {
      if (!isCurrent()) return;
      recognitionRef.current = undefined;
      recognitionActiveRef.current = false;
      setRecognitionActive(false);
      const restartDelay = nextRestartDelayRef.current;
      nextRestartDelayRef.current = 300;
      scheduleRestart(restartDelay);
    };

    try {
      recognition.start();
    } catch {
      if (!isCurrent()) return;
      recognitionRef.current = undefined;
      recognitionActiveRef.current = false;
      setRecognitionActive(false);
      transientFailuresRef.current += 1;
      scheduleRestart(Math.min(4000, 500 * (2 ** transientFailuresRef.current)));
    }
  }

  useEffect(() => {
    speechActiveRef.current = speechActive;
    if (speechActive) {
      pauseForSpeechRef.current = true;
      window.clearTimeout(restartTimerRef.current);
      abortRecognition();
      return undefined;
    }

    if (pauseForSpeechRef.current) {
      pauseForSpeechRef.current = false;
      scheduleRestartRef.current(650);
    }
    return undefined;
  }, [speechActive]);

  useEffect(() => {
    const focusCommand = (event) => {
      if (event.key === "/" && document.activeElement?.tagName !== "INPUT") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") abortRecognition();
      else scheduleRestartRef.current(350);
    };
    const handlePageHide = () => abortRecognition();

    window.addEventListener("keydown", focusCommand);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("keydown", focusCommand);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handlePageHide);
      wakeArmedRef.current = false;
      window.clearTimeout(restartTimerRef.current);
      window.clearTimeout(wakeTimerRef.current);
      window.clearTimeout(wakeBufferTimerRef.current);
      abortRecognition();
    };
  }, []);

  function toggleWakeListener() {
    if (wakeArmedRef.current) {
      wakeArmedRef.current = false;
      setWakeArmed(false);
      setVoiceError("");
      closeWakeWindow();
      wakeBufferRef.current = "";
      window.clearTimeout(wakeBufferTimerRef.current);
      window.clearTimeout(restartTimerRef.current);
      abortRecognition();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError("Wake-word recognition is unavailable in this browser. Type the command instead.");
      inputRef.current?.focus();
      return;
    }

    recognitionCtorRef.current = SpeechRecognition;
    transientFailuresRef.current = 0;
    wakeArmedRef.current = true;
    setWakeArmed(true);
    setVoiceError("");
    beginRecognition(SpeechRecognition);
  }

  function submit(event) {
    event.preventDefault();
    const clean = command.trim();
    if (!clean) return;
    executeDirective(clean);
    setVoiceError("");
  }

  const stateLabel = jarvisState === "thinking"
    ? "ANALYZING"
    : jarvisState === "speaking"
      ? "SPEAKING"
      : wakeDetected
        ? "HEY JARVIS CONFIRMED · LISTENING"
        : wakeArmed
          ? recognitionActive ? "HEY JARVIS · EXPERIMENTAL · ARMED" : "RECONNECTING WAKE LISTENER"
          : "COMMAND LINK READY";

  return (
    <div className={`voice-console interactive ${wakeArmed ? "wake-armed" : ""}`}>
      <div className={`voice-wave ${wakeArmed ? "is-armed" : ""} ${wakeDetected || jarvisState === "speaking" ? "is-live" : ""}`} aria-hidden="true">{[0, 1, 2, 3, 4, 5, 6].map((bar) => <i key={bar} />)}</div>
      <div className="voice-copy" aria-live="polite"><span>{stateLabel}</span><p>{voiceError || lastResponse || "Say Hey JARVIS or type a command."}</p></div>
      <form onSubmit={submit}>
        <input ref={inputRef} value={command} onChange={(event) => setCommand(event.target.value)} placeholder={wakeDetected ? "Listening for your directive…" : "Say “Hey JARVIS” or type a command…"} aria-label="Command JARVIS" />
        <button type="submit" aria-label="Send command">SEND</button>
        <button type="button" className={`mic-button ${wakeArmed ? "is-armed" : ""} ${wakeDetected ? "is-live" : ""}`} onClick={toggleWakeListener} aria-pressed={wakeArmed} aria-label={wakeArmed ? "Disable experimental Hey JARVIS wake word" : "Enable experimental Hey JARVIS wake word"} title={wakeArmed ? "Hey JARVIS is armed while this tab is open" : "Arm Hey JARVIS"}><span /></button>
      </form>
    </div>
  );
}
