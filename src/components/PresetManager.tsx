import { useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { EngineState } from '../audio/AudioEngine';
import {
  acceptStorageNotice, hasAcceptedStorageNotice, loadFavorites, saveFavorites,
  isBuiltInFavorite, parseFavoriteImport, serializeFavorites, type FavoritePreset,
} from '../state/presets';

interface Props {
  captureState: () => EngineState;
  onLoad: (state: EngineState) => void;
}

export function PresetManager({ captureState, onLoad }: Props) {
  const [favorites, setFavorites] = useState(loadFavorites);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [vibe, setVibe] = useState('');
  const [mood, setMood] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [status, setStatus] = useState('');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return favorites;
    return favorites.filter((favorite) =>
      `${favorite.name} ${favorite.vibe} ${favorite.mood}`.toLowerCase().includes(query),
    );
  }, [favorites, search]);

  const persistFavorite = () => {
    if (!name.trim()) {
      setStatus('Give this favorite a name first.');
      return;
    }
    const params = captureState();
    const existing = editingId ? favorites.find((favorite) => favorite.id === editingId) : undefined;
    const favorite: FavoritePreset = {
      id: existing?.id ?? crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      name: name.trim(),
      vibe: vibe.trim(),
      mood: mood.trim(),
      seed: params.seed,
      params,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    const next = existing
      ? favorites.map((saved) => saved.id === existing.id ? favorite : saved)
      : [favorite, ...favorites];
    if (saveFavorites(next)) {
      setFavorites(next);
      setEditingId(favorite.id);
      setStatus(existing ? 'Favorite updated on this device.' : 'Favorite saved on this device.');
    } else {
      setStatus('Local storage is unavailable; the favorite was not saved.');
    }
  };

  const requestSave = () => {
    if (hasAcceptedStorageNotice()) persistFavorite();
    else setNoticeOpen(true);
  };

  const acceptAndSave = () => {
    acceptStorageNotice();
    setNoticeOpen(false);
    persistFavorite();
  };

  const remove = (id: string) => {
    const next = favorites.filter((favorite) => favorite.id !== id);
    if (saveFavorites(next)) {
      setFavorites(next);
      if (editingId === id) startNew();
    }
  };

  const loadForEditing = (favorite: FavoritePreset) => {
    setEditingId(favorite.id);
    setName(favorite.name);
    setMood(favorite.mood);
    setVibe(favorite.vibe);
    setStatus(`Loaded “${favorite.name}” for editing.`);
    onLoad(favorite.params);
  };

  const startNew = () => {
    setEditingId(null);
    setName('');
    setMood('');
    setVibe('');
    setStatus('');
  };

  const exportFavorites = (items: FavoritePreset[], label: string) => {
    const blob = new Blob([serializeFavorites(items)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'favorites';
    link.href = url;
    link.download = `atmospheric-machine-${safeLabel}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus(`Exported ${items.length} favorite${items.length === 1 ? '' : 's'}.`);
  };

  const importFavorites = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const imported = parseFavoriteImport(await file.text());
      const merged = new Map(favorites.map((favorite) => [favorite.id, favorite]));
      imported.forEach((favorite) => merged.set(favorite.id, favorite));
      const next = Array.from(merged.values());
      if (!saveFavorites(next)) throw new Error('Local storage is unavailable.');
      setFavorites(next);
      setStatus(`Imported ${imported.length} favorite${imported.length === 1 ? '' : 's'}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'The favorites import failed.');
    }
  };

  return (
    <section className="preset-panel" aria-label="Favorites">
      <div className="strip-header">
        <div><h3>Favorites</h3><span className="privacy-note">Stored only on this device · no tracking</span></div>
        <div className="favorite-actions">
          <button className="btn compact" type="button" disabled={favorites.length === 0}
            onClick={() => exportFavorites(favorites, 'all-favorites')}>Export all</button>
          <label className="btn compact import-button">
            Import JSON
            <input aria-label="Import favorites file" className="visually-hidden" type="file"
              accept="application/json,.json" onChange={importFavorites} />
          </label>
        </div>
      </div>
      <div className="preset-layout">
        <div className="preset-form">
          {editingId && <div className="editing-badge">Editing saved favorite</div>}
          <input aria-label="Favorite name" className="text-input" placeholder="Name" value={name}
            onChange={(event) => setName(event.target.value)} />
          <input aria-label="Favorite mood" className="text-input" placeholder="Mood" value={mood}
            onChange={(event) => setMood(event.target.value)} />
          <textarea aria-label="Favorite vibe" className="text-input" placeholder="Describe the vibe" value={vibe}
            onChange={(event) => setVibe(event.target.value)} />
          <button className="btn" type="button" onClick={requestSave}>
            {editingId ? 'Update favorite' : 'Save current favorite'}
          </button>
          {editingId && <button className="btn compact" type="button" onClick={startNew}>New favorite</button>}
        </div>
        <div className="favorite-list">
          <input aria-label="Search favorites" className="text-input" placeholder="Search name, mood, or vibe"
            value={search} onChange={(event) => setSearch(event.target.value)} />
          {filtered.length === 0 && <p className="empty-state">No matching favorites yet.</p>}
          {filtered.map((favorite) => (
            <article className="favorite-card" key={favorite.id}>
              <div><strong>{favorite.name}</strong>
                {isBuiltInFavorite(favorite) && <span className="built-in-badge">Built-in</span>}
                <small>{favorite.mood || 'Unspecified mood'} · seed {favorite.seed}</small>
                {favorite.vibe && <p>{favorite.vibe}</p>}</div>
              <div className="favorite-actions">
                <button className="btn compact" type="button" onClick={() => loadForEditing(favorite)}>Load</button>
                <button className="btn compact" type="button"
                  onClick={() => exportFavorites([favorite], favorite.name)}>Export</button>
                {!isBuiltInFavorite(favorite)
                  && <button className="btn compact danger" type="button" onClick={() => remove(favorite.id)}>Delete</button>}
              </div>
            </article>
          ))}
        </div>
      </div>
      {status && <div className="status-message" role="status">{status}</div>}
      {noticeOpen && (
        <div className="notice" role="dialog" aria-modal="true" aria-label="Local storage notice">
          <div className="notice-card">
            <h3>Saved only on this device</h3>
            <p>Atmospheric Machine will store this label, description, mood, seed, and synth settings in your browser's local storage. Nothing is sent to us, there are no cookies, and this is not used for tracking.</p>
            <div className="favorite-actions">
              <button className="btn primary" type="button" onClick={acceptAndSave}>Save on this device</button>
              <button className="btn" type="button" onClick={() => setNoticeOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
