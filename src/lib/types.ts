export interface Cue {
  start: number; // seconds
  end: number;
  text: string; // plain text only, never HTML
}

export interface Track {
  id: string;
  name: string; // original file name
  lang: string; // language code, e.g. "nl"; the key word bags are grouped by
  label: string; // user-editable display name
  color: string;
  visible: boolean;
  offset: number; // seconds, positive = subtitles appear later
  cues: Cue[];
}

export interface StoredTrack extends Track {
  vid: string; // YouTube video id this track belongs to
}

export interface SavedWord {
  id: string; // `${lang}:${w}`
  w: string; // normalized word
  lang: string;
  ctx: string; // sentence it was saved from
  vid?: string;
  t: number; // seconds into the video
  added: number; // epoch ms
  reps: number;
  ivl: number; // days
  ease: number;
  lapses: number;
  due?: number; // epoch ms; undefined = new card, due now
}

export const TRACK_COLORS = ['#ffb020', '#2dd4a7', '#38bdf8', '#ff8fb8', '#a995ff'] as const;

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
