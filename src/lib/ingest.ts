import { app } from './state.svelte';
import { SubtitleParseError } from './subtitles';
import { t } from './i18n/index.svelte';
import { toast } from './toast.svelte';
import type { MessageKey } from './i18n/tr';

const MAX_BYTES = 30 * 1024 * 1024;

/** Adds one subtitle (file contents or pasted text) to the current video, reporting the outcome to the user. */
export function ingestText(text: string, name: string, lang?: string): boolean {
  try {
    const { track, result } = app.addTrack(text, name, lang);
    toast(t('tracks.added', { name, n: result.cues.length }), 'success');
    if (result.merged) toast(t('tracks.merged', { n: result.merged }), 'info');
    if (result.skipped) toast(t('tracks.skipped', { n: result.skipped }), 'info');
    if (track.lang === '??') toast(t('tracks.langUnknown'), 'info', 7000);
    return true;
  } catch (e) {
    if (e instanceof SubtitleParseError) toast(t(`parse.${e.code}` as MessageKey, { name }), 'error', 8000);
    else toast(t('parse.unknown-format', { name }), 'error', 8000);
    return false;
  }
}

export async function ingestFiles(files: Iterable<File>): Promise<void> {
  if (!app.vid) { toast(t('tracks.needVideo'), 'error'); return; }
  for (const f of files) {
    if (f.size > MAX_BYTES) { toast(t('parse.binary', { name: f.name }), 'error'); continue; }
    ingestText(await f.text(), f.name);
  }
}
