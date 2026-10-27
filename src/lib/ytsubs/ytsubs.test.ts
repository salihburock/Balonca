import { describe, expect, it, vi, afterEach } from 'vitest';
import { filterTracks, countKinds, fold, type RemoteTrack } from './filter';
import { displayLanguage } from '../languages';

const tracks: RemoteTrack[] = [
  { code: 'nl-orig', name: 'Dutch (Original)', kind: 'auto' },
  { code: 'tr', name: 'Turkish', kind: 'auto-translated' },
  { code: 'en', name: 'English', kind: 'auto-translated' },
  { code: 'zh-Hans', name: 'Chinese (Simplified)', kind: 'auto-translated' },
  { code: 'de', name: 'German', kind: 'manual' },
];
const codes = (r: RemoteTrack[]) => r.map((t) => t.code);

describe('displayLanguage', () => {
  it('names languages in Turkish and English', () => {
    expect(displayLanguage('nl', 'tr')).toBe('Felemenkçe');
    expect(displayLanguage('nl', 'en')).toBe('Dutch');
    expect(displayLanguage('tr', 'tr')).toBe('Türkçe');
    expect(displayLanguage('tr', 'en')).toBe('Turkish');
  });
  it('ignores the -orig suffix and handles script variants', () => {
    expect(displayLanguage('nl-orig', 'en')).toBe('Dutch');
    expect(displayLanguage('zh-Hans', 'en')).toMatch(/Chinese/);
  });
  it('covers languages outside our small table', () => {
    expect(displayLanguage('sw', 'en')).toBe('Swahili');
    expect(displayLanguage('sw', 'tr')).toMatch(/^Svahili/);
  });
  it('returns unknown or invalid codes unchanged', () => {
    expect(displayLanguage('??', 'tr')).toBe('??');
    expect(displayLanguage('x-custom', 'en')).toBe('x-custom');
  });
});

describe('filterTracks', () => {
  it('matches the code, the YouTube name and both UI languages', () => {
    expect(codes(filterTracks(tracks, { query: 'nl' }))).toEqual(['nl-orig']);
    expect(codes(filterTracks(tracks, { query: 'felemenk' }))).toEqual(['nl-orig']);
    expect(codes(filterTracks(tracks, { query: 'dutch' }))).toEqual(['nl-orig']);
    expect(codes(filterTracks(tracks, { query: 'Almanca' }))).toEqual(['de']);
    expect(codes(filterTracks(tracks, { query: 'german' }))).toEqual(['de']);
  });
  it('ignores accents and Turkish dotted/dotless i', () => {
    expect(codes(filterTracks(tracks, { query: 'turkce' }))).toEqual(['tr']);
    expect(codes(filterTracks(tracks, { query: 'TÜRKÇE' }))).toEqual(['tr']);
    expect(fold('İstanbul ığ')).toBe('istanbul ig');
  });
  it('requires every word and combines with the kind filter', () => {
    expect(codes(filterTracks(tracks, { query: 'chinese simplified' }))).toEqual(['zh-Hans']);
    expect(filterTracks(tracks, { query: 'chinese german' })).toEqual([]);
    expect(codes(filterTracks(tracks, { kind: 'auto-translated', query: 'e' }))).toEqual(['tr', 'en', 'zh-Hans']);
    expect(codes(filterTracks(tracks, { kind: 'manual' }))).toEqual(['de']);
  });
  it('empty query returns everything and counts kinds', () => {
    expect(filterTracks(tracks, {})).toHaveLength(5);
    expect(countKinds(tracks)).toEqual({ all: 5, manual: 1, auto: 1, 'auto-translated': 3 });
  });
});

describe('api client', () => {
  afterEach(() => vi.unstubAllGlobals());
  const stub = (fn: () => Promise<Response>) => vi.stubGlobal('fetch', vi.fn(fn));

  it('lists tracks', async () => {
    stub(async () => new Response(JSON.stringify({ id: 'x', title: 't', duration: 1, tracks }), { status: 200 }));
    const { listRemoteSubs } = await import('./api');
    expect((await listRemoteSubs('abcdefghijk')).tracks).toHaveLength(5);
  });
  it.each([[503, { error: 'bot-check' }, 'bot-check'], [503, { error: 'yt-rate-limit' }, 'yt-rate-limit'], [404, { error: 'no-subs' }, 'no-subs'], [500, { error: 'weird' }, 'failed']])(
    'maps %i %j to %s', async (status, body, code) => {
      stub(async () => new Response(JSON.stringify(body), { status }));
      const { fetchRemoteSub } = await import('./api');
      await expect(fetchRemoteSub('abcdefghijk', tracks[0])).rejects.toMatchObject({ code });
    });
  it('treats an HTML answer or a network failure as "service not reachable"', async () => {
    const { listRemoteSubs } = await import('./api');
    stub(async () => new Response('<html></html>', { status: 404 }));
    await expect(listRemoteSubs('abcdefghijk')).rejects.toMatchObject({ code: 'unreachable' });
    stub(async () => new Response('<html></html>', { status: 200 }));
    await expect(listRemoteSubs('abcdefghijk')).rejects.toMatchObject({ code: 'unreachable' });
    stub(async () => { throw new TypeError('offline'); });
    await expect(listRemoteSubs('abcdefghijk')).rejects.toMatchObject({ code: 'unreachable' });
  });
  it('asks for manual vs auto tracks', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', f);
    const { fetchRemoteSub } = await import('./api');
    await fetchRemoteSub('abcdefghijk', tracks[4]);
    await fetchRemoteSub('abcdefghijk', tracks[0]);
    const urls = f.mock.calls.map((c) => (c as unknown as [string])[0]);
    expect(urls[0]).toBe('/api/sub?v=abcdefghijk&lang=de&kind=manual');
    expect(urls[1]).toBe('/api/sub?v=abcdefghijk&lang=nl-orig&kind=auto');
  });
});
