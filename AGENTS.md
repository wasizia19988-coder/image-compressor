# MediaForge — Base44 Dev Environment

## What this is
A purely static website (HTML/CSS/JS) — no backend, no database, no build step.
Browser-based media tools: image compressor, audio cutter, audio-to-transcript, voice recorder, plus a dashboard.

## How it runs
Served by `nginx:alpine` via `docker-compose.base44.yml` on host port 3000.
A custom `nginx.base44.conf` (mounted into the container) sets `user root;` because the sandbox bind-mount directory has restrictive permissions that block nginx's default non-root worker.

## No secrets required
The only external integration is OpenAI Whisper transcription (`audio-transcript.js`), but the user pastes their own API key directly in the browser — there is no server-side code. No environment variables or secrets are needed to boot.

## Verify
```bash
docker compose -f docker-compose.base44.yml up -d
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/   # expect 200
```
