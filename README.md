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
- **Device-local Favorites**: Save, describe, search, and reload complete settings in browser local storage. No cookies, server upload, or tracking.
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

## License

**Copyright &copy; 2026 VDV Labs Inc. All rights reserved.**

This project is distributed freely using an attribution-based license for non-commercial use only. See the `LICENSE` file for more details.
