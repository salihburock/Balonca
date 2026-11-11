/**
 * Optional example video. Nothing about a specific video lives in the source: a machine's setup step
 * (`npm run setup:example`) writes `examples/manifest.json` plus the subtitle files next to the site.
 * Without that manifest the app simply starts with an empty player.
 */
export interface ExampleManifest {
  videoId: string;
  subtitles: { file: string; lang: string }[];
}

const ID_RE = /^[\w-]{11}$/;
const FILE_RE = /^[\w.-]{1,120}\.(json3|json|srt|vtt)$/; // plain file names only: no paths, no "..", no URLs
const LANG_RE = /^[A-Za-z0-9-]{1,12}$/;

/** Validates untrusted manifest data; returns null for anything unexpected. */
export function parseManifest(data: unknown): ExampleManifest | null {
  const d = data as { videoId?: unknown; subtitles?: unknown } | null;
  if (!d || typeof d.videoId !== 'string' || !ID_RE.test(d.videoId) || !Array.isArray(d.subtitles)) return null;
  const subtitles = d.subtitles
    .filter((s): s is { file: string; lang: string } =>
      !!s && typeof s.file === 'string' && FILE_RE.test(s.file) && !s.file.includes('..') && typeof s.lang === 'string' && LANG_RE.test(s.lang))
    .slice(0, 4);
  return subtitles.length ? { videoId: d.videoId, subtitles } : null;
}

export const exampleFileUrl = (file: string) => `${import.meta.env.BASE_URL}examples/${file}`;

let cached: Promise<ExampleManifest | null> | null = null;

/** The installed example, or null when none was set up (or the host answers /examples with something else). */
export function loadExample(): Promise<ExampleManifest | null> {
  cached ??= fetch(`${import.meta.env.BASE_URL}examples/manifest.json`, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then(parseManifest)
    .catch(() => null);
  return cached;
}
