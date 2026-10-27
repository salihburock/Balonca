const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', lrm: '', rlm: '',
};

export const stripBom = (s: string) => s.replace(/^﻿/, '');

/** Converts raw cue markup into plain text. Output is always plain text, never HTML. */
export function cleanCueText(raw: string): string {
  return raw
    .replace(/<\/?[a-z][^>]*>/gi, '') // <i>, <b>, <c.colorE5E5E5>, <v Speaker>
    .replace(/<\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3}>/g, '') // VTT karaoke timestamps
    .replace(/\{\\[^}]*\}/g, '') // ASS/SSA overrides such as {\an8}
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === '#') {
        const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        try { return String.fromCodePoint(code); } catch { return m; }
      }
      return NAMED[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/** "00:01:02,500", "01:02.5", "1:02:03.250" -> seconds, or NaN when invalid. */
export function parseTimestamp(s: string): number {
  const m = s.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/);
  if (!m) return NaN;
  const [, h, min, sec, frac] = m;
  return Number(h ?? 0) * 3600 + Number(min) * 60 + Number(sec) + (frac ? Number(frac.padEnd(3, '0')) / 1000 : 0);
}
