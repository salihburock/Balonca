import type { Cue } from '../types';

export type TranslateFn = (lines: string[], context: string[], signal: AbortSignal) => Promise<string[]>;

export interface RunOptions {
  cues: Cue[];
  translate: TranslateFn;
  batchSize?: number;
  contextLines?: number;
  signal: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

export class TranslateError extends Error {
  constructor(
    public readonly code: 'bad-key' | 'rate-limit' | 'network' | 'bad-response' | 'api' | 'cancelled',
    public readonly detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'TranslateError';
  }
}

/**
 * Translates a track in batches, keeping the original timings. A batch whose answer has the wrong number of
 * lines is retried once with half the size, then fails (no silent misalignment).
 */
export async function translateCues(opts: RunOptions): Promise<Cue[]> {
  const { cues, translate, signal, onProgress } = opts;
  const size = opts.batchSize ?? 25;
  const ctxN = opts.contextLines ?? 3;
  const out: Cue[] = [];

  const run = async (from: number, to: number): Promise<string[]> => {
    if (signal.aborted) throw new TranslateError('cancelled');
    const lines = cues.slice(from, to).map((c) => c.text);
    const ctx = cues.slice(Math.max(0, from - ctxN), from).map((c) => c.text);
    const res = await translate(lines, ctx, signal);
    if (res.length === lines.length) return res;
    if (lines.length === 1) throw new TranslateError('bad-response', `expected ${lines.length} lines, got ${res.length}`);
    const mid = from + Math.ceil(lines.length / 2); // split and retry
    return [...(await run(from, mid)), ...(await run(mid, to))];
  };

  for (let i = 0; i < cues.length; i += size) {
    const end = Math.min(i + size, cues.length);
    const tr = await run(i, end);
    tr.forEach((text, k) => out.push({ start: cues[i + k].start, end: cues[i + k].end, text: text.trim() || cues[i + k].text }));
    onProgress?.(end, cues.length);
  }
  return out;
}
