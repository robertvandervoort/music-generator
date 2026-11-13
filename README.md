# Atmospheric Machine 01

A web-based digital generative music machine built with React, Vite, and the Web Audio API. 
This application uses mathematical algorithms (specifically a Turing Machine shift register) to create evolving, non-deterministic melodies and lush soundscapes without the use of any AI or Machine Learning.

## Features
- **Turing Sequencer**: A 16-bit shift register algorithm with probability controls for organic, morphing sequences.
- **Scale Quantizer**: Over a dozen selectable scales to constrain the randomness to beautiful harmonies (Major, Minor, Dorian, Pentatonics, etc.).
- **Dual Oscillator Synth**: Independent voices (Pluck and Pad) with Waveform selection, Filter types, ADR envelopes, and LFO automation.
- **Procedural Percussion**: Selectable hand-drum, folk-percussion, tuned idiophone, and ambient-texture kits with Fixed, Euclidean, and Hybrid rhythm modes—no samples required.
- **Optional Conductor**: Drone, Ballad, Arc, Evolving, and Chaos forms create stable sections, call-and-response, crescendos, and resolutions without taking away manual control.
- **Reproducible Seeds**: Visible seeds reproduce the machine's musical decisions and arrangement journey.
- **Device-local Favorites**: Save, describe, search, and reload complete settings in browser local storage. Favorites are not uploaded and do not use cookies.
- **Master FX**: Parallel Delay and Reverb buses.
- **Interactive UI**: Custom rotary knobs, glowing LED state visualizers, and real-time oscilloscopes.

## Running Locally

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## Validation

```bash
npm run build
npm run lint
npx playwright test
```

## Running With Docker (for cloudflared)

This project can be served as a production container on a shared Docker network so a `cloudflared` container can reach it by container name.

1. Build and start the app container:
   ```bash
   docker compose up -d --build
   ```
2. Verify the app is reachable from the shared Docker network:
   ```bash
   docker run --rm --network vdv-website-network curlimages/curl:8.8.0 -sI http://music-generator:80
   ```
3. Point `cloudflared` to the app over Docker DNS:
   - URL: `http://music-generator:80`
   - Network: `vdv-shared-network` (external network name: `vdv-website-network`)

If your `cloudflared` container is managed separately, attach it to the same shared network:
```bash
docker network connect vdv-website-network <your-cloudflared-container-name>
```

## Browser RUM and visitor country

nginx serves the built site. It writes JSON access logs that keep the referer and add request time plus Cloudflare country, region, and city. `CF-IPCountry` and `cf-region` are written into the `cf-country` and `cf-region` meta tags on each HTML response. `POST /rum/trace` is proxied to `http://otel-collector:4318/v1/traces` with a 64 KB body limit. The collector hostname is resolved at request time on the Docker network `vdv-website-network`.

The browser service name is `turingmusic-web-rum`. It records page views (first load and later route changes), foreground engagement, LCP, CLS, INP, JavaScript errors, and generate / play / download actions when those controls are used. Attributes include route, first-touch referrer hostname (`direct` when there is none), first-touch utm source / medium / campaign (`none` when absent), landing route, country, region, and a session id kept in `sessionStorage`. AI assistant referrals from chatgpt.com, perplexity.ai, gemini.google.com, copilot.microsoft.com, and claude.ai are stored as that hostname. Do Not Track skips collection. Set `VITE_RUM_SAMPLE_RATE` between `0` and `1` at image build time (default `1`).

Page views by source and landing route:

```promql
sum by (rum_referrer, rum_utm_source, rum_landing_route) (increase(traces_span_metrics_calls_total{service_name="turingmusic-web-rum",span_name="page_view"}[1d]))
```

## License

**Copyright &copy; 2026 VDV Labs Inc. All rights reserved.**

This project is distributed freely using an attribution-based license for non-commercial use only. See the `LICENSE` file for more details.
