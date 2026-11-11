// Installs an optional example video's subtitles onto a machine. Nothing about any particular video is
// stored in this repository: the video comes from EXAMPLE_VIDEO (or the command line) at setup time.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ID_RE, fetchTrack, listTracks, runYtDlp } from '../server/lib.mjs';

/** Accepts a YouTube URL (watch, youtu.be, shorts, embed, live) or a bare 11-character id. */
export function parseVideoRef(input) {
  const s = String(input ?? '').trim();
  const m = s.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/|\/v\/)([\w-]{11})(?![\w-])/) ?? s.match(/^([\w-]{11})$/);
  return m && ID_RE.test(m[1]) ? m[1] : null;
}

/** With no explicit choice: the first human-made track, otherwise the first original auto-caption. */
export function pickDefaultTracks(tracks) {
  const t = tracks.find((x) => x.kind === 'manual') ?? tracks.find((x) => x.kind === 'auto');
  return t ? [t] : [];
}

export const baseLang = (code) => code.replace(/-orig$/i, '').split('-')[0].toLowerCase();

async function readManifest(dir) {
  try { return JSON.parse(await readFile(path.join(dir, 'manifest.json'), 'utf8')); } catch { return null; }
}

/**
 * Downloads the subtitles with the system yt-dlp and writes `<outDir>/manifest.json`, which the web app reads on
 * first visit. Safe to run again: it does nothing when this video is already installed (unless `force`).
 * Returns { status: 'no-config' | 'already-installed' | 'installed', manifest? }.
 */
export async function installExample({ video, langs = [], outDir, force = false, run = runYtDlp, log = () => {} }) {
  if (!video) return { status: 'no-config' };
  const id = parseVideoRef(video);
  if (!id) throw new Error(`"${video}" is not a YouTube link or video id`);

  const existing = await readManifest(outDir);
  if (!force && existing?.videoId === id && Array.isArray(existing.subtitles) && existing.subtitles.length) {
    return { status: 'already-installed', manifest: existing };
  }

  log(`Looking up subtitles for ${id}…`);
  const info = await listTracks(id, run);
  const wanted = langs.length
    ? langs.map((code) => {
        const t = info.tracks.find((x) => x.code === code);
        if (!t) throw new Error(`The video has no subtitle "${code}". Available: ${info.tracks.slice(0, 12).map((x) => x.code).join(', ')}…`);
        return t;
      })
    : pickDefaultTracks(info.tracks);
  if (!wanted.length) throw new Error('The video has no subtitles to install.');

  await mkdir(outDir, { recursive: true });
  const subtitles = [];
  for (const t of wanted) {
    log(`Downloading ${t.code} (${t.name})…`);
    const file = await fetchTrack(id, t.code, t.kind === 'manual' ? 'manual' : 'auto', run);
    await writeFile(path.join(outDir, file.name), file.text);
    subtitles.push({ file: file.name, lang: baseLang(t.code) });
  }
  const manifest = { videoId: id, subtitles };
  await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n'); // last: marks success
  return { status: 'installed', manifest };
}
