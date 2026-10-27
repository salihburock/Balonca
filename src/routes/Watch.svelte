<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import VideoStage from '../components/VideoStage.svelte';
  import Transcript from '../components/Transcript.svelte';
  import TracksPanel from '../components/TracksPanel.svelte';
  import SettingsPanel from '../components/SettingsPanel.svelte';
  import WordsMini from '../components/WordsMini.svelte';
  import Tabs from '../components/Tabs.svelte';
  import { app } from '../lib/state.svelte';
  import { player } from '../lib/player/controller.svelte';
  import { router, watchUrl } from '../lib/router.svelte';
  import { parseVideoId } from '../lib/player/youtube';
  import { EXAMPLE_VIDEO_ID } from '../lib/example';
  import { t } from '../lib/i18n/index.svelte';

  type TabId = 'transcript' | 'words' | 'tracks' | 'settings';
  let tab = $state<TabId>('transcript');
  let stage: VideoStage;
  let url = $state('');
  let urlError = $state(false);

  const tabs = $derived<{ id: TabId; label: string }[]>([
    { id: 'transcript', label: t('tab.transcript') },
    { id: 'words', label: t('tab.words') },
    { id: 'tracks', label: t('tab.tracks') },
    { id: 'settings', label: t('tab.settings') },
  ]);

  function submit(e: SubmitEvent) {
    e.preventDefault();
    const id = parseVideoId(url);
    urlError = !id;
    if (id) location.hash = watchUrl(id);
  }

  // The URL is the source of truth: #/watch?v=ID&t=SECONDS (also used by "jump to word").
  $effect(() => {
    if (router.route !== 'watch') { untrack(() => player.pause()); return; }
    const v = router.params.get('v') ?? untrack(() => app.vid) ?? EXAMPLE_VIDEO_ID; // first visit: the example video
    const at = Number(router.params.get('t')) || 0;
    if (!v || !parseVideoId(v)) return;
    untrack(async () => {
      await app.openVideo(v);
      url = `https://youtu.be/${v}`;
      if (player.loaded !== v) player.load(v, at);
      else if (at) player.seek(at);
    });
  });

  function isTyping(el: EventTarget | null) {
    return el instanceof HTMLElement && !!el.closest('input, textarea, select, [contenteditable]');
  }

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (router.route !== 'watch' || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      const onButton = e.target instanceof HTMLElement && !!e.target.closest('button, a, summary');
      const k = e.key;
      if (k === ' ' && !onButton) { e.preventDefault(); player.toggle(); }
      else if (k === 'ArrowLeft') { e.preventDefault(); player.jump(-1); }
      else if (k === 'ArrowRight') { e.preventDefault(); player.jump(1); }
      else if (k === 'r' || k === 'R') player.loop = !player.loop;
      else if (k === 'f' || k === 'F') stage.toggleFullscreen();
      else if (k === 'w' || k === 'W') {
        const first = document.querySelector<HTMLElement>('.overlay button.w');
        if (first) { player.pause(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
</script>

<div class="watch">
  <div class="video-col">
    <form class="url" onsubmit={submit}>
      <label class="sr-only" for="yt-url">{t('watch.url.label')}</label>
      <input id="yt-url" type="url" inputmode="url" bind:value={url} placeholder={t('watch.url.placeholder')} aria-invalid={urlError} autocomplete="off" />
      <button class="primary" type="submit">{t('watch.load')}</button>
    </form>
    {#if urlError}<p class="error" role="alert">{t('watch.badlink')}</p>{/if}
    {#if !app.storageOk}<p class="notice" role="status">{t('watch.nostorage')}</p>{/if}
    <VideoStage bind:this={stage} />
  </div>

  <aside class="card side">
    <Tabs {tabs} bind:active={tab} label={t('nav.watch')}>
      {#snippet panel(id)}
        {#if id === 'transcript'}<div class="transcript"><Transcript /></div>
        {:else if id === 'words'}<WordsMini />
        {:else if id === 'tracks'}<TracksPanel />
        {:else}<SettingsPanel />{/if}
      {/snippet}
    </Tabs>
  </aside>
</div>

<style>
  .watch { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(320px, 1fr); gap: var(--space-4); align-items: start; }
  .video-col { display: grid; gap: var(--space-2); min-width: 0; }
  .url { display: flex; gap: var(--space-2); }
  .url input { flex: 1; min-width: 0; }
  .error { color: var(--danger); margin: 0; font-weight: 700; }
  .notice { margin: 0; padding: var(--space-3); border-radius: var(--radius-sm); background: var(--accent-soft); }
  .side { padding: var(--space-3); min-width: 0; }
  .transcript { height: min(68dvh, 720px); min-height: 320px; }

  @media (min-width: 901px) {
    .video-col { position: sticky; top: calc(var(--header-h, 64px) + var(--space-3)); }
  }
  @media (max-width: 900px) {
    .watch { grid-template-columns: 1fr; gap: var(--space-3); }
    /* video stays in view while the transcript / words scroll underneath */
    .video-col { position: sticky; top: var(--header-h, 100px); z-index: 20; background: var(--bg); padding-bottom: var(--space-2); margin: 0 calc(var(--space-4) * -1); padding-inline: var(--space-4); }
    .transcript { height: 52dvh; min-height: 260px; }
  }
</style>
