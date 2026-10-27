import { describe, expect, it, vi } from 'vitest';
import { translateCues, TranslateError, type TranslateFn } from './runner';
import { anthropicTranslator, parseTranslations } from './anthropic';
import type { Cue } from '../types';

const cues = (n: number): Cue[] => Array.from({ length: n }, (_, i) => ({ start: i, end: i + 1, text: `s${i}` }));
const upper: TranslateFn = async (lines) => lines.map((l) => l.toUpperCase());
const ac = () => new AbortController();

describe('translateCues', () => {
  it('keeps timings, batches, and reports progress', async () => {
    const progress: number[] = [];
    const calls: number[] = [];
    const out = await translateCues({
      cues: cues(60), batchSize: 25, signal: ac().signal,
      translate: async (l, c, s) => { calls.push(l.length); return upper(l, c, s); },
      onProgress: (d) => progress.push(d),
    });
    expect(calls).toEqual([25, 25, 10]);
    expect(progress).toEqual([25, 50, 60]);
    expect(out[59]).toEqual({ start: 59, end: 60, text: 'S59' });
  });
  it('passes the previous lines as context', async () => {
    const seen: string[][] = [];
    await translateCues({ cues: cues(6), batchSize: 3, signal: ac().signal, translate: async (l, c) => { seen.push(c); return l; } });
    expect(seen).toEqual([[], ['s0', 's1', 's2']]);
  });
  it('splits a batch when the model returns the wrong number of lines', async () => {
    let first = true;
    const flaky: TranslateFn = async (lines) => {
      if (first && lines.length > 1) { first = false; return lines.slice(1); }
      return lines.map((l) => l + '!');
    };
    const out = await translateCues({ cues: cues(4), batchSize: 4, signal: ac().signal, translate: flaky });
    expect(out.map((c) => c.text)).toEqual(['s0!', 's1!', 's2!', 's3!']);
  });
  it('fails instead of misaligning when a single line cannot be matched', async () => {
    await expect(translateCues({ cues: cues(2), batchSize: 2, signal: ac().signal, translate: async () => [] }))
      .rejects.toMatchObject({ code: 'bad-response' });
  });
  it('can be cancelled', async () => {
    const c = ac();
    const p = translateCues({ cues: cues(100), batchSize: 10, signal: c.signal,
      translate: async (l, ctx, s) => { c.abort(); return upper(l, ctx, s); } });
    await expect(p).rejects.toMatchObject({ code: 'cancelled' });
  });
  it('falls back to the source text when a translation comes back empty', async () => {
    const out = await translateCues({ cues: cues(1), signal: ac().signal, translate: async () => ['  '] });
    expect(out[0].text).toBe('s0');
  });
});

describe('parseTranslations', () => {
  it.each([
    ['["a","b"]', ['a', 'b']],
    ['```json\n["a","b"]\n```', ['a', 'b']],
    ['Here you go: ["a"] done', ['a']],
  ])('%s', (input, expected) => expect(parseTranslations(input)).toEqual(expected));
  it.each(['no array', '[1,2]', '["a",', '{"a":1}'])('rejects %s', (input) => {
    expect(() => parseTranslations(input)).toThrow(TranslateError);
  });
});

describe('anthropicTranslator', () => {
  const reply = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }));
  const mk = (f: typeof fetch) => anthropicTranslator({ apiKey: 'sk-test', model: 'claude-sonnet-5-5', from: 'Dutch', to: 'Turkish', fetchImpl: f });

  it('sends the key only to api.anthropic.com with the required browser header', async () => {
    const f = reply(200, { content: [{ type: 'text', text: '["merhaba"]' }] });
    expect(await mk(f as unknown as typeof fetch)(['hallo'], ['ctx'], ac().signal)).toEqual(['merhaba']);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('sk-test');
    expect((init.headers as Record<string, string>)['anthropic-dangerous-direct-browser-access']).toBe('true');
    const body = JSON.parse(init.body as string);
    expect(JSON.parse(body.messages[0].content)).toEqual({ context_before: ['ctx'], translate: ['hallo'] });
    expect(body.system).toContain('Dutch');
    expect(body.system).toContain('Turkish');
  });
  it.each([[401, 'bad-key'], [403, 'bad-key'], [429, 'rate-limit'], [500, 'api']])('maps HTTP %i to %s', async (status, code) => {
    await expect(mk(reply(status, {}) as unknown as typeof fetch)(['x'], [], ac().signal)).rejects.toMatchObject({ code });
  });
  it('maps network failures and aborts', async () => {
    const down = vi.fn(async () => { throw new TypeError('offline'); });
    await expect(mk(down as unknown as typeof fetch)(['x'], [], ac().signal)).rejects.toMatchObject({ code: 'network' });
    const c = ac(); c.abort();
    await expect(mk(down as unknown as typeof fetch)(['x'], [], c.signal)).rejects.toMatchObject({ code: 'cancelled' });
  });
});
