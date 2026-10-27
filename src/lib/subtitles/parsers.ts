import type { Cue } from '../types';
import { SubtitleParseError } from './errors';
import { cleanCueText, parseTimestamp, stripBom } from './text';
import { mergeRolling } from './merge';

export type SubtitleFormat = 'srt' | 'vtt' | 'json3' | 'json';

export interface ParseResult {
  format: SubtitleFormat;
  cues: Cue[];
  skipped: number; // blocks/entries that could not be read
  merged: number; // rolling duplicates removed
}

export function detectFormat(input: string): SubtitleFormat {
  const s = stripBom(input).trim();
  if (!s) throw new SubtitleParseError('empty');
  if (s.includes('\u0000')) throw new SubtitleParseError('binary');
  if (s[0] === '[') return 'json';
  if (s[0] === '{') return 'json3';
  if (/^<!doctype|^<html/i.test(s)) throw new SubtitleParseError('html-page');
  if (/^WEBVTT/.test(s)) return 'vtt';
  if (s.includes('-->')) return 'srt';
  throw new SubtitleParseError('unknown-format');
}

/** Fixes zero/negative duration and sorts by start time. */
function normalize(cues: Cue[]): Cue[] {
  return cues
    .filter((c) => c.text && Number.isFinite(c.start) && Number.isFinite(c.end) && c.start >= 0)
    .map((c) => (c.end > c.start ? c : { ...c, end: c.start + 2 }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

/** SRT and WebVTT share the same block structure; cue ids, settings and headers are ignored. */
function parseCueBlocks(text: string): { cues: Cue[]; skipped: number } {
  const cues: Cue[] = [];
  let skipped = 0;
  const blocks = text.replace(/\r\n?/g, '\n').split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split('\n');
    const i = lines.findIndex((l) => l.includes('-->'));
    if (i < 0) continue; // header, NOTE, STYLE, REGION, stray numbers
    const m = lines[i].match(/^\s*(\S+)\s*-->\s*(\S+)/); // anything after is VTT cue settings
    const start = m ? parseTimestamp(m[1]) : NaN;
    const end = m ? parseTimestamp(m[2]) : NaN;
    if (!Number.isFinite(start) || !Number.isFinite(end)) { skipped++; continue; }
    const body = cleanCueText(lines.slice(i + 1).join(' '));
    if (body) cues.push({ start, end, text: body });
  }
  return { cues, skipped };
}

function parseJson(text: string): unknown {
  try { return JSON.parse(text); } catch (e) {
    throw new SubtitleParseError('invalid-json', e instanceof Error ? e.message : undefined);
  }
}

function parseSimpleJson(text: string): { cues: Cue[]; skipped: number } {
  const data = parseJson(text);
  if (!Array.isArray(data)) throw new SubtitleParseError('bad-shape', 'expected an array');
  const cues: Cue[] = [];
  let skipped = 0;
  for (const v of data) {
    const o = (v ?? {}) as Record<string, unknown>;
    const start = Number(o.start), end = Number(o.end), body = cleanCueText(String(o.text ?? ''));
    if (typeof o.text === 'string' && Number.isFinite(start) && Number.isFinite(end)) {
      if (body) cues.push({ start, end, text: body });
    } else skipped++;
  }
  return { cues, skipped };
}

interface Json3Event { tStartMs?: number; dDurationMs?: number; segs?: { utf8?: string }[] }

function parseJson3(text: string): { cues: Cue[]; skipped: number } {
  const data = parseJson(text) as { events?: Json3Event[] } | null;
  if (!data || !Array.isArray(data.events)) throw new SubtitleParseError('bad-shape', 'missing "events"');
  const cues: Cue[] = [];
  let skipped = 0;
  for (const e of data.events) {
    if (!e.segs) continue; // window/style events
    if (typeof e.tStartMs !== 'number') { skipped++; continue; }
    const body = cleanCueText(e.segs.map((s) => s.utf8 ?? '').join(''));
    if (!body) continue; // the "\n" spacer events YouTube emits
    const start = e.tStartMs / 1000;
    cues.push({ start, end: start + (e.dDurationMs ?? 2000) / 1000, text: body });
  }
  return { cues, skipped };
}

export interface ParseOptions {
  /** 'auto' merges YouTube-style rolling captions when they are clearly present. */
  dedupe?: 'auto' | boolean;
}

export function parseSubtitles(input: string, opts: ParseOptions = {}): ParseResult {
  const text = stripBom(input).trim();
  const format = detectFormat(text);
  const raw =
    format === 'json' ? parseSimpleJson(text) : format === 'json3' ? parseJson3(text) : parseCueBlocks(text);

  let cues = normalize(raw.cues);
  if (!cues.length) {
    throw new SubtitleParseError('no-cues', raw.skipped ? `${raw.skipped} unreadable entries` : undefined);
  }

  const mode = opts.dedupe ?? 'auto';
  let merged = 0;
  if (mode) {
    const r = mergeRolling(cues);
    // 'auto': json3 from YouTube is always auto-caption style; for others require a clear pattern.
    if (mode === true || format === 'json3' || r.merged / cues.length >= 0.1) {
      cues = r.cues;
      merged = r.merged;
    }
  }
  return { format, cues, skipped: raw.skipped, merged };
}
