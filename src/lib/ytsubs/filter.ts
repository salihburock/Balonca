import { displayLanguage } from '../languages';

export type SubKind = 'manual' | 'auto' | 'auto-translated';
export interface RemoteTrack { code: string; name: string; kind: SubKind }
export type KindFilter = 'all' | SubKind;

/** Lowercase and strip accents so "turkce" finds "Türkçe" and "istanbul" finds "İstanbul". */
export const fold = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');

const haystackCache = new Map<string, string>();
function haystack(t: RemoteTrack): string {
  const key = `${t.code}|${t.name}`;
  let h = haystackCache.get(key);
  if (h === undefined) {
    const base = t.code.replace(/-orig$/i, '');
    h = fold([t.code, base, t.name, displayLanguage(t.code, 'tr'), displayLanguage(t.code, 'en')].join(' '));
    haystackCache.set(key, h);
  }
  return h;
}

/** Every word of the query must appear in the code or in the Turkish, English or YouTube name. */
export function filterTracks(tracks: RemoteTrack[], opts: { query?: string; kind?: KindFilter }): RemoteTrack[] {
  const words = fold(opts.query ?? '').split(/\s+/).filter(Boolean);
  return tracks.filter((t) => (!opts.kind || opts.kind === 'all' || t.kind === opts.kind) && words.every((w) => haystack(t).includes(w)));
}

export const countKinds = (tracks: RemoteTrack[]): Record<KindFilter, number> => ({
  all: tracks.length,
  manual: tracks.filter((t) => t.kind === 'manual').length,
  auto: tracks.filter((t) => t.kind === 'auto').length,
  'auto-translated': tracks.filter((t) => t.kind === 'auto-translated').length,
});
