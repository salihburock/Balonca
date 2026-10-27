import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EXAMPLE_SUBTITLE, EXAMPLE_VIDEO_ID } from './example';
import { parseSubtitles } from './subtitles';

describe('bundled example subtitle', () => {
  const raw = readFileSync(new URL(`../../public/examples/${EXAMPLE_SUBTITLE.file}`, import.meta.url), 'utf8');
  it('is named after the example video and parses cleanly', () => {
    expect(EXAMPLE_SUBTITLE.file.startsWith(EXAMPLE_VIDEO_ID)).toBe(true);
    const r = parseSubtitles(raw);
    expect(r.format).toBe('json');
    expect(r.skipped).toBe(0);
    expect(r.cues.length).toBeGreaterThan(100);
  });
  it('is sorted, non-overlapping and within the video length (7:00)', () => {
    const { cues } = parseSubtitles(raw);
    cues.forEach((c, i) => {
      expect(c.end).toBeGreaterThan(c.start);
      if (i) expect(c.start).toBeGreaterThanOrEqual(cues[i - 1].end - 0.001);
    });
    expect(cues.at(-1)!.end).toBeLessThanOrEqual(421);
  });
});
