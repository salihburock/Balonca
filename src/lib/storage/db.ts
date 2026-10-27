import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { SavedWord, StoredTrack } from '../types';
import { migrateLegacy } from './legacy';

export interface BalonDB extends DBSchema {
  /** Legacy single-blob store from the first prototype (v1). Left untouched after migration as a safety net. */
  k: { key: string; value: unknown };
  meta: { key: string; value: unknown };
  words: { key: string; value: SavedWord; indexes: { byLang: string } };
  tracks: { key: string; value: StoredTrack; indexes: { byVideo: string } };
}

export type Db = IDBPDatabase<BalonDB>;
export const DB_NAME = 'balonca';
export const DB_VERSION = 2;

export function openBalonca(name = DB_NAME): Promise<Db> {
  return openDB<BalonDB>(name, DB_VERSION, {
    async upgrade(db, oldVersion, _newVersion, tx) {
      db.createObjectStore('meta');
      db.createObjectStore('words', { keyPath: 'id' }).createIndex('byLang', 'lang');
      db.createObjectStore('tracks', { keyPath: 'id' }).createIndex('byVideo', 'vid');

      // Same database name as legacy/balonca.html: carry its data over inside this one atomic upgrade.
      if (oldVersion === 1 && db.objectStoreNames.contains('k')) {
        const state = await tx.objectStore('k').get('state');
        if (state) {
          const m = migrateLegacy(state);
          await tx.objectStore('meta').put(m.settings, 'settings');
          if (m.lastVideo) await tx.objectStore('meta').put(m.lastVideo, 'lastVideo');
          for (const w of m.words) await tx.objectStore('words').put(w);
          for (const t of m.tracks) await tx.objectStore('tracks').put(t);
        }
      }
    },
  });
}
