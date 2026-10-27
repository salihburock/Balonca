<script lang="ts">
  import { onMount } from 'svelte';
  import Overlay from './Overlay.svelte';
  import Mascot from './Mascot.svelte';
  import { app } from '../lib/state.svelte';
  import { player } from '../lib/player/controller.svelte';
  import { t } from '../lib/i18n/index.svelte';
  import type { MessageKey } from '../lib/i18n/tr';

  let wrap: HTMLDivElement;
  let host: HTMLDivElement;
  let stage: HTMLDivElement;
  let full = $state(false);
  let pseudo = $state(false); // iPhone Safari cannot fullscreen arbitrary elements
  let seeking = $state<number | null>(null);

  const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const fmt = (s: number) => {
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return `${h ? h + ':' + String(m).padStart(2, '0') : m}:${String(s % 60).padStart(2, '0')}`;
  };

  onMount(() => {
    void player.mount(host);

    // Keep the subtitle size proportional to the video size (phones vs. fullscreen).
    const ro = new ResizeObserver(([e]) => {
      stage.style.setProperty('--sub-scale', String(Math.min(2.4, Math.max(0.55, e.contentRect.width / 720))));
    });
    ro.observe(stage);

    // Clicking inside the iframe steals keyboard focus; hand it back so shortcuts keep working.
    const reclaim = () => setTimeout(() => {
      if (document.activeElement === player.iframe()) (document.activeElement as HTMLElement).blur();
    }, 0);
    window.addEventListener('blur', reclaim);

    const onFs = () => (full = document.fullscreenElement === wrap);
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);

    return () => {
      ro.disconnect();
      window.removeEventListener('blur', reclaim);
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('webkitfullscreenchange', onFs);
      player.destroy();
    };
  });

  export function toggleFullscreen() {
    if (pseudo) { pseudo = false; document.body.classList.remove('pseudo-fs'); return; }
    if (document.fullscreenElement) { void document.exitFullscreen(); return; }
    const el = wrap as HTMLElement & { webkitRequestFullscreen?: () => void };
    if (el.requestFullscreen) void el.requestFullscreen().catch(() => (pseudo = true));
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else { pseudo = true; document.body.classList.add('pseudo-fs'); }
  }

  const isFull = $derived(full || pseudo);
  const shown = $derived(seeking ?? player.time);
</script>

<div class="wrap" class:full={isFull} bind:this={wrap}>
  <div class="stage" bind:this={stage} style:--sub-size="{app.settings.subSize}px" style:--sub-bg={app.settings.subBg / 100}>
    <div class="yt"><div bind:this={host}></div></div>
    {#if !app.vid}
      <div class="placeholder">
        <Mascot size={72} float />
        <strong>{t('watch.empty.title')}</strong>
        <span>{t('watch.empty.desc')}</span>
      </div>
    {/if}
    {#if player.error}
      <div class="placeholder error" role="alert">{t(`err.${player.error}` as MessageKey)}</div>
    {/if}
    <Overlay />
  </div>

  <div class="controls">
    <div class="seek">
      <span class="time" aria-hidden="true">{fmt(shown)}</span>
      <input
        type="range" min="0" max={Math.max(1, Math.floor(player.duration))} step="1" value={Math.floor(shown)}
        aria-label={t('ctl.seek')} aria-valuetext={`${fmt(shown)} / ${fmt(player.duration)}`}
        oninput={(e) => (seeking = +e.currentTarget.value)}
        onchange={(e) => { player.seek(+e.currentTarget.value); seeking = null; }}
      />
      <span class="time" aria-hidden="true">{fmt(player.duration)}</span>
    </div>
    <div class="buttons">
      <button onclick={() => player.jump(-1)} aria-label={t('ctl.prev')} title={t('ctl.prev')}>⏮</button>
      <button class="primary play" onclick={() => player.toggle()} aria-label={player.playing ? t('ctl.pause') : t('ctl.play')}>
        {player.playing ? '⏸' : '▶'}
      </button>
      <button onclick={() => player.jump(1)} aria-label={t('ctl.next')} title={t('ctl.next')}>⏭</button>
      <select aria-label={t('ctl.speed')} value={player.rate} onchange={(e) => player.setRate(+e.currentTarget.value)}>
        {#each RATES as r}<option value={r}>{r}×</option>{/each}
      </select>
      <button class="toggle" aria-pressed={player.loop} onclick={() => (player.loop = !player.loop)} aria-label={t('ctl.loop')} title="{t('ctl.loop')} (R)">⟲</button>
      <button class="spacer" onclick={toggleFullscreen} aria-label={isFull ? t('ctl.exitFullscreen') : t('ctl.fullscreen')} title="{t('ctl.fullscreen')} (F)">
        {isFull ? '🗗' : '⛶'}
      </button>
    </div>
  </div>
</div>

<style>
  .wrap { display: grid; gap: var(--space-2); }
  .stage { position: relative; background: #000; aspect-ratio: 16 / 9; border-radius: var(--radius); overflow: hidden; box-shadow: var(--shadow-lg); }
  .yt, .yt :global(iframe) { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
  .placeholder {
    position: absolute; inset: 0; z-index: 4; display: grid; place-content: center; justify-items: center; gap: 8px;
    padding: var(--space-4); text-align: center; color: #e9e4f7;
    background: radial-gradient(circle at 50% 30%, #3b2f6b, #1b1630);
  }
  .placeholder span { opacity: 0.8; max-width: 26rem; }
  .placeholder.error { background: #2a1420; color: #ffd5de; }
  .controls { display: grid; gap: var(--space-2); }
  .seek { display: flex; align-items: center; gap: var(--space-2); }
  .seek input { flex: 1; min-width: 0; accent-color: var(--accent); min-height: 32px; }
  .time { font-variant-numeric: tabular-nums; font-size: 0.85rem; color: var(--muted); min-width: 3.2rem; text-align: center; }
  .buttons { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
  .buttons button { min-width: 44px; padding: 0 12px; }
  .play { min-width: 56px !important; }
  .toggle[aria-pressed='true'] { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }
  .spacer { margin-left: auto; }
  select { min-width: 72px; }

  .wrap.full { position: fixed; inset: 0; z-index: 100; background: #000; padding: 0; gap: 0; grid-template-rows: 1fr auto; }
  .wrap.full .stage { aspect-ratio: auto; border-radius: 0; box-shadow: none; }
  .wrap.full .controls { background: #14111f; padding: var(--space-2) var(--space-3); padding-bottom: max(var(--space-2), env(safe-area-inset-bottom)); color: #fff; }
  .wrap.full .time { color: #cfc8e8; }
  .wrap:fullscreen { background: #000; grid-template-rows: 1fr auto; gap: 0; }
  .wrap:fullscreen .stage { aspect-ratio: auto; border-radius: 0; box-shadow: none; }
  .wrap:fullscreen .controls { background: #14111f; padding: var(--space-2) var(--space-3); color: #fff; }
</style>
