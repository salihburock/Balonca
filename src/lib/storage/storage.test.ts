import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  openBalonca, loadWords, putWord, deleteWord, deleteLanguage, loadTracks, saveTracks, listVideos,
  loadSettings, saveSettings, exportBackup, parseBackup, importBackup, BackupError, migrateLegacy,
} from './index';
import { makeWord } from '../words/bags';
import { DEFAULT_SETTINGS } from '../settings';
import type { StoredTrack } from '../types';

let n = 0;
const fresh = () => openBalonca(`test-${++n}-${Math.random()}`);
const track = (id: string, vid: string): StoredTrack => ({
  id, vid, name: 'a.srt', lang: 'nl', label: 'Dutch', color: '#fff', visible: true, offset: 0.2,
  cues: [{ start: 1, end: 2, text: 'hoi' }],
});
const word = (w: string, lang = 'nl') => makeWord({ lang, word: w, ctx: 'x', vid: 'vid12345678', t: 3, now: 5 });

describe('repo', () => {
  let db: Awaited<ReturnType<typeof fresh>>;
  beforeEach(async () => { db = await fresh(); });

  it('settings default and round-trip', async () => {
    expect(await loadSettings(db)).toEqual(DEFAULT_SETTINGS);
    await saveSettings(db, { ...DEFAULT_SETTINGS, subSize: 40, theme: 'dark' });
    expect(await loadSettings(db)).toMatchObject({ subSize: 40, theme: 'dark' });
  });
  it('words: put, upsert, delete, delete by language', async () => {
    await putWord(db, word('huis'));
    await putWord(db, { ...word('huis'), ivl: 4 });
    await putWord(db, word('boom'));
    await putWord(db, word('ev', 'tr'));
    expect(await loadWords(db)).toHaveLength(3);
    await deleteWord(db, 'nl:boom');
    await deleteLanguage(db, 'tr');
    const left = await loadWords(db);
    expect(left.map((w) => w.id)).toEqual(['nl:huis']);
    expect(left[0].ivl).toBe(4);
  });
  it('tracks are per video and saveTracks replaces atomically', async () => {
    await saveTracks(db, 'v1', [track('a', 'v1'), track('b', 'v1')]);
    await saveTracks(db, 'v2', [track('c', 'v2')]);
    await saveTracks(db, 'v1', [track('b', 'v1')]);
    expect((await loadTracks(db, 'v1')).map((t) => t.id)).toEqual(['b']);
    expect(await listVideos(db)).toEqual(expect.arrayContaining([{ vid: 'v1', tracks: 1 }, { vid: 'v2', tracks: 1 }]));
  });
  it('stores large tracks', async () => {
    const big = { ...track('big', 'v9'), cues: Array.from({ length: 20000 }, (_, i) => ({ start: i, end: i + 1, text: 'woord ' + i })) };
    await saveTracks(db, 'v9', [big]);
    expect((await loadTracks(db, 'v9'))[0].cues).toHaveLength(20000);
  });
});

describe('backup', () => {
  it('exports everything and re-imports it into an empty db', async () => {
    const a = await fresh();
    await saveSettings(a, { ...DEFAULT_SETTINGS, subStyle: 'outline' });
    await putWord(a, word('huis'));
    await saveTracks(a, 'v1', [track('t1', 'v1')]);
    const json = JSON.stringify(await exportBackup(a));

    const b = await fresh();
    const res = await importBackup(b, parseBackup(json), 'replace');
    expect(res).toEqual({ words: 1, tracks: 1 });
    expect((await loadSettings(b)).subStyle).toBe('outline');
    expect((await loadWords(b))[0].id).toBe('nl:huis');
    expect((await loadTracks(b, 'v1'))[0].cues[0].text).toBe('hoi');
  });
  it('merge keeps existing review progress and adds missing words', async () => {
    const db = await fresh();
    await putWord(db, { ...word('huis'), ivl: 10 });
    const incoming = parseBackup(JSON.stringify({
      app: 'balonca', version: 1, words: [word('huis'), word('boom')], tracks: [], settings: {},
    }));
    expect(await importBackup(db, incoming, 'merge')).toEqual({ words: 1, tracks: 0 });
    const all = await loadWords(db);
    expect(all).toHaveLength(2);
    expect(all.find((w) => w.id === 'nl:huis')!.ivl).toBe(10);
  });
  it('rejects non-backups and newer versions', () => {
    const code = (s: string) => { try { parseBackup(s); } catch (e) { return (e as BackupError).code; } };
    expect(code('nope')).toBe('invalid-json');
    expect(code('{"a":1}')).toBe('not-backup');
    expect(code('{"app":"balonca","version":99,"words":[],"tracks":[]}')).toBe('too-new');
  });
  it('drops malformed entries and sanitizes hostile values', () => {
    const b = parseBackup(JSON.stringify({
      app: 'balonca', version: 1,
      settings: { subSize: 9999, theme: '<script>' },
      words: [{ w: 'ok', lang: 'nl' }, { w: 5 }, null],
      tracks: [{ id: 't', vid: 'v', color: 'red;background:url(x)', cues: [{ start: 1, end: 2, text: 'a' }, { start: 'x' }] }],
    }));
    expect(b.words).toHaveLength(1);
    expect(b.settings.subSize).toBe(48);
    expect(b.settings.theme).toBe('auto');
    expect(b.tracks[0].cues).toHaveLength(1);
    expect(b.tracks[0].color).toBe('#a995ff');
  });
});

describe('legacy migration', () => {
  const legacy = {
    set: { theme: 'dark', lang: 'en', size: 30, bg: 40, pause: false, scroll: true, hide2: true, ap: true },
    bags: { Felemenkçe: [{ w: 'huis', ctx: 'groot huis', vid: 'abcdefghijk', t: 12, ivl: 3, due: 123 }], Türkçe: [{ w: 'ev', ctx: '', t: 0 }] },
    vids: { abcdefghijk: [{ id: 1.5, name: 'v.nl.json3', lang: 'Felemenkçe', color: '#ffb020', visible: true, offset: 0.4, lines: [{ start: 1, end: 2, text: 'hoi' }] }] },
    last: 'abcdefghijk',
  };
  it('converts state in memory', () => {
    const m = migrateLegacy(legacy);
    expect(m.settings).toMatchObject({ theme: 'dark', locale: 'en', subSize: 30, hideSecondary: true, autoPause: true, pauseOnSave: false });
    expect(m.words.map((w) => w.id).sort()).toEqual(['nl:huis', 'tr:ev']);
    expect(m.words.find((w) => w.id === 'nl:huis')).toMatchObject({ ivl: 3, reps: 1, due: 123 });
    expect(m.tracks[0]).toMatchObject({ vid: 'abcdefghijk', lang: 'nl', label: 'Felemenkçe', offset: 0.4 });
    expect(m.lastVideo).toBe('abcdefghijk');
  });
  it('tolerates garbage', () => {
    expect(migrateLegacy(null).words).toEqual([]);
    expect(migrateLegacy({ bags: { x: 'no' }, vids: { y: [null] } }).tracks).toEqual([]);
  });
  it('upgrades a real v1 database on open', async () => {
    const name = `legacy-${Math.random()}`;
    const v1 = await openDB(name, 1, { upgrade: (d) => { d.createObjectStore('k'); } });
    await v1.put('k', legacy, 'state');
    v1.close();

    const db = await openBalonca(name);
    expect((await loadWords(db)).map((w) => w.id).sort()).toEqual(['nl:huis', 'tr:ev']);
    expect((await loadTracks(db, 'abcdefghijk'))).toHaveLength(1);
    expect((await loadSettings(db)).locale).toBe('en');
    expect(await db.get('k', 'state')).toBeTruthy(); // legacy blob kept as a safety net
  });
});
