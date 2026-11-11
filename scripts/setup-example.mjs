#!/usr/bin/env node
// First-time setup of the example video (optional). Run once per machine, before `npm run build`:
//   EXAMPLE_VIDEO="https://www.youtube.com/watch?v=VIDEO_ID" npm run setup:example
// Options: --out DIR (default public/examples; use dist/examples for an already built site)
//          --langs nl-orig,tr (default: the best original track)   --force (download again)
// Uses the yt-dlp installed on this machine (YTDLP_BIN overrides).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installExample } from './example-lib.mjs';
import { runYtDlp } from '../server/lib.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const positional = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--') )[0];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.resolve(value('out') ?? path.join(root, 'public', 'examples'));
const langs = (value('langs') ?? process.env.EXAMPLE_LANGS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const bin = process.env.YTDLP_BIN || 'yt-dlp';

try {
  const r = await installExample({
    video: positional ?? process.env.EXAMPLE_VIDEO, langs, outDir, force: flag('force'),
    run: (a, o) => runYtDlp(a, { ...o, bin }), log: (m) => console.log(m),
  });
  if (r.status === 'no-config') console.log('No example video configured: the app will start with an empty player.\nTo add one: EXAMPLE_VIDEO="<YouTube link>" npm run setup:example');
  else if (r.status === 'already-installed') console.log(`Example already installed in ${outDir} (use --force to download again).`);
  else console.log(`Installed example ${r.manifest.videoId} (${r.manifest.subtitles.map((s) => s.file).join(', ')}) in ${outDir}`);
} catch (e) {
  console.error(`Example setup failed: ${e.code ?? ''} ${e.message}${e.detail ? `\n${e.detail}` : ''}`.trim());
  process.exit(1);
}
