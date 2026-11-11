import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { baseLang, installExample, parseVideoRef, pickDefaultTracks } from './example-lib.mjs';

const ID = 'abcdefghijk';
const info = (extra = {}) => ({
  id: ID, title: 'Some video', duration: 60,
  subtitles: {},
  automatic_captions: { 'nl-orig': [{ ext: 'json3', name: 'Dutch (Original)' }], tr: [{ ext: 'json3', name: 'Turkish' }] },
  ...extra,
});

/** Fake yt-dlp: answers the listing, and writes `<id>.<lang>.json3` where the download asks for it. */
function fakeRun(data = info()) {
  const calls = [];
  const run = async (args) => {
    calls.push(args);
    if (args.includes('--dump-single-json')) return { stdout: JSON.stringify(data), stderr: '' };
    const dir = path.dirname(args[args.indexOf('-o') + 1]);
    const lang = args[args.indexOf('--sub-langs') + 1];
    await writeFile(path.join(dir, `${ID}.${lang}.json3`), `{"events":[],"lang":"${lang}"}`);
    return { stdout: '', stderr: '' };
  };
  return { run, calls };
}

let dir;
beforeEach(async () => { dir = await mkdtemp(path.join(tmpdir(), 'balonca-ex-')); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

describe('helpers', () => {
  it('parses links and ids', () => {
    expect(parseVideoRef(`https://www.youtube.com/watch?v=${ID}&t=3`)).toBe(ID);
    expect(parseVideoRef(`https://youtu.be/${ID}`)).toBe(ID);
    expect(parseVideoRef(ID)).toBe(ID);
    for (const bad of ['', 'nope', undefined, `https://youtu.be/${ID}extra`]) expect(parseVideoRef(bad)).toBeNull();
  });
  it('defaults to a human-made track, else the original auto-caption, else nothing', () => {
    const t = [{ code: 'tr', kind: 'auto-translated' }, { code: 'nl-orig', kind: 'auto' }, { code: 'de', kind: 'manual' }];
    expect(pickDefaultTracks(t).map((x) => x.code)).toEqual(['de']);
    expect(pickDefaultTracks(t.slice(0, 2)).map((x) => x.code)).toEqual(['nl-orig']);
    expect(pickDefaultTracks([t[0]])).toEqual([]);
  });
  it('derives the language from a track code', () => {
    expect([baseLang('nl-orig'), baseLang('zh-Hans'), baseLang('TR')]).toEqual(['nl', 'zh', 'tr']);
  });
});

describe('installExample', () => {
  it('does nothing without a configured video', async () => {
    const { run, calls } = fakeRun();
    expect((await installExample({ outDir: dir, run })).status).toBe('no-config');
    expect(calls).toHaveLength(0);
    expect(await readdir(dir)).toEqual([]);
  });

  it('installs the default track and writes the manifest last', async () => {
    const { run } = fakeRun();
    const r = await installExample({ video: `https://youtu.be/${ID}`, outDir: dir, run });
    expect(r.status).toBe('installed');
    expect(r.manifest).toEqual({ videoId: ID, subtitles: [{ file: `${ID}.nl-orig.json3`, lang: 'nl' }] });
    expect((await readdir(dir)).sort()).toEqual([`${ID}.nl-orig.json3`, 'manifest.json']);
    expect(JSON.parse(await readFile(path.join(dir, 'manifest.json'), 'utf8'))).toEqual(r.manifest);
  });

  it('installs the requested tracks in order', async () => {
    const { run } = fakeRun();
    const r = await installExample({ video: ID, langs: ['nl-orig', 'tr'], outDir: dir, run });
    expect(r.manifest.subtitles.map((s) => s.lang)).toEqual(['nl', 'tr']);
  });

  it('is a no-op the second time, and --force downloads again', async () => {
    const a = fakeRun();
    await installExample({ video: ID, outDir: dir, run: a.run });
    const b = fakeRun();
    expect((await installExample({ video: ID, outDir: dir, run: b.run })).status).toBe('already-installed');
    expect(b.calls).toHaveLength(0);
    const c = fakeRun();
    expect((await installExample({ video: ID, outDir: dir, run: c.run, force: true })).status).toBe('installed');
    expect(c.calls.length).toBeGreaterThan(0);
  });

  it('replaces the example when a different video is configured', async () => {
    await installExample({ video: ID, outDir: dir, run: fakeRun().run });
    const other = 'zyxwvutsrqp';
    const run = async (args) => {
      if (args.includes('--dump-single-json')) return { stdout: JSON.stringify({ ...info(), id: other }), stderr: '' };
      const d = path.dirname(args[args.indexOf('-o') + 1]);
      await writeFile(path.join(d, `${other}.nl-orig.json3`), '{}');
      return { stdout: '', stderr: '' };
    };
    const r = await installExample({ video: other, outDir: dir, run });
    expect(r.manifest.videoId).toBe(other);
  });

  it('fails clearly and leaves no manifest behind', async () => {
    await expect(installExample({ video: 'not a video', outDir: dir, run: fakeRun().run })).rejects.toThrow(/not a YouTube link/);
    await expect(installExample({ video: ID, langs: ['xx'], outDir: dir, run: fakeRun().run })).rejects.toThrow(/no subtitle "xx"/);
    await expect(installExample({ video: ID, outDir: dir, run: fakeRun(info({ automatic_captions: {} })).run })).rejects.toThrow(/no subtitles/);
    expect((await readdir(dir)).includes('manifest.json')).toBe(false);
  });
});
