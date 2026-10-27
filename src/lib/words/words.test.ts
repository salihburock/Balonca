import { describe, expect, it } from 'vitest';
import { tokenize, normalizeWord } from './tokenize';
import { makeWord, toggleWord, filterWords, toCsv, countByLang, languagesIn } from './bags';

describe('tokenize', () => {
  it('splits words and separators and round-trips the text', () => {
    const text = 'Ik wil, naar huis!';
    const toks = tokenize(text, 'nl');
    expect(toks.map((t) => t.text).join('')).toBe(text);
    expect(toks.filter((t) => t.isWord).map((t) => t.key)).toEqual(['ik', 'wil', 'naar', 'huis']);
  });
  it('lowercases Turkish dotted/dotless i correctly', () => {
    expect(normalizeWord('İSTANBUL', 'tr')).toBe('istanbul');
    expect(normalizeWord('ISPARTA', 'tr')).toBe('ısparta');
  });
  it('keeps apostrophe words together in English', () => {
    expect(tokenize("don't go", 'en').filter((t) => t.isWord).map((t) => t.key)).toEqual(["don't", 'go']);
  });
  it('survives an invalid language code', () => {
    expect(tokenize('hallo wereld', 'not a code!!').filter((t) => t.isWord)).toHaveLength(2);
  });
  it('treats digits as words and punctuation as separators', () => {
    const t = tokenize('2 + 2 = ?', 'en');
    expect(t.filter((x) => x.isWord).map((x) => x.key)).toEqual(['2', '2']);
  });
  it('returns nothing for empty text', () => {
    expect(tokenize('', 'nl')).toEqual([]);
  });
});

describe('word bags', () => {
  const mk = (word: string, lang = 'nl', now = 1) => makeWord({ lang, word, ctx: 'ctx', t: 12.6, now });
  it('normalizes and ids by language + word', () => {
    const w = mk('HUIS');
    expect(w.id).toBe('nl:huis');
    expect(w.t).toBe(13);
  });
  it('toggles add/remove, and separate languages do not collide', () => {
    let { list, added } = toggleWord([], mk('bank'));
    expect(added).toBe(true);
    ({ list } = toggleWord(list, mk('bank', 'tr')));
    expect(list).toHaveLength(2);
    ({ list, added } = toggleWord(list, mk('bank')));
    expect(added).toBe(false);
    expect(list.map((w) => w.id)).toEqual(['tr:bank']);
  });
  it('filters by language and query (word or context), newest first', () => {
    const a = makeWord({ lang: 'nl', word: 'huis', ctx: 'een groot huis', t: 0, now: 1 });
    const b = makeWord({ lang: 'nl', word: 'boom', ctx: 'oude BOOM', t: 0, now: 2 });
    const c = makeWord({ lang: 'tr', word: 'ev', ctx: 'büyük ev', t: 0, now: 3 });
    const all = [a, b, c];
    expect(filterWords(all, { lang: 'nl' }).map((w) => w.w)).toEqual(['boom', 'huis']);
    expect(filterWords(all, { query: 'boom' }).map((w) => w.w)).toEqual(['boom']);
    expect(filterWords(all, { lang: 'tr', query: 'huis' })).toEqual([]);
    expect(countByLang(all)).toEqual({ nl: 2, tr: 1 });
    expect(languagesIn(all)).toEqual(['nl', 'tr']);
  });
  it('CSV escapes quotes and neutralizes formula injection', () => {
    const w = makeWord({ lang: 'en', word: '=cmd', ctx: 'say "hi", ok', vid: 'abcdefghijk', t: 5, now: 1 });
    const csv = toCsv([w]);
    expect(csv.startsWith('﻿"word"')).toBe(true);
    expect(csv).toContain(`"'=cmd"`);
    expect(csv).toContain('"say ""hi"", ok"');
    expect(csv).toContain('https://youtu.be/abcdefghijk?t=5');
  });
});
