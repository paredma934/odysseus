# JARVIS Mission Control

A responsive React + TypeScript command center that combines a restrained Atlas-style system UI with the animated JARVIS intelligence core, agent activity, Odysseus commands, and opt-in wake-word voice control.

## Integrated Odysseus launch

Mission Control is built into `../static/mission-control` and served by the main Odysseus application at `/`. The complete classic workspace remains available from the **Workspace** navigation item or directly at `/workspace`.

The integrated build uses the authenticated same-origin Odysseus API. It reuses the most recently selected workspace session, falls back to the first available session, and asks the operator to create a model session in `/workspace` when none exists.

## Install and run

```bash
npm install
cp .env.example .env.local
npm run dev
```

The microphone APIs require either `localhost` or an HTTPS origin. Voice permission is requested only after **Enable Voice** is selected.

## Voice and Picovoice setup

1. Create a Picovoice AccessKey and set `VITE_PICOVOICE_ACCESS_KEY` in `.env.local`.
2. Train or obtain a Web-compatible custom `Jarvis` Porcupine model.
3. Put the model at `public/wakewords/jarvis.ppn`.
4. Set `VITE_JARVIS_WAKEWORD_MODEL_PATH=/wakewords/jarvis.ppn`.
5. Restart the development server after changing environment values.

When either Picovoice setting is absent, Mission Control clearly identifies and uses its development fallback: the browser SpeechRecognition API listens for the word “Jarvis.” SpeechRecognition support varies by browser and may rely on a browser vendor's online service. Unsupported browsers retain typed commands and the manual microphone control.

## Environment

```dotenv
VITE_PICOVOICE_ACCESS_KEY=
VITE_JARVIS_WAKEWORD_MODEL_PATH=/wakewords/jarvis.ppn
VITE_ODYSSEUS_API_URL=
VITE_ODYSSEUS_WS_URL=
VITE_ODYSSEUS_SESSION_ID=
```

Commands are posted to `${VITE_ODYSSEUS_API_URL}/api/chat` using the current Odysseus session. Leave the API URL empty for the integrated same-origin installation. `VITE_ODYSSEUS_SESSION_ID` can pin Mission Control to a dedicated session when desired.

## Orb states

The central `JarvisContext` exposes a strict `JarvisOrbState` union. The UI transitions through `sleeping`, `wake-listening`, `wake-detected`, `command-listening`, `thinking`, and `speaking`; connection or voice problems use `warning` and `error`. Every state has a distinct animation and accessible text label. Reduced-motion preferences disable continuous motion.

## Checks

```bash
npm run build
npm run lint
```
