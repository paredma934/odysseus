/** @typedef {"sleeping" | "wake-listening" | "wake-detected" | "command-listening" | "thinking" | "speaking" | "warning" | "error"} JarvisOrbState */

export const JARVIS_ORB_STATES = Object.freeze([
  "sleeping",
  "wake-listening",
  "wake-detected",
  "command-listening",
  "thinking",
  "speaking",
  "warning",
  "error",
]);

export const JARVIS_STATE_LABELS = Object.freeze({
  sleeping: "SLEEPING",
  "wake-listening": "WAKE LISTENING",
  "wake-detected": "WAKE DETECTED",
  "command-listening": "COMMAND LISTENING",
  thinking: "THINKING",
  speaking: "SPEAKING",
  warning: "WARNING",
  error: "ERROR",
});

export function isJarvisOrbState(value) {
  return JARVIS_ORB_STATES.includes(value);
}
