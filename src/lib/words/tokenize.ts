export interface Token {
  text: string; // exact source text
  isWord: boolean;
  key: string; // normalized form used for saving/matching ('' for non-words)
}

const segmenters = new Map<string, Intl.Segmenter | null>();

function segmenterFor(lang: string): Intl.Segmenter | null {
  if (typeof Intl === 'undefined' || !('Segmenter' in Intl)) return null;
  if (!segmenters.has(lang)) {
    let s: Intl.Segmenter | null = null;
    try { s = new Intl.Segmenter(lang, { granularity: 'word' }); } catch {
      try { s = new Intl.Segmenter(undefined, { granularity: 'word' }); } catch { s = null; }
    }
    segmenters.set(lang, s);
  }
  return segmenters.get(lang) ?? null;
}

/** Lowercases with the language's own rules (Turkish İ/ı) and trims stray apostrophes/hyphens. */
export function normalizeWord(w: string, lang: string): string {
  let n = w.normalize('NFC');
  try { n = n.toLocaleLowerCase(lang); } catch { n = n.toLowerCase(); }
  return n.replace(/^['’\-]+|['’\-]+$/g, '');
}

const FALLBACK = /[\p{L}\p{N}][\p{L}\p{N}'’-]*|[^\p{L}\p{N}]+/gu;

/** Splits a subtitle line into word and separator tokens. Uses Intl.Segmenter so CJK and clitics work. */
export function tokenize(text: string, lang: string): Token[] {
  const seg = segmenterFor(lang);
  const raw: { text: string; isWord: boolean }[] = seg
    ? [...seg.segment(text)].map((s) => ({ text: s.segment, isWord: !!s.isWordLike }))
    : (text.match(FALLBACK) ?? []).map((m) => ({ text: m, isWord: /^[\p{L}\p{N}]/u.test(m) }));
  return raw.map((r) => {
    const key = r.isWord ? normalizeWord(r.text, lang) : '';
    return { text: r.text, isWord: r.isWord && key !== '', key };
  });
}
