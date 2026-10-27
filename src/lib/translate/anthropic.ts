import { TranslateError, type TranslateFn } from './runner';

export const MODELS = [
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (cheaper)' },
] as const;

const ENDPOINT = 'https://api.anthropic.com/v1/messages';

export const systemPrompt = (from: string, to: string) =>
  `You are a subtitle translator. The user sends JSON: {"context_before": [...], "translate": [...]}. ` +
  `"translate" holds subtitle lines in ${from}, taken from automatic captions: they have no punctuation, ` +
  `contain mistakes, and sentences may be split across lines. "context_before" is only for understanding; do not translate it. ` +
  `Translate every line of "translate" into natural, short, spoken ${to}, fixing obvious recognition errors from context. ` +
  `Reply with ONLY a JSON array of strings with exactly as many items as "translate", one translation per input line, in order. No other text.`;

/** Extracts a JSON string array from a model reply, tolerating code fences and surrounding prose. */
export function parseTranslations(reply: string): string[] {
  const s = reply.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = s.indexOf('['), end = s.lastIndexOf(']');
  if (start < 0 || end <= start) throw new TranslateError('bad-response', 'no JSON array in reply');
  let data: unknown;
  try { data = JSON.parse(s.slice(start, end + 1)); } catch { throw new TranslateError('bad-response', 'invalid JSON'); }
  if (!Array.isArray(data) || !data.every((x) => typeof x === 'string')) throw new TranslateError('bad-response', 'not a string array');
  return data;
}

/**
 * Browser-direct Anthropic call. The key never leaves this request: it goes only to api.anthropic.com.
 * `fetchImpl` is injectable for tests.
 */
export function anthropicTranslator(opts: {
  apiKey: string; model: string; from: string; to: string; fetchImpl?: typeof fetch;
}): TranslateFn {
  const doFetch = opts.fetchImpl ?? fetch.bind(globalThis);
  return async (lines, context, signal) => {
    let res: Response;
    try {
      res = await doFetch(ENDPOINT, {
        method: 'POST',
        signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': opts.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: opts.model,
          max_tokens: 4096,
          system: systemPrompt(opts.from, opts.to),
          messages: [{ role: 'user', content: JSON.stringify({ context_before: context, translate: lines }) }],
        }),
      });
    } catch (e) {
      if (signal.aborted) throw new TranslateError('cancelled');
      throw new TranslateError('network', e instanceof Error ? e.message : undefined);
    }
    if (res.status === 401 || res.status === 403) throw new TranslateError('bad-key');
    if (res.status === 429) throw new TranslateError('rate-limit');
    if (!res.ok) throw new TranslateError('api', `${res.status}`);
    const body = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = body.content?.find((c) => c.type === 'text')?.text ?? '';
    return parseTranslations(text);
  };
}
