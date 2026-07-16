import { useEffect, useRef, useState } from "react";

const accessKey = import.meta.env.VITE_PICOVOICE_ACCESS_KEY?.trim();
const keywordPath = import.meta.env.VITE_JARVIS_WAKEWORD_MODEL_PATH?.trim();
const parameterPath = import.meta.env.VITE_PORCUPINE_MODEL_PATH?.trim() || "/wakewords/porcupine_params.pv";

export const hasPorcupineConfig = Boolean(accessKey && keywordPath);

export default function usePorcupineWakeWord({ enabled, paused, onWake }) {
  const [status, setStatus] = useState(hasPorcupineConfig ? "ready" : "fallback");
  const [error, setError] = useState("");
  const workerRef = useRef();
  const onWakeRef = useRef(onWake);
  const generationRef = useRef(0);
  const lastWakeRef = useRef(0);

  onWakeRef.current = onWake;

  useEffect(() => {
    if (!hasPorcupineConfig || !enabled || paused) {
      if (!hasPorcupineConfig) setStatus("fallback");
      return undefined;
    }

    const generation = generationRef.current + 1;
    generationRef.current = generation;
    let disposed = false;

    const stop = async () => {
      const handle = workerRef.current;
      if (!handle) return;
      workerRef.current = undefined;
      try {
        const { WebVoiceProcessor } = await import("@picovoice/web-voice-processor");
        await WebVoiceProcessor.unsubscribe(handle.worker);
      } catch {
        // The recorder may already be stopped while the page is closing.
      }
      try {
        await handle.release();
        handle.terminate();
      } catch {
        // The worker may already be terminated.
      }
    };

    const start = async () => {
      setStatus("starting");
      setError("");
      try {
        const [{ PorcupineWorker }, { WebVoiceProcessor }] = await Promise.all([
          import("@picovoice/porcupine-web"),
          import("@picovoice/web-voice-processor"),
        ]);
        const worker = await PorcupineWorker.create(
          accessKey,
          { publicPath: keywordPath, label: "Jarvis", sensitivity: 0.65 },
          () => {
            const timestamp = Date.now();
            if (timestamp - lastWakeRef.current < 2500) return;
            lastWakeRef.current = timestamp;
            onWakeRef.current?.();
          },
          { publicPath: parameterPath, customWritePath: "jarvis-porcupine-params", version: 1 },
          { processErrorCallback: (wakeError) => setError(wakeError.message || "Wake engine processing error") },
        );
        if (disposed || generationRef.current !== generation) {
          await worker.release();
          worker.terminate();
          return;
        }
        workerRef.current = worker;
        WebVoiceProcessor.setOptions({ frameLength: worker.frameLength, outputSampleRate: worker.sampleRate });
        await WebVoiceProcessor.subscribe(worker.worker);
        if (!disposed) setStatus("listening");
      } catch (wakeError) {
        await stop();
        if (!disposed) {
          setStatus("error");
          setError(wakeError instanceof Error ? wakeError.message : "Porcupine could not start");
        }
      }
    };

    void start();
    return () => {
      disposed = true;
      generationRef.current += 1;
      void stop();
    };
  }, [enabled, paused]);

  useEffect(() => () => {
    generationRef.current += 1;
    const handle = workerRef.current;
    workerRef.current = undefined;
    if (!handle) return;
    void import("@picovoice/web-voice-processor").then(({ WebVoiceProcessor }) => WebVoiceProcessor.unsubscribe(handle.worker)).catch(() => {});
    void handle.release().catch(() => {}).finally(() => handle.terminate());
  }, []);

  return { configured: hasPorcupineConfig, status, error };
}
