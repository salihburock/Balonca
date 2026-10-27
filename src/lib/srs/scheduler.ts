import type { SavedWord } from '../types';

export type Grade = 'again' | 'good' | 'easy';
export const DAY = 86_400_000;
export const RELEARN_MS = 10 * 60_000;
/** A word counts as "learned" once its next review is a week or more away. */
export const LEARNED_DAYS = 7;

type Schedule = Pick<SavedWord, 'reps' | 'ivl' | 'ease' | 'lapses' | 'due'>;

/** Simplified SM-2. Returns only the scheduling fields; the caller merges them into the word. */
export function schedule(card: Schedule, grade: Grade, now = Date.now()): Schedule {
  let { reps, ivl, ease, lapses } = card;

  if (grade === 'again') {
    return { reps: 0, ivl: 0, ease: Math.max(1.3, ease - 0.2), lapses: lapses + 1, due: now + RELEARN_MS };
  }

  reps += 1;
  if (grade === 'good') {
    ivl = reps === 1 ? 1 : reps === 2 ? 3 : Math.round(ivl * ease);
  } else {
    ease += 0.15;
    ivl = reps === 1 ? 3 : Math.max(Math.round(ivl * ease * 1.3), 4);
  }
  ivl = Math.max(1, Math.min(ivl, 365));
  return { reps, ivl, ease, lapses, due: now + ivl * DAY };
}

export const isDue = (w: Pick<SavedWord, 'due'>, now = Date.now()) => w.due === undefined || w.due <= now;
export const isLearned = (w: Pick<SavedWord, 'ivl'>) => w.ivl >= LEARNED_DAYS;

/** Due cards, most overdue first (new cards, with no due date, come first). */
export function reviewQueue(list: SavedWord[], now = Date.now(), limit = Infinity): SavedWord[] {
  return list
    .filter((w) => isDue(w, now))
    .sort((a, b) => (a.due ?? 0) - (b.due ?? 0))
    .slice(0, limit);
}

export function progress(list: SavedWord[], now = Date.now()) {
  const total = list.length;
  const learned = list.filter(isLearned).length;
  return {
    total,
    due: list.filter((w) => isDue(w, now)).length,
    learned,
    learning: total - learned,
    percent: total ? Math.round((learned / total) * 100) : 0,
  };
}
