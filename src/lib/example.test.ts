import { describe, expect, it } from 'vitest';
import { parseManifest } from './example';

const ok = { videoId: 'abcdefghijk', subtitles: [{ file: 'abcdefghijk.nl-orig.json3', lang: 'nl' }] };

describe('parseManifest', () => {
  it('accepts what the setup script writes', () => {
    expect(parseManifest(ok)).toEqual(ok);
  });
  it.each([
    ['null', null], ['not an object', 'x'], ['bad id', { ...ok, videoId: 'short' }], ['id with url chars', { ...ok, videoId: 'abc/def.ghi' }],
    ['no subtitles', { ...ok, subtitles: [] }], ['subtitles not an array', { ...ok, subtitles: 'a.json' }],
  ])('rejects %s', (_n, data) => expect(parseManifest(data)).toBeNull());

  it('drops unsafe file names, bad languages and wrong types, keeping the valid entries', () => {
    const m = parseManifest({
      videoId: 'abcdefghijk',
      subtitles: [
        { file: '../secret.json', lang: 'nl' }, { file: 'https://evil.example/x.json', lang: 'nl' },
        { file: 'dir/x.json', lang: 'nl' }, { file: 'a..b.json', lang: 'nl' }, { file: 'x.exe', lang: 'nl' },
        { file: 'x.json', lang: '<b>' }, { file: 5, lang: 'nl' }, null,
        { file: 'good.vtt', lang: 'tr' },
      ],
    });
    expect(m?.subtitles).toEqual([{ file: 'good.vtt', lang: 'tr' }]);
  });
  it('keeps at most four tracks', () => {
    const subtitles = Array.from({ length: 9 }, (_, i) => ({ file: `s${i}.json`, lang: 'nl' }));
    expect(parseManifest({ videoId: 'abcdefghijk', subtitles })?.subtitles).toHaveLength(4);
  });
});
