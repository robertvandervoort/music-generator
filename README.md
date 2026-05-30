# Atmospheric Machine 01

A web-based digital generative music machine built with React, Vite, and the Web Audio API. 
This application uses mathematical algorithms (specifically a Turing Machine shift register) to create evolving, non-deterministic melodies and lush soundscapes without the use of any AI or Machine Learning.

## Features
- **Turing Sequencer**: A 16-bit shift register algorithm with probability controls for organic, morphing sequences.
- **Scale Quantizer**: Over a dozen selectable scales to constrain the randomness to beautiful harmonies (Major, Minor, Dorian, Pentatonics, etc.).
- **Dual Oscillator Synth**: Independent voices (Pluck and Pad) with Waveform selection, Filter types, ADR envelopes, and LFO automation.
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

## License

**Copyright &copy; 2026 VDV Labs Inc. All rights reserved.**

This project is distributed freely using an attribution-based license for non-commercial use only. See the `LICENSE` file for more details.
