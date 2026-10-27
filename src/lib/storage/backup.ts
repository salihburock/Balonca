import type { SavedWord, StoredTrack } from '../types';
import { sanitizeSettings, type Settings } from '../settings';
import { loadSettings, loadWords, getLastVideo } from './repo';
import type { Db } from './db';

export const BACKUP_VERSION = 1;

export interface Backup {
  app: 'balonca';
  version: number;
  exportedAt: string;
  settings: Settings;
  words: SavedWord[];
  tracks: StoredTrack[];
  lastVideo: string | null;
}

export class BackupError extends Error {
  constructor(public readonly code: 'invalid-json' | 'not-backup' | 'too-new') {
    super(code);
    this.name = 'BackupError';
  }
}

export async function exportBackup(db: Db): Promise<Backup> {
  return {
    app: 'balonca', version: BACKUP_VERSION, exportedAt: new Date().toISOString(),
    settings: await loadSettings(db), words: await loadWords(db),
    tracks: await db.getAll('tracks'), lastVideo: await getLastVideo(db),
  };
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function cleanWord(x: any): SavedWord | null {
  if (!x || !isStr(x.w) || !isStr(x.lang) || !x.w || !x.lang) return null;
  return {
    id: `${x.lang}:${x.w}`, w: x.w, lang: x.lang, ctx: isStr(x.ctx) ? x.ctx : '',
    vid: isStr(x.vid) ? x.vid : undefined, t: isNum(x.t) ? x.t : 0, added: isNum(x.added) ? x.added : Date.now(),
    reps: isNum(x.reps) ? x.reps : 0, ivl: isNum(x.ivl) ? x.ivl : 0, ease: isNum(x.ease) ? x.ease : 2.5,
    lapses: isNum(x.lapses) ? x.lapses : 0, due: isNum(x.due) ? x.due : undefined,
  };
}

function cleanTrack(x: any): StoredTrack | null {
  if (!x || !isStr(x.id) || !isStr(x.vid) || !Array.isArray(x.cues)) return null;
  const cues = x.cues
    .filter((c: any) => c && isNum(c.start) && isNum(c.end) && isStr(c.text))
    .map((c: any) => ({ start: c.start, end: c.end, text: c.text }));
  return {
    id: x.id, vid: x.vid, name: isStr(x.name) ? x.name : '', lang: isStr(x.lang) ? x.lang : '??',
    label: isStr(x.label) ? x.label : isStr(x.lang) ? x.lang : '', color: isStr(x.color) && /^#[0-9a-f]{3,8}$/i.test(x.color) ? x.color : '#a995ff',
    visible: x.visible !== false, offset: isNum(x.offset) ? x.offset : 0, cues,
  };
}

/** Parses and validates a backup file. Never trusts its contents: every field is re-checked. */
export function parseBackup(text: string): Backup {
  let data: any;
  try { data = JSON.parse(text.replace(/^﻿/, '')); } catch { throw new BackupError('invalid-json'); }
  if (!data || data.app !== 'balonca' || !Array.isArray(data.words) || !Array.isArray(data.tracks)) throw new BackupError('not-backup');
  if (!isNum(data.version) || data.version > BACKUP_VERSION) throw new BackupError('too-new');
  return {
    app: 'balonca', version: BACKUP_VERSION, exportedAt: isStr(data.exportedAt) ? data.exportedAt : '',
    settings: sanitizeSettings(data.settings),
    words: data.words.map(cleanWord).filter((w: SavedWord | null): w is SavedWord => !!w),
    tracks: data.tracks.map(cleanTrack).filter((t: StoredTrack | null): t is StoredTrack => !!t),
    lastVideo: isStr(data.lastVideo) ? data.lastVideo : null,
  };
}

/**
 * 'replace' wipes current data first; 'merge' keeps existing words (progress is not overwritten)
 * and adds anything missing, with imported tracks replacing same-id tracks.
 */
export async function importBackup(db: Db, b: Backup, mode: 'replace' | 'merge'): Promise<{ words: number; tracks: number }> {
  const tx = db.transaction(['meta', 'words', 'tracks'], 'readwrite');
  if (mode === 'replace') await Promise.all([tx.objectStore('words').clear(), tx.objectStore('tracks').clear()]);

  let words = 0;
  for (const w of b.words) {
    if (mode === 'merge' && (await tx.objectStore('words').get(w.id))) continue;
    await tx.objectStore('words').put(w);
    words++;
  }
  for (const t of b.tracks) await tx.objectStore('tracks').put(t);
  if (mode === 'replace') {
    await tx.objectStore('meta').put({ ...b.settings }, 'settings');
    if (b.lastVideo) await tx.objectStore('meta').put(b.lastVideo, 'lastVideo');
  }
  await tx.done;
  return { words, tracks: b.tracks.length };
}
