// Tiny yt-dlp wrapper API for Balonca. Zero dependencies. See README "Subtitle service".
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export const ID_RE = /^[A-Za-z0-9_-]{11}$/;
// No dots or regex metacharacters: yt-dlp treats --sub-langs values as regular expressions.
export const LANG_RE = /^[A-Za-z0-9_-]{1,24}$/;

export class ApiError extends Error {
  constructor(status, code, detail) { super(code); this.status = status; this.code = code; this.detail = detail; }
}

/** Runs yt-dlp without a shell (arguments are an array), with a timeout and an output cap. */
export function runYtDlp(args, { bin = 'yt-dlp', timeoutMs = 60_000, maxBytes = 30 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '', size = 0, done = false;
    const finish = (fn, v) => { if (!done) { done = true; clearTimeout(timer); fn(v); } };
    const timer = setTimeout(() => { child.kill('SIGKILL'); finish(reject, new ApiError(504, 'timeout')); }, timeoutMs);
    child.stdout.on('data', (d) => {
      size += d.length;
      if (size > maxBytes) { child.kill('SIGKILL'); finish(reject, new ApiError(502, 'too-large')); } else out += d;
    });
    child.stderr.on('data', (d) => { if (err.length < 20_000) err += d; });
    child.on('error', (e) => finish(reject, new ApiError(500, e.code === 'ENOENT' ? 'ytdlp-missing' : 'failed')));
    child.on('close', (code) => (code === 0 ? finish(resolve, { stdout: out, stderr: err }) : finish(reject, classify(err))));
  });
}

export function classify(stderr) {
  const detail = stderr.trim().split('\n').filter((l) => /error/i.test(l)).pop()?.slice(0, 300) ?? stderr.slice(0, 300);
  // YouTube often refuses to serve its machine-translated captions to scripts; the original track is unaffected.
  if (/HTTP Error 429|Too Many Requests/i.test(stderr)) return new ApiError(503, 'yt-rate-limit', detail);
  if (/Sign in to confirm|not a bot|confirm you.re not a bot/i.test(stderr)) return new ApiError(503, 'bot-check', detail);
  if (/Video unavailable|Private video|has been removed|not available|does not exist|members-only/i.test(stderr)) return new ApiError(404, 'not-found', detail);
  return new ApiError(502, 'failed', detail);
}

/** yt-dlp -J output -> the list the website shows. Manual first, then original auto-captions, then auto-translations. */
export function parseTracks(info) {
  const tracks = [];
  const add = (map, auto) => {
    for (const [code, formats] of Object.entries(map ?? {})) {
      if (code === 'live_chat' || !LANG_RE.test(code) || !Array.isArray(formats) || !formats.length) continue;
      const kind = !auto ? 'manual' : code.endsWith('-orig') ? 'auto' : 'auto-translated';
      tracks.push({ code, name: String(formats[0].name ?? code).slice(0, 80), kind });
    }
  };
  add(info.subtitles, false);
  add(info.automatic_captions, true);
  const rank = { manual: 0, auto: 1, 'auto-translated': 2 };
  tracks.sort((a, b) => rank[a.kind] - rank[b.kind] || a.name.localeCompare(b.name));
  return { id: String(info.id), title: String(info.title ?? ''), duration: Number(info.duration) || 0, tracks };
}

const BASE = ['--skip-download', '--no-playlist', '--no-warnings', '--no-progress'];
const watch = (id) => `https://www.youtube.com/watch?v=${id}`;

export async function listTracks(id, run) {
  const { stdout } = await run([...BASE, '--dump-single-json', '--', watch(id)], { timeoutMs: 60_000 });
  let info;
  try { info = JSON.parse(stdout); } catch { throw new ApiError(502, 'failed'); }
  return parseTracks(info);
}

export async function fetchTrack(id, lang, kind, run) {
  const dir = await mkdtemp(path.join(tmpdir(), 'balonca-'));
  try {
    await run([...BASE, kind === 'auto' ? '--write-auto-subs' : '--write-subs', '--sub-langs', lang,
      '--sub-format', 'json3/vtt/srt', '-o', path.join(dir, '%(id)s'), '--', watch(id)], { timeoutMs: 90_000 });
    const file = (await readdir(dir)).find((f) => f.startsWith(`${id}.${lang}.`));
    if (!file) throw new ApiError(404, 'no-subs');
    return { name: file, text: await readFile(path.join(dir, file), 'utf8') };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Counts requests per key in a sliding minute. */
export function rateLimiter(maxPerMinute, now = Date.now) {
  const hits = new Map();
  return (key) => {
    const t = now(), recent = (hits.get(key) ?? []).filter((x) => t - x < 60_000);
    recent.push(t);
    hits.set(key, recent);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((x) => t - x < 60_000)) hits.delete(k);
    return recent.length <= maxPerMinute;
  };
}

/** Allows at most `limit` jobs at once; more than `queueMax` waiting are refused. */
export function semaphore(limit, queueMax) {
  let active = 0;
  const waiting = [];
  const next = () => { while (active < limit && waiting.length) { active++; waiting.shift()(); } };
  return async (fn) => {
    if (active >= limit && waiting.length >= queueMax) throw new ApiError(503, 'busy');
    await new Promise((r) => { waiting.push(r); next(); });
    try { return await fn(); } finally { active--; next(); }
  };
}

export function createHandler({
  run = runYtDlp, allowedOrigins = [], trustProxy = false, ratePerMinute = 30,
  ttlMs = 10 * 60_000, now = Date.now,
} = {}) {
  const limit = rateLimiter(ratePerMinute, now);
  const slot = semaphore(2, 4);
  const cache = new Map(); // key -> { at, value }
  const cached = async (key, make) => {
    const hit = cache.get(key);
    if (hit && now() - hit.at < ttlMs) return hit.value;
    const value = await slot(make);
    cache.set(key, { at: now(), value });
    if (cache.size > 60) cache.delete(cache.keys().next().value);
    return value;
  };

  return async function handle(req, res) {
    const origin = req.headers.origin;
    const send = (status, body, type = 'application/json; charset=utf-8') => {
      res.writeHead(status, {
        'content-type': type, 'x-content-type-options': 'nosniff', 'cache-control': 'private, max-age=60',
        ...(origin && allowedOrigins.includes(origin) ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}),
      });
      res.end(typeof body === 'string' ? body : JSON.stringify(body));
    };
    try {
      if (req.method === 'OPTIONS') return send(204, '');
      if (req.method !== 'GET') throw new ApiError(405, 'method');
      const url = new URL(req.url ?? '/', 'http://x');
      const ip = (trustProxy && String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim()) || req.socket.remoteAddress || '?';
      if (url.pathname === '/api/health') return send(200, { ok: true });
      if (!limit(ip)) throw new ApiError(429, 'rate-limit');

      const id = url.searchParams.get('v') ?? '';
      if (!ID_RE.test(id)) throw new ApiError(400, 'bad-request');

      if (url.pathname === '/api/subs') return send(200, await cached(`l:${id}`, () => listTracks(id, run)));
      if (url.pathname === '/api/sub') {
        const lang = url.searchParams.get('lang') ?? '';
        const kind = url.searchParams.get('kind') === 'manual' ? 'manual' : 'auto';
        if (!LANG_RE.test(lang)) throw new ApiError(400, 'bad-request');
        const r = await cached(`s:${id}:${lang}:${kind}`, () => fetchTrack(id, lang, kind, run));
        return send(200, r.text, r.name.endsWith('.json3') ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8');
      }
      throw new ApiError(404, 'not-found-route');
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(500, 'failed');
      if (err.status >= 500) console.error(`[${new Date().toISOString()}] ${req.url} -> ${err.code}: ${err.detail ?? e?.message ?? ''}`);
      send(err.status, { error: err.code });
    }
  };
}
