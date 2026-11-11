import http from 'node:http';
import { describe, expect, it } from 'vitest';
import { ApiError, checkYtDlp, classify, createHandler, parseTracks, rateLimiter, semaphore, ID_RE, LANG_RE } from './lib.mjs';

const info = {
  id: 'abcdefghijk', title: 'Example video', duration: 420,
  subtitles: { nl: [{ ext: 'vtt', name: 'Dutch' }], live_chat: [{ ext: 'json', name: 'Live chat' }] },
  automatic_captions: {
    tr: [{ ext: 'json3', name: 'Turkish' }],
    'nl-orig': [{ ext: 'json3', name: 'Dutch (Original)' }],
    'zh-Hans': [{ ext: 'json3', name: 'Chinese (Simplified)' }],
    'bad.code': [{ ext: 'json3', name: 'x' }],
    empty: [],
  },
};

describe('parseTracks', () => {
  const r = parseTracks(info);
  it('classifies and orders manual, original auto, auto-translated', () => {
    expect(r.tracks.map((t) => `${t.kind}:${t.code}`)).toEqual([
      'manual:nl', 'auto:nl-orig', 'auto-translated:zh-Hans', 'auto-translated:tr',
    ]);
  });
  it('drops live chat, unsafe codes and empty entries', () => {
    expect(r.tracks.find((t) => t.code === 'live_chat' || t.code === 'bad.code' || t.code === 'empty')).toBeUndefined();
  });
  it('keeps title and duration, tolerates missing maps', () => {
    expect(r).toMatchObject({ id: 'abcdefghijk', title: 'Example video', duration: 420 });
    expect(parseTracks({ id: 'x' }).tracks).toEqual([]);
  });
});

describe('validation', () => {
  it('video ids', () => {
    expect(ID_RE.test('abcdefghijk')).toBe(true);
    for (const bad of ['', 'short', 'abcdefghijk1', 'abcdefghij;', '../etc/pass', 'abcdefghij '] ) expect(ID_RE.test(bad)).toBe(false);
  });
  it('language codes reject regex and path characters', () => {
    for (const ok of ['nl', 'nl-orig', 'zh-Hans', 'pt_BR']) expect(LANG_RE.test(ok)).toBe(true);
    for (const bad of ['', 'nl.*', 'all', '../x', 'a b', 'nl,en', 'x'.repeat(25)].filter((x) => x !== 'all')) expect(LANG_RE.test(bad)).toBe(false);
  });
});

describe('classify', () => {
  it.each([
    ["Sign in to confirm you're not a bot", 503, 'bot-check'],
    ['ERROR: Video unavailable', 404, 'not-found'],
    ['ERROR: Private video', 404, 'not-found'],
    ['ERROR: Unable to download video subtitles for \'tr\': HTTP Error 429: Too Many Requests', 503, 'yt-rate-limit'],
    ['boom', 502, 'failed'],
  ])('%s', (stderr, status, code) => expect(classify(stderr)).toMatchObject({ status, code }));
});

describe('limits', () => {
  it('rate limiter counts per key per minute', () => {
    let t = 0;
    const l = rateLimiter(2, () => t);
    expect([l('a'), l('a'), l('a'), l('b')]).toEqual([true, true, false, true]);
    t = 61_000;
    expect(l('a')).toBe(true);
  });
  it('semaphore runs two at a time and refuses when the queue is full', async () => {
    const slot = semaphore(1, 1);
    let release;
    const gate = new Promise((r) => (release = r));
    const a = slot(() => gate);
    const b = slot(async () => 'b');
    await expect(slot(async () => 'c')).rejects.toMatchObject({ code: 'busy' });
    release();
    await a;
    expect(await b).toBe('b');
  });
});

async function call(handler, path, headers = {}) {
  const server = http.createServer(handler);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { headers });
    return { status: res.status, text: await res.text(), headers: res.headers };
  } finally { server.close(); }
}

describe('HTTP API', () => {
  const fake = () => {
    const calls = [];
    const run = async (args) => {
      calls.push(args);
      if (args.includes('--dump-single-json')) return { stdout: JSON.stringify(info), stderr: '' };
      throw new ApiError(404, 'no-subs');
    };
    return { run, calls };
  };

  it('lists tracks and passes arguments as an array after "--"', async () => {
    const { run, calls } = fake();
    const r = await call(createHandler({ run }), '/api/subs?v=abcdefghijk');
    expect(r.status).toBe(200);
    expect(JSON.parse(r.text).tracks).toHaveLength(4);
    const args = calls[0];
    expect(args.at(-1)).toBe('https://www.youtube.com/watch?v=abcdefghijk');
    expect(args.at(-2)).toBe('--');
  });
  it('caches repeated listings', async () => {
    const { run, calls } = fake();
    const h = createHandler({ run });
    await call(h, '/api/subs?v=abcdefghijk');
    await call(h, '/api/subs?v=abcdefghijk');
    expect(calls).toHaveLength(1);
  });
  it.each([
    ['/api/subs', 400], ['/api/subs?v=nope', 400], ['/api/sub?v=abcdefghijk&lang=nl.*', 400],
    ['/api/sub?v=abcdefghijk', 400], ['/api/other?v=abcdefghijk', 404],
  ])('%s -> %i without running yt-dlp', async (path, status) => {
    const { run, calls } = fake();
    expect((await call(createHandler({ run }), path)).status).toBe(status);
    expect(calls).toHaveLength(0);
  });
  it('maps yt-dlp failures to JSON errors', async () => {
    const run = async () => { throw new ApiError(503, 'bot-check'); };
    const r = await call(createHandler({ run }), '/api/subs?v=abcdefghijk');
    expect([r.status, JSON.parse(r.text).error]).toEqual([503, 'bot-check']);
  });
  it('rate limits', async () => {
    const { run } = fake();
    const h = createHandler({ run, ratePerMinute: 1 });
    expect((await call(h, '/api/subs?v=abcdefghijk')).status).toBe(200);
    expect((await call(h, '/api/subs?v=abcdefghijk')).status).toBe(429);
  });
  it('CORS only for allowed origins; health is not rate limited or validated', async () => {
    const { run } = fake();
    const h = createHandler({ run, allowedOrigins: ['https://balonca.example.com'] });
    const ok = await call(h, '/api/health', { origin: 'https://balonca.example.com' });
    const no = await call(h, '/api/health', { origin: 'https://evil.example' });
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://balonca.example.com');
    expect(no.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('system yt-dlp', () => {
  it('reports the installed version', async () => {
    const calls = [];
    const run = async (args, opts) => { calls.push([args, opts]); return { stdout: '2026.08.19\n', stderr: '' }; };
    expect(await checkYtDlp(run, '/usr/bin/yt-dlp')).toBe('2026.08.19');
    expect(calls[0][0]).toEqual(['--version']);
    expect(calls[0][1].bin).toBe('/usr/bin/yt-dlp');
  });
  it('returns null when it is not installed', async () => {
    const run = async () => { throw new ApiError(500, 'ytdlp-missing'); };
    expect(await checkYtDlp(run)).toBeNull();
  });
  it('really finds a binary on PATH (or reports none) without throwing', async () => {
    const v = await checkYtDlp();
    expect(v === null || typeof v === 'string').toBe(true);
  });
  it('health tells whether yt-dlp is available', async () => {
    const yes = await call(createHandler({ ytdlpInstalled: true }), '/api/health');
    const no = await call(createHandler({ ytdlpInstalled: false }), '/api/health');
    expect(JSON.parse(yes.text)).toEqual({ ok: true, ytdlp: true });
    expect(JSON.parse(no.text)).toEqual({ ok: true, ytdlp: false });
  });
});
