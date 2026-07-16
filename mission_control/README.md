# JARVIS Mission Control

The primary responsive 3D operations interface for the Odysseus agent ecosystem. The live development interface is served at `http://localhost:5174/`.

## Interface architecture

- The central Three.js intelligence core is the main control surface. Double-clicking it opens the particle Earth; double-clicking Earth returns to Headquarters.
- Eight explicit states communicate what JARVIS is doing: sleeping, wake listening, wake detected, command listening, thinking, speaking, warning, and error.
- The Atlas-style HUD wraps the existing headquarters, agent roster, adaptive journals, BloFin bridge, activity feed, and Odysseus command routing without replacing them.
- Compact local-session telemetry reports browser CPU approximation, browser memory, network state, Odysseus status, active agents, and microphone state. The telemetry hook is the seam for future WebSocket-backed host metrics.
- Typed commands always remain available. Voice input and speech output are separate controls and preferences.

## Development

```bash
npm install
npm run dev -- --port 5174
```

Open `http://localhost:5174/`. Development requests under `/odysseus-api` and `/ollama-api` are proxied to the targets configured in `.env`.

## Voice wake and Picovoice setup

The microphone is never activated on page load. Press the microphone button to grant permission and arm wake detection. The preference is remembered, but a new page session still requires an explicit user action before recording begins.

For private, local Porcupine detection:

1. Create a Picovoice AccessKey and put it in `mission_control/.env.local` as `VITE_PICOVOICE_ACCESS_KEY`.
2. Export a custom **Web (WASM)** `Jarvis` keyword from Picovoice Console and place it at `mission_control/public/wakewords/jarvis.ppn`.
3. Download the matching English `porcupine_params.pv` parameter model and place it at `mission_control/public/wakewords/porcupine_params.pv`.
4. Copy the wake-word paths from `.env.example`, then restart Vite.

If the Picovoice key or keyword path is absent, Mission Control clearly uses its browser `SpeechRecognition` fallback. Browser support varies and that fallback may use a browser-vendor network service. If speech recognition is unavailable, the typed command input still works.

Microphone input requires `localhost` or HTTPS. Wake detection only operates while the page remains open and the browser allows the tab to run. A future native macOS/Python listener can provide always-available room wake behavior and notify this UI over WebSockets.

Never commit `.env.local`, a Picovoice AccessKey, or other credentials.

## Integrated production build

```bash
npm run build
```

The production build is written to `../static/mission-control`. The main Odysseus server presents it at `/`, while the classic workspace remains at `/workspace`. Production API requests use the authenticated same-origin Odysseus backend.

## Validation

```bash
npm run build
npm run lint
```

The production build uses code splitting, so the Picovoice engine is loaded only when a configured user explicitly arms the microphone.
