# Status: Conductor, Seeds, and Favorites

Last updated: 2026-07-10 16:54:14 CDT

## As-built
- Added an optional Conductor; it defaults off and applies no modulation unless enabled.
- Added Drone, Ballad, Arc, Evolving, and Chaos forms with bar-level sections and smoothed intensity changes.
- Added Deviation and section-length controls. User controls remain the baseline; Conductor changes are effective-value offsets.
- Rhythm regeneration occurs at section boundaries rather than every bar, preserving rhythmic stability.
- Added visible editable seeds and seeded generation for Turing initialization/flips, rhythm decisions, Conductor choices, and hit humanization.
- Added device-local Favorites with name, mood, vibe, search, load, and delete.
- Favorites use `localStorage`, never cookies. The first save presents a clear no-tracking/on-device-only notice.
- Presets capture canonical UI values for the seed, generator settings, effects, percussion, Conductor, and both synth voices—including LFO enable/rate.
- Preset loading merges older saved records with safe current defaults, then restores percussion and seed state before remounting voice controls.
- Loading a favorite also fills its name, mood, and vibe into the editor and enters edit mode. `Update favorite` overwrites the same local record; `New favorite` exits edit mode to prevent accidental overwrites.
- Added portable JSON sharing: each favorite can be exported separately, all favorites can be exported as a bundle, and either format can be imported. Imports are schema-checked, limited to 2 MB/200 favorites, and merged by favorite ID.
- Added `ritual space` as a built-in favorite (Deep Ritual / Hybrid / Arc, seed `ibbssf-p404v7`). It appears without changing quiet startup defaults, can be loaded/exported/customized locally, and an untouched copy consumes no local storage.

## Reproducibility boundary
- A seed reproduces musical decisions and form progression.
- Browser scheduling and unseeded generated reverb impulses mean rendered audio is not promised to be sample-identical.

## Validation
- Playwright verifies seeded decision reproducibility, optional defaults, runtime control changes, privacy notice, and local favorite round-tripping with a non-default percussion kit, rhythm mode, and explicit seed.
