import type { SavedWord, StoredTrack } from '../types';
import { DEFAULT_SETTINGS, sanitizeSettings, type Settings } from '../settings';
import { LANGUAGES } from '../languages';
import { makeWord } from '../words/bags';

export interface Migrated {
  settings: Settings;
  words: SavedWord[];
  tracks: StoredTrack[];
  lastVideo: string | null;
}

/** The first prototype grouped bags by the language *name* ("Felemenkçe"); map those back to codes. */
const NAME_TO_CODE = new Map<string, string>(
  Object.entries(LANGUAGES).flatMap(([code, l]) => [[l.tr.toLowerCase(), code] as const, [l.en.toLowerCase(), code] as const]),
);
const toCode = (name: unknown): string => {
  const n = String(name ?? '').trim();
  return NAME_TO_CODE.get(n.toLowerCase()) ?? (LANGUAGES[n.toLowerCase()] ? n.toLowerCase() : n || '??');
};

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** Converts the state blob saved by legacy/balonca.html (IndexedDB "balonca" / store "k" / key "state"). */
export function migrateLegacy(state: unknown): Migrated {
  const s = (state && typeof state === 'object' ? state : {}) as Record<string, any>;
  const old = (s.set ?? {}) as Record<string, any>;

  const settings = sanitizeSettings({
    ...DEFAULT_SETTINGS,
    theme: old.theme, locale: old.lang, subSize: old.size, subBg: old.bg,
    pauseOnSave: old.pause, autoScroll: old.scroll, hideSecondary: old.hide2, autoPause: old.ap,
  });

  const words: SavedWord[] = [];
  for (const [langName, list] of Object.entries((s.bags ?? {}) as Record<string, any[]>)) {
    if (!Array.isArray(list)) continue;
    const lang = toCode(langName);
    for (const x of list) {
      if (!x || typeof x.w !== 'string') continue;
      const w = makeWord({ lang, word: x.w, ctx: String(x.ctx ?? ''), vid: typeof x.vid === 'string' ? x.vid : undefined, t: num(x.t) });
      const ivl = num(x.ivl);
      words.push({ ...w, ivl, reps: ivl > 0 ? 1 : 0, due: typeof x.due === 'number' ? x.due : undefined });
    }
  }

  const tracks: StoredTrack[] = [];
  for (const [vid, list] of Object.entries((s.vids ?? {}) as Record<string, any[]>)) {
    if (!Array.isArray(list)) continue;
    for (const t of list) {
      if (!t || !Array.isArray(t.lines)) continue;
      tracks.push({
        id: String(t.id ?? `${vid}-${tracks.length}`), vid,
        name: String(t.name ?? ''), lang: toCode(t.lang), label: String(t.lang ?? ''),
        color: typeof t.color === 'string' ? t.color : '#a995ff',
        visible: t.visible !== false, offset: num(t.offset),
        cues: t.lines.map((l: any) => ({ start: num(l.start), end: num(l.end), text: String(l.text ?? '') })),
      });
    }
  }

  return { settings, words, tracks, lastVideo: typeof s.last === 'string' ? s.last : null };
}
