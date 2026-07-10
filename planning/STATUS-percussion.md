# Status: Procedural Percussion

Last updated: 2026-07-10 16:28:05 CDT

## As-built
- Added an optional procedural percussion section; the default kit is `Off`, preserving the original listening experience.
- Added curated kits: Frame & Shaker, Djembe Circle, Middle Eastern, Handpan & Udu, Tongue Drum Meditation, Deep Ritual, Latin Folk, and Ambient Textures.
- Added Generative (Euclidean), Fixed, and Hybrid rhythm modes. Patterns remain stable until settings or arrangement sections change.
- Added density, percussion mix, dedicated percussion reverb return, and swing controls.
- Added synthesized membrane, hand-drum, idiophone, texture, and tuned-percussion voices without sample assets.
- Tuned handpan and tongue-drum hits follow the active scale and root.
- Added a dedicated short percussion reverb and percussion-only dynamics limiter. Percussion bypasses the long delay.
- Raised the percussion mix bus ceiling to 120% of its original range while keeping the UI normalized to 0-100%.
- Corrected the short-reverb audibility: ordinary drums now send at 42%, tuned percussion at 58%, and ambient textures at 75%; the impulse uses an audible 1.1-second room decay instead of collapsing early.
- Exposed proper percussion reverb controls: Reverb Mix adjusts the wet return and Room Size varies the generated room from 0.35-8.0 seconds. Impulse regeneration is debounced during knob movement.
- Replaced the resonant single-delay room with dense stereo convolution: scaled pre-delay, decorrelated/scattered early reflections, and a dark diffuse exponential tail. Dual convolvers crossfade room changes without cutting off the current tail. Around 3 seconds reads as a large hall; the upper range reaches cathedral-scale decay without tube-like comb ringing.
- Added explicit audio-node stop/disconnect cleanup.

## Validation
- `npm run build`: passed.
- `npm run lint`: passed.
- `npx playwright test`: 3 passed.
- Manual listening remains recommended across speakers/headphones because perceived low-end balance is device-dependent.
