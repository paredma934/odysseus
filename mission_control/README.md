# JARVIS Mission Control

The primary 3D operations interface for the Odysseus agent ecosystem.

## Development

```bash
npm install
npm run dev -- --port 5174
```

Open `http://localhost:5174/`. Development requests under `/odysseus-api` and `/ollama-api` are proxied to the targets configured in `.env`.

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
