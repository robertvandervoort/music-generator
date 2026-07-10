# MVP Test Criteria

Last updated: 2026-07-10 16:57:47 CDT

## Containerized Deployment

### Acceptance Criteria
- App builds into a production image using `Dockerfile`.
- App serves the compiled Vite output over HTTP on container port `80`.
- `docker-compose.yml` attaches the app service to shared external network `vdv-shared-network` (name `vdv-website-network`).
- Service is reachable over Docker DNS at `http://music-generator:80` from peers on `vdv-website-network`.
- `cloudflared` can target `http://music-generator:80` over Docker DNS.

### Test Coverage Checklist
- [x] `docker compose up -d --build` starts `music-generator` successfully.
- [x] `docker run --rm --network vdv-website-network curlimages/curl:8.8.0 -sI http://music-generator:80` returns `HTTP/1.1 200 OK`.
- [x] Existing `cloudflared` container is connected to `vdv-website-network`.
- [ ] Cloudflared tunnel routes to `http://music-generator:80`.

## Automated Validation

### Python Tests
- Command: `pytest`
- Status: Not run on 2026-07-10 because `pytest` is not installed; this repository currently contains no Python test files.

### Browser Automation Tests
- Command: `npx playwright test`
- Status: Passed (3 tests) on 2026-07-10.

## Procedural Percussion

### Acceptance Criteria
- Percussion defaults to Off and does not alter the original sound unless selected.
- Curated procedural kits require no sample assets.
- Fixed, Generative, and Hybrid modes produce stable 16-step patterns.
- Density, mix, dedicated short-reverb return, and swing are user-adjustable.
- A 100% percussion mix provides 20% more bus gain than the original percussion implementation.
- Tuned percussion follows the selected scale.
- Percussion uses a short independent reverb, bypasses delay, and has bus-level dynamics protection.
- Percussion Reverb Mix ranges from dry to a clearly audible wet return; Room Size ranges from 0.35-8.0 seconds.
- Room Size changes stereo pre-delay, early-reflection spacing, and diffuse convolution decay without a resonant feedback-delay loop.

### Test Coverage Checklist
- [x] Kit and rhythm selectors render with safe defaults.
- [x] Selecting a kit/mode and starting playback does not throw.
- [x] Equal seeds produce equal rhythm decisions.
- [ ] Complete manual listening pass across every kit and output device.

## Conductor and Reproducibility

### Acceptance Criteria
- Conductor defaults disabled and is completely optional.
- Forms include Drone, Ballad, Arc, Evolving, and Chaos.
- Patterns remain stable within sections and regenerate at section boundaries.
- Deviation scales all arrangement movement from neutral to chaotic.
- A visible seed reproduces Turing, rhythm, and section decisions.

### Test Coverage Checklist
- [x] Conductor controls render disabled by default.
- [x] A fixed seed reproduces the first generated Turing/rhythm/form decisions.
- [x] Conductor can be enabled and changed during playback without a browser error.

## Device-local Favorites

### Acceptance Criteria
- Favorites save name, mood, vibe, seed, and all UI/engine settings—including percussion and oscillator LFO state—in `localStorage`.
- Favorites can be searched, loaded, and deleted.
- Loading fills the favorite metadata form; updating overwrites the same record, while New Favorite exits edit mode.
- Individual favorites and full collections can be exported/imported as validated, size-limited JSON for sharing.
- `ritual space` is available as a built-in favorite without replacing the quiet startup defaults.
- First save clearly states that storage is on-device, uses no cookies, and performs no tracking.
- Storage failures degrade without crashing the music engine.

### Test Coverage Checklist
- [x] First-save privacy notice is shown.
- [x] Favorite survives reload and can be found by mood.
- [x] Loaded favorite restores the exact seed, non-default percussion kit, and rhythm mode after a page reload.
- [x] Loaded metadata populates the edit form and updates in place without creating a duplicate.
- [x] A single favorite exports to JSON, can be deleted, then imports back with its metadata/settings intact.
- [x] Built-in favorite is visible on a clean browser profile and is clearly labeled.
