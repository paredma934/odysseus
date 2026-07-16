# Local wake-word models

Place these Picovoice **Web (WASM)** files in this directory when production wake detection is enabled:

- `jarvis.ppn` — the custom Jarvis keyword model
- `porcupine_params.pv` — the matching Porcupine parameter model

Do not place an AccessKey in this directory. Configure `VITE_PICOVOICE_ACCESS_KEY` in `mission_control/.env.local` and keep that file out of Git.
