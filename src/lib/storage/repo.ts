import type { SavedWord, StoredTrack } from '../types';
import { DEFAULT_SETTINGS, sanitizeSettings, type Settings } from '../settings';
import type { Db } from './db';

export async function loadSettings(db: Db): Promise<Settings> {
  return sanitizeSettings((await db.get('meta', 'settings')) ?? DEFAULT_SETTINGS);
}
export const saveSettings = (db: Db, s: Settings) => db.put('meta', { ...s }, 'settings');

export async function getLastVideo(db: Db): Promise<string | null> {
  const v = await db.get('meta', 'lastVideo');
  return typeof v === 'string' ? v : null;
}
export const setLastVideo = (db: Db, id: string) => db.put('meta', id, 'lastVideo');

export const loadWords = (db: Db): Promise<SavedWord[]> => db.getAll('words');
// $state proxies can't be structured-cloned, so always store plain copies.
export const putWord = (db: Db, w: SavedWord) => db.put('words', { ...w });
export const deleteWord = (db: Db, id: string) => db.delete('words', id);

export async function deleteLanguage(db: Db, lang: string): Promise<void> {
  const tx = db.transaction('words', 'readwrite');
  for (const key of await tx.store.index('byLang').getAllKeys(lang)) await tx.store.delete(key);
  await tx.done;
}

export const loadTracks = (db: Db, vid: string): Promise<StoredTrack[]> => db.getAllFromIndex('tracks', 'byVideo', vid);

/** Replaces all tracks of one video atomically. */
export async function saveTracks(db: Db, vid: string, tracks: StoredTrack[]): Promise<void> {
  const tx = db.transaction('tracks', 'readwrite');
  const keep = new Set(tracks.map((t) => t.id));
  for (const key of await tx.store.index('byVideo').getAllKeys(vid)) if (!keep.has(key)) await tx.store.delete(key);
  for (const t of tracks) await tx.store.put(JSON.parse(JSON.stringify({ ...t, vid })));
  await tx.done;
}

export async function listVideos(db: Db): Promise<{ vid: string; tracks: number }[]> {
  const counts = new Map<string, number>();
  for (const t of await db.getAll('tracks')) counts.set(t.vid, (counts.get(t.vid) ?? 0) + 1);
  return [...counts].map(([vid, tracks]) => ({ vid, tracks }));
}
