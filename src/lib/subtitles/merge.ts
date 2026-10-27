import type { Cue } from '../types';

const words = (s: string) => s.split(' ').filter(Boolean);

function endsWith(a: string[], tail: string[]): boolean {
  if (tail.length > a.length) return false;
  const off = a.length - tail.length;
  return tail.every((w, i) => a[off + i] === w);
}

/** Longest k such that the last k words of `a` equal the first k words of `b`. */
function overlap(a: string[], b: string[]): number {
  for (let k = Math.min(a.length, b.length); k > 0; k--) {
    let ok = true;
    for (let i = 0; i < k; i++) if (a[a.length - k + i] !== b[i]) { ok = false; break; }
    if (ok) return k;
  }
  return 0;
}

/**
 * YouTube auto-captions "roll": cue N repeats the tail of cue N-1 and adds new words, and tiny filler
 * cues repeat the previous text. This keeps each word once, at the time it first appears.
 * Cues must be sorted by start time.
 */
export function mergeRolling(input: Cue[]): { cues: Cue[]; merged: number } {
  const out: Cue[] = [];
  let merged = 0;

  for (const c of input) {
    const cur = { ...c };
    const prev = out[out.length - 1];
    if (!prev || cur.start > prev.end + 0.3) { out.push(cur); continue; }

    const inTime = cur.start < prev.end - 0.0001;
    const pw = words(prev.text), cw = words(cur.text);

    if (endsWith(pw, cw) && (inTime || cw.length >= 2 || cw.length === pw.length)) {
      prev.end = Math.max(prev.end, cur.end); // pure repeat: just extend
      merged++;
      continue;
    }
    const k = overlap(pw, cw);
    if (k > 0 && k < cw.length && (inTime || k >= 2)) {
      cur.text = cw.slice(k).join(' '); // keep only the new words
      merged++;
    }
    out.push(cur);
  }

  // Rolling cues overlap in time; shorten each to end where the next one starts.
  for (let i = 0; i < out.length - 1; i++) {
    const next = out[i + 1];
    if (next.start > out[i].start && out[i].end > next.start) out[i].end = next.start;
  }
  return { cues: out, merged };
}
