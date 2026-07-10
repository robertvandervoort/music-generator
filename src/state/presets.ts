import type { EngineState } from '../audio/AudioEngine';

export interface FavoritePreset {
  id: string;
  name: string;
  vibe: string;
  mood: string;
  seed: string;
  params: EngineState;
  createdAt: string;
}

const STORAGE_KEY = 'atmospheric-machine:favorites:v1';
const NOTICE_KEY = 'atmospheric-machine:privacy-notice:v1';
const EXPORT_KIND = 'atmospheric-machine-favorites';
const MAX_IMPORT_BYTES = 2_000_000;
const MAX_IMPORT_FAVORITES = 200;

export const BUILT_IN_FAVORITES: FavoritePreset[] = [{
  id: '1783717966694-0.40921823360113063',
  name: 'ritual space',
  vibe: 'driving music with a spacey vibe. the dude on shrooms.',
  mood: 'driven',
  seed: 'ibbssf-p404v7',
  params: {
    seed: 'ibbssf-p404v7',
    bpm: 70,
    probability: 0.1,
    scale: 'Minor Pentatonic',
    kit: 'Deep Ritual',
    rhythmMode: 'Hybrid',
    density: 0.35,
    percussionMix: 1,
    percussionReverbMix: 0.7028568522135417,
    percussionReverbRoomSize: 8,
    swing: 0.04,
    conductorEnabled: true,
    conductorForm: 'Arc',
    deviation: 0.28,
    sectionBars: 8,
    delayFeedback: 0.5,
    delayMix: 0.5,
    reverbMix: 0.25,
    voices: [
      {
        waveform: 'square', filterType: 'lowpass', cutoff: 1200, resonance: 1,
        attack: 0.05, decay: 0.2, release: 0.5, volume: 0.16238087972005208,
        lfoEnabled: false, lfoRate: 0.5,
      },
      {
        waveform: 'sawtooth', filterType: 'lowpass', cutoff: 600, resonance: 2,
        attack: 0.5, decay: 0.5, release: 2, volume: 0.11190470377604166,
        lfoEnabled: true, lfoRate: 0.5,
      },
    ],
  },
  createdAt: '2026-07-10T21:12:46.694Z',
}];

interface FavoriteExport {
  kind: typeof EXPORT_KIND;
  version: 1;
  exportedAt: string;
  favorites: FavoritePreset[];
}

export function loadFavorites(): FavoritePreset[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    const saved = Array.isArray(parsed) ? parsed as FavoritePreset[] : [];
    const merged = new Map(BUILT_IN_FAVORITES.map((favorite) => [favorite.id, favorite]));
    saved.forEach((favorite) => merged.set(favorite.id, favorite));
    return Array.from(merged.values());
  } catch {
    return [...BUILT_IN_FAVORITES];
  }
}

export function saveFavorites(favorites: FavoritePreset[]): boolean {
  try {
    const localOnly = favorites.filter((favorite) => {
      const builtIn = BUILT_IN_FAVORITES.find((candidate) => candidate.id === favorite.id);
      return !builtIn || JSON.stringify(builtIn) !== JSON.stringify(favorite);
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(localOnly));
    return true;
  } catch {
    return false;
  }
}

export function isBuiltInFavorite(favorite: FavoritePreset): boolean {
  return BUILT_IN_FAVORITES.some((candidate) => candidate.id === favorite.id);
}

export function hasAcceptedStorageNotice(): boolean {
  try {
    return localStorage.getItem(NOTICE_KEY) === 'accepted';
  } catch {
    return false;
  }
}

export function acceptStorageNotice(): void {
  try {
    localStorage.setItem(NOTICE_KEY, 'accepted');
  } catch {
    // Saving will report unavailable storage separately.
  }
}

export function serializeFavorites(favorites: FavoritePreset[]): string {
  const bundle: FavoriteExport = {
    kind: EXPORT_KIND,
    version: 1,
    exportedAt: new Date().toISOString(),
    favorites,
  };
  return JSON.stringify(bundle, null, 2);
}

export function parseFavoriteImport(text: string): FavoritePreset[] {
  if (new Blob([text]).size > MAX_IMPORT_BYTES) throw new Error('Import file is larger than 2 MB.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  const candidate = parsed as { kind?: unknown; version?: unknown; favorites?: unknown };
  if (candidate.kind !== EXPORT_KIND || candidate.version !== 1 || !Array.isArray(candidate.favorites)) {
    throw new Error('That is not an Atmospheric Machine favorites export.');
  }
  if (candidate.favorites.length > MAX_IMPORT_FAVORITES) {
    throw new Error(`An import can contain at most ${MAX_IMPORT_FAVORITES} favorites.`);
  }
  return candidate.favorites.map((favorite, index) => validateFavorite(favorite, index));
}

function validateFavorite(value: unknown, index: number): FavoritePreset {
  if (!value || typeof value !== 'object') throw new Error(`Favorite ${index + 1} is invalid.`);
  const favorite = value as Partial<FavoritePreset>;
  if (
    typeof favorite.id !== 'string' || favorite.id.length > 100
    || typeof favorite.name !== 'string' || !favorite.name.trim() || favorite.name.length > 120
    || typeof favorite.vibe !== 'string' || favorite.vibe.length > 2000
    || typeof favorite.mood !== 'string' || favorite.mood.length > 120
    || typeof favorite.seed !== 'string' || favorite.seed.length > 200
    || typeof favorite.createdAt !== 'string'
    || !favorite.params || typeof favorite.params !== 'object'
  ) {
    throw new Error(`Favorite ${index + 1} has missing or invalid fields.`);
  }
  return favorite as FavoritePreset;
}
