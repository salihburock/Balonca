import type { Cue } from '../types';

/** Index of the cue showing at `time` (already offset-corrected), or -1. Cues must be sorted by start. */
export function findCue(cues: Cue[], time: number): number {
  let lo = 0, hi = cues.length - 1, idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].start <= time) { idx = mid; lo = mid + 1; } else hi = mid - 1;
  }
  // Overlapping cues: the latest-starting one that still covers `time` wins.
  for (let i = idx; i >= 0 && i > idx - 8; i--) if (time < cues[i].end) return i;
  return -1;
}

/** Cue to jump to for "next line": first one starting after the current time. */
export function nextCue(cues: Cue[], time: number, offset: number): number {
  const t = time - offset;
  let lo = 0, hi = cues.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (cues[mid].start > t + 0.05) hi = mid; else lo = mid + 1; }
  return lo < cues.length ? lo : -1;
}

/** "Previous line": restart the current line if we are well into it, otherwise go to the one before. */
export function prevCue(cues: Cue[], time: number, offset: number): number {
  const t = time - offset;
  let lo = 0, hi = cues.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (cues[mid].start < t - 0.6) lo = mid + 1; else hi = mid; }
  return lo - 1;
}

/**
 * For every cue of the primary track, the best-overlapping cue index in each other track (or -1).
 * Used to show translations underneath transcript lines.
 */
export function alignTracks(
  primary: { cues: Cue[]; offset: number },
  others: { cues: Cue[]; offset: number }[],
): number[][] {
  return primary.cues.map((p) => {
    const ps = p.start + primary.offset, pe = p.end + primary.offset;
    return others.map((o) => {
      const t0 = ps - o.offset, t1 = pe - o.offset;
      let best = -1, bestOverlap = 0;
      let i = Math.max(0, findFirstStartAfter(o.cues, t0) - 4);
      for (; i < o.cues.length && o.cues[i].start < t1; i++) {
        const ov = Math.min(t1, o.cues[i].end) - Math.max(t0, o.cues[i].start);
        if (ov > bestOverlap) { bestOverlap = ov; best = i; }
      }
      return best;
    });
  });
}

function findFirstStartAfter(cues: Cue[], t: number): number {
  let lo = 0, hi = cues.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (cues[mid].start > t) hi = mid; else lo = mid + 1; }
  return lo;
}
