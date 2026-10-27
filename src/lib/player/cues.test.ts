import { describe, expect, it } from 'vitest';
import { findCue, nextCue, prevCue, alignTracks } from './cues';
import type { Cue } from '../types';

const c = (start: number, end: number, text = ''): Cue => ({ start, end, text: text || `${start}` });
const cues = [c(1, 3), c(4, 6), c(10, 12)];

describe('findCue', () => {
  it('finds the active cue, end exclusive', () => {
    expect(findCue(cues, 0.5)).toBe(-1);
    expect(findCue(cues, 1)).toBe(0);
    expect(findCue(cues, 2.99)).toBe(0);
    expect(findCue(cues, 3)).toBe(-1);
    expect(findCue(cues, 11)).toBe(2);
    expect(findCue(cues, 99)).toBe(-1);
  });
  it('handles empty lists', () => expect(findCue([], 5)).toBe(-1));
  it('prefers the latest-starting cue among overlapping ones', () => {
    expect(findCue([c(1, 10), c(2, 4)], 3)).toBe(1);
    expect(findCue([c(1, 10), c(2, 4)], 6)).toBe(0); // long cue still active after the short one ends
  });
});

describe('next / prev', () => {
  it('next skips to the following start', () => {
    expect(nextCue(cues, 0, 0)).toBe(0);
    expect(nextCue(cues, 1, 0)).toBe(1);
    expect(nextCue(cues, 10, 0)).toBe(-1);
  });
  it('respects the track offset', () => {
    expect(nextCue(cues, 2, 1)).toBe(1); // cue 0 appears at 2s, cue 1 at 5s
  });
  it('prev restarts the current line when well into it, else goes back', () => {
    expect(prevCue(cues, 2.5, 0)).toBe(0);
    expect(prevCue(cues, 1.3, 0)).toBe(-1); // within 0.6s of the first cue start: nothing before it
    expect(prevCue(cues, 4.3, 0)).toBe(0);
    expect(prevCue(cues, 50, 0)).toBe(2);
  });
});

describe('alignTracks', () => {
  it('matches by greatest time overlap, with offsets', () => {
    const dutch = { cues: [c(0, 2), c(2, 4)], offset: 0 };
    const turk = { cues: [c(0.1, 1.9), c(2.2, 5)], offset: 0 };
    expect(alignTracks(dutch, [turk])).toEqual([[0], [1]]);
    expect(alignTracks(dutch, [{ cues: turk.cues, offset: 3 }])).toEqual([[-1], [0]]);
  });
  it('returns -1 when nothing overlaps and supports several tracks', () => {
    const a = { cues: [c(0, 1)], offset: 0 };
    expect(alignTracks(a, [{ cues: [c(5, 6)], offset: 0 }, { cues: [c(0, 1)], offset: 0 }])).toEqual([[-1, 0]]);
  });
});
