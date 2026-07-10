# Status: Containerization for Cloudflared

Last updated: 2026-05-30 15:42:41 CDT

## As-built
- Added a multi-stage `Dockerfile` that builds the Vite app and serves static assets via `nginx`.
- Added `nginx.conf` with SPA fallback (`try_files ... /index.html`) and `/healthz`.
- Added `docker-compose.yml` with service name `music-generator`, no host port publishing (network-only), and external network `vdv-shared-network` (`vdv-website-network`).
- Added `.dockerignore` to reduce build context and keep Docker builds efficient.
- Updated `README.md` with explicit shared-network and cloudflared attach instructions.

## Expected Runtime Topology
- App container name: `music-generator`
- App network endpoint for cloudflared: `http://music-generator:80`
- Shared Docker network: `vdv-shared-network` (`vdv-website-network`)

## Validation Pending
- Build and run checks via `docker compose up -d --build`.
- Automated test runs via `pytest` and `npx playwright test`.
