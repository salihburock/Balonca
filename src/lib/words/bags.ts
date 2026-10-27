import type { SavedWord } from '../types';
import { normalizeWord } from './tokenize';

export const wordId = (lang: string, w: string) => `${lang}:${w}`;

export function makeWord(args: {
  lang: string; word: string; ctx: string; trans?: { lang: string; text: string }[]; vid?: string; t: number; now?: number;
}): SavedWord {
  const w = normalizeWord(args.word, args.lang);
  return {
    id: wordId(args.lang, w), w, lang: args.lang, ctx: args.ctx.slice(0, 500),
    trans: (args.trans ?? []).slice(0, 4).map((x) => ({ lang: x.lang, text: x.text.slice(0, 500) })),
    vid: args.vid, t: Math.max(0, Math.round(args.t)), added: args.now ?? Date.now(),
    reps: 0, ivl: 0, ease: 2.5, lapses: 0,
  };
}

/** Adds the word if absent, removes it if present. Pure: returns the new list and what happened. */
export function toggleWord(list: SavedWord[], w: SavedWord): { list: SavedWord[]; added: boolean } {
  return list.some((x) => x.id === w.id)
    ? { list: list.filter((x) => x.id !== w.id), added: false }
    : { list: [...list, w], added: true };
}

export const languagesIn = (list: SavedWord[]): string[] => [...new Set(list.map((w) => w.lang))];

export function countByLang(list: SavedWord[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const w of list) out[w.lang] = (out[w.lang] ?? 0) + 1;
  return out;
}

export function filterWords(list: SavedWord[], opts: { lang?: string; query?: string }): SavedWord[] {
  const q = opts.query?.trim().toLocaleLowerCase();
  return list
    .filter((w) => (!opts.lang || w.lang === opts.lang) && (!q || (w.w + ' ' + w.ctx).toLocaleLowerCase().includes(q)))
    .sort((a, b) => b.added - a.added);
}

/** Spreadsheet apps execute cells starting with = + - @ ; prefix them so imported CSVs stay inert. */
const csvCell = (v: string | number) => {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
};

export function toCsv(list: SavedWord[]): string {
  const rows = [['word', 'language', 'context', 'video', 'seconds'],
    ...list.map((w) => [w.w, w.lang, w.ctx, w.vid ? `https://youtu.be/${w.vid}?t=${w.t}` : '', w.t])];
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}
