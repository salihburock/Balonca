import { describe, expect, it } from 'vitest';
import { parseSubtitles, detectFormat, SubtitleParseError } from './index';
import { parseTimestamp, cleanCueText } from './text';
import { detectLangFromFilename } from '../languages';

const code = (fn: () => unknown) => {
  try { fn(); } catch (e) { return (e as SubtitleParseError).code; }
  return null;
};

describe('parseTimestamp', () => {
  it('handles comma, dot, optional hours and short fractions', () => {
    expect(parseTimestamp('00:01:02,500')).toBeCloseTo(62.5);
    expect(parseTimestamp('01:02.5')).toBeCloseTo(62.5);
    expect(parseTimestamp('1:02:03.250')).toBeCloseTo(3723.25);
    expect(parseTimestamp('00:00:05')).toBe(5);
  });
  it('returns NaN for garbage', () => {
    expect(parseTimestamp('abc')).toBeNaN();
    expect(parseTimestamp('')).toBeNaN();
  });
});

describe('cleanCueText', () => {
  it('strips tags, ASS overrides, karaoke timestamps and decodes entities', () => {
    expect(cleanCueText('<i>Hallo</i> <c.yellow>wereld</c> {\\an8}')).toBe('Hallo wereld');
    expect(cleanCueText('a<00:00:01.200>b')).toBe('ab');
    expect(cleanCueText('Tom &amp; Jerry &#39;s &#x41; &nbsp;ok')).toBe("Tom & Jerry 's A ok");
  });
  it('keeps escaped markup as literal text (it is rendered escaped later)', () => {
    expect(cleanCueText('&lt;script&gt;')).toBe('<script>');
  });
  it('does not eat a lone "<3"', () => {
    expect(cleanCueText('ik <3 jou')).toBe('ik <3 jou');
  });
});

describe('SRT', () => {
  const srt = '1\r\n00:00:01,000 --> 00:00:02,500\r\nHallo <b>daar</b>\r\n\r\n2\r\n00:00:03,000 --> 00:00:04,000\r\nTwee\r\nregels\r\n';
  it('parses CRLF, indices, tags and multi-line cues', () => {
    const r = parseSubtitles(srt);
    expect(r.format).toBe('srt');
    expect(r.cues).toEqual([
      { start: 1, end: 2.5, text: 'Hallo daar' },
      { start: 3, end: 4, text: 'Twee regels' },
    ]);
  });
  it('strips a UTF-8 BOM', () => {
    expect(parseSubtitles('﻿' + srt).cues).toHaveLength(2);
  });
  it('accepts lone CR line endings', () => {
    expect(parseSubtitles(srt.replace(/\r\n/g, '\r')).cues).toHaveLength(2);
  });
  it('sorts out-of-order cues and fixes zero-length ones', () => {
    const r = parseSubtitles('1\n00:00:05,000 --> 00:00:05,000\nB\n\n2\n00:00:01,000 --> 00:00:02,000\nA');
    expect(r.cues.map((c) => c.text)).toEqual(['A', 'B']);
    expect(r.cues[1].end).toBeGreaterThan(r.cues[1].start);
  });
  it('keeps legitimately overlapping cues (two speakers)', () => {
    const r = parseSubtitles('1\n00:00:01,000 --> 00:00:04,000\nIk wil naar huis\n\n2\n00:00:02,000 --> 00:00:03,000\nNee, nooit', { dedupe: false });
    expect(r.cues).toHaveLength(2);
  });
  it('skips blocks with bad timestamps but reports them', () => {
    const r = parseSubtitles('1\nxx --> yy\nBad\n\n2\n00:00:01,000 --> 00:00:02,000\nGood');
    expect(r.cues).toHaveLength(1);
    expect(r.skipped).toBe(1);
  });
});

describe('WebVTT', () => {
  it('ignores header, NOTE, STYLE, cue ids and cue settings after timestamps', () => {
    const vtt = `WEBVTT
Kind: captions
Language: nl

NOTE this is a comment

STYLE
::cue { color: red }

intro
00:00:01.000 --> 00:00:02.000 align:start position:0% line:90%
<v Piet>Dag <c.colorE5E5E5>allemaal</c>

00:03.000 --> 00:04.000
Kort formaat`;
    const r = parseSubtitles(vtt);
    expect(r.format).toBe('vtt');
    expect(r.cues).toEqual([
      { start: 1, end: 2, text: 'Dag allemaal' },
      { start: 3, end: 4, text: 'Kort formaat' },
    ]);
  });
});

describe('json3', () => {
  it('joins segments, drops spacer/style events', () => {
    const j = JSON.stringify({ events: [
      { tStartMs: 0, dDurationMs: 1000, id: 1 },
      { tStartMs: 1000, dDurationMs: 1500, segs: [{ utf8: 'hal' }, { utf8: 'lo\nwereld' }] },
      { tStartMs: 2500, dDurationMs: 100, segs: [{ utf8: '\n' }] },
    ] });
    const r = parseSubtitles(j);
    expect(r.format).toBe('json3');
    expect(r.cues).toEqual([{ start: 1, end: 2.5, text: 'hallo wereld' }]);
  });
});

describe('simple json', () => {
  it('reads [{start,end,text}] as written by translate.py', () => {
    const r = parseSubtitles('﻿[{"start":1,"end":2,"text":"Merhaba"},{"start":"x","end":2,"text":"bad"}]');
    expect(r.cues).toEqual([{ start: 1, end: 2, text: 'Merhaba' }]);
    expect(r.skipped).toBe(1);
  });
});

describe('errors', () => {
  it.each([
    ['', 'empty'],
    ['   \n ', 'empty'],
    ['hello there', 'unknown-format'],
    ['<!DOCTYPE html><html></html>', 'html-page'],
    ['abc\u0000def', 'binary'],
    ['[{"start":', 'invalid-json'],
    ['{"foo":1}', 'bad-shape'],
    ['{"a": [', 'invalid-json'],
    ['[]', 'no-cues'],
    ['1\n00:00:01,000 --> 00:00:02,000\n\n', 'no-cues'],
  ])('%j -> %s', (input, expected) => {
    expect(code(() => parseSubtitles(input))).toBe(expected);
  });
  it('detectFormat distinguishes vtt and srt', () => {
    expect(detectFormat('WEBVTT\n\n')).toBe('vtt');
    expect(detectFormat('1\n00:00:01,000 --> 00:00:02,000\nx')).toBe('srt');
  });
});

describe('rolling auto-caption merge', () => {
  it('keeps each word once, at the time it first appears', () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:02.000
ik wil naar

00:00:02.000 --> 00:00:02.010
ik wil naar

00:00:02.010 --> 00:00:04.000
ik wil naar
huis vandaag

00:00:04.000 --> 00:00:04.010
huis vandaag

00:00:04.010 --> 00:00:06.000
huis vandaag
en morgen`;
    const r = parseSubtitles(vtt);
    expect(r.cues.map((c) => c.text)).toEqual(['ik wil naar', 'huis vandaag', 'en morgen']);
    expect(r.cues[0].end).toBeLessThanOrEqual(r.cues[1].start);
    expect(r.merged).toBeGreaterThan(0);
  });
  it('always merges for json3', () => {
    const j = JSON.stringify({ events: [
      { tStartMs: 0, dDurationMs: 3000, segs: [{ utf8: 'a b' }] },
      { tStartMs: 2000, dDurationMs: 2000, segs: [{ utf8: 'a b c' }] },
    ] });
    expect(parseSubtitles(j).cues.map((c) => c.text)).toEqual(['a b', 'c']);
  });
  it('leaves normal subtitles untouched in auto mode', () => {
    const srt = '1\n00:00:01,000 --> 00:00:02,000\nja\n\n2\n00:00:02,100 --> 00:00:03,000\nja nee\n\n3\n00:00:05,000 --> 00:00:06,000\nandere zin';
    expect(parseSubtitles(srt).cues.map((c) => c.text)).toEqual(['ja', 'ja nee', 'andere zin']);
  });
  it('does not merge cues far apart in time', () => {
    const srt = '1\n00:00:01,000 --> 00:00:02,000\nhallo wereld\n\n2\n00:00:20,000 --> 00:00:21,000\nhallo wereld';
    expect(parseSubtitles(srt, { dedupe: true }).cues).toHaveLength(2);
  });
});

describe('detectLangFromFilename', () => {
  it.each([
    ['video.nl.srt', 'nl'],
    ['video.nl-BE.vtt', 'nl'],
    ['video.tr.json3', 'tr'],
    ['clip [en].srt', 'en'],
    ['Cartoon (de).vtt', 'de'],
    ['episode 1 Turkish.srt', 'tr'],
    ['aflevering_Nederlands.srt', 'nl'],
    ['Where is it.srt', null],
    ['video.mp4', null],
    ['random.srt', null],
  ])('%s -> %s', (name, lang) => {
    expect(detectLangFromFilename(name)).toBe(lang);
  });
});
