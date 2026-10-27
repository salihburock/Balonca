import { describe, expect, it } from 'vitest';
import { schedule, isDue, isLearned, reviewQueue, progress, DAY, RELEARN_MS } from './scheduler';
import { makeWord } from '../words/bags';

const NOW = 1_000_000_000_000;
const fresh = () => makeWord({ lang: 'nl', word: 'huis', ctx: '', t: 0, now: NOW });

describe('schedule', () => {
  it('grows intervals with repeated "good": 1d, 3d, then x ease', () => {
    let w = fresh();
    w = { ...w, ...schedule(w, 'good', NOW) };
    expect(w.ivl).toBe(1);
    expect(w.due).toBe(NOW + DAY);
    w = { ...w, ...schedule(w, 'good', NOW) };
    expect(w.ivl).toBe(3);
    w = { ...w, ...schedule(w, 'good', NOW) };
    expect(w.ivl).toBe(Math.round(3 * 2.5));
  });
  it('"easy" jumps further and raises ease', () => {
    const w = fresh();
    const s = schedule(w, 'easy', NOW);
    expect(s.ivl).toBe(3);
    expect(s.ease).toBeCloseTo(2.65);
  });
  it('"again" resets, lowers ease (min 1.3), counts a lapse and returns in 10 minutes', () => {
    let w = { ...fresh(), reps: 5, ivl: 20, ease: 1.35 };
    const s = schedule(w, 'again', NOW);
    expect(s).toMatchObject({ reps: 0, ivl: 0, lapses: 1, due: NOW + RELEARN_MS });
    expect(s.ease).toBe(1.3);
  });
  it('caps the interval at a year', () => {
    const w = { ...fresh(), reps: 10, ivl: 300, ease: 3 };
    expect(schedule(w, 'good', NOW).ivl).toBe(365);
  });
});

describe('queue and progress', () => {
  it('new cards are due; future ones are not; most overdue first', () => {
    const a = { ...fresh(), id: 'a', due: NOW - 5 * DAY };
    const b = { ...fresh(), id: 'b', due: NOW + DAY };
    const c = { ...fresh(), id: 'c', due: undefined };
    const d = { ...fresh(), id: 'd', due: NOW - DAY };
    expect(isDue(b, NOW)).toBe(false);
    expect(reviewQueue([a, b, c, d], NOW).map((w) => w.id)).toEqual(['c', 'a', 'd']);
    expect(reviewQueue([a, b, c, d], NOW, 2)).toHaveLength(2);
  });
  it('learned means interval of a week or more', () => {
    expect(isLearned({ ivl: 6 })).toBe(false);
    expect(isLearned({ ivl: 7 })).toBe(true);
  });
  it('progress handles empty and mixed lists', () => {
    expect(progress([], NOW)).toEqual({ total: 0, due: 0, learned: 0, learning: 0, percent: 0 });
    const list = [{ ...fresh(), ivl: 10, due: NOW + DAY }, fresh()];
    expect(progress(list, NOW)).toEqual({ total: 2, due: 1, learned: 1, learning: 1, percent: 50 });
  });
});
