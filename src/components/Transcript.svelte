<script lang="ts">
  import { untrack } from 'svelte';
  import VirtualList from './VirtualList.svelte';
  import WordRow from './WordRow.svelte';
  import Mascot from './Mascot.svelte';
  import { app } from '../lib/state.svelte';
  import { player } from '../lib/player/controller.svelte';
  import { alignTracks } from '../lib/player/cues';
  import { t } from '../lib/i18n/index.svelte';

  const primary = $derived(app.visibleTracks[0]);
  const others = $derived(app.visibleTracks.slice(1));
  const aligned = $derived(primary ? alignTracks(primary, others) : []);
  const activeIdx = $derived(primary ? (player.active[primary.id] ?? -1) : -1);

  let list: VirtualList | undefined = $state();
  let lastUserScroll = 0;
  let revealed = $state<Record<string, boolean>>({});

  // Follow playback, but leave the reader alone for a few seconds after they scroll themselves.
  $effect(() => {
    if (activeIdx >= 0 && app.settings.autoScroll && Date.now() - lastUserScroll > 4000) untrack(() => list?.scrollToIndex(activeIdx));
  });

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  function siblings(i: number, skip = -1) {
    return () => [
      ...(skip >= 0 ? [{ lang: primary.lang, text: primary.cues[i].text }] : []),
      ...others.flatMap((o, j) => {
        const k = aligned[i]?.[j] ?? -1;
        return k >= 0 && j !== skip ? [{ lang: o.lang, text: o.cues[k].text }] : [];
      }),
    ];
  }

  function rowClick(e: MouseEvent, i: number) {
    if ((e.target as HTMLElement).closest('.w, .reveal')) return;
    player.seekToCue(primary.id, i);
  }
</script>

{#if !primary}
  <div class="empty">
    <Mascot size={64} />
    <p class="muted">{t('transcript.empty')}</p>
  </div>
{:else}
  <VirtualList
    bind:this={list}
    count={primary.cues.length}
    label={t('tab.transcript')}
    resetKey={app.visibleTracks.map((x) => x.id + x.offset).join()}
    onuser={() => (lastUserScroll = Date.now())}
  >
    {#snippet row(i)}
      {@const cue = primary.cues[i]}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div class="line" class:on={i === activeIdx} onclick={(e) => rowClick(e, i)}>
        <button class="time" onclick={() => player.seekToCue(primary.id, i)} aria-label={t('transcript.line', { time: fmt(cue.start) })}>
          {fmt(cue.start)}
        </button>
        <div class="texts">
          <div class="main"><WordRow text={cue.text} lang={primary.lang} trans={siblings(i)} /></div>
          {#each others as o, j (o.id)}
            {@const k = aligned[i]?.[j] ?? -1}
            {#if k >= 0}
              {#if app.settings.hideSecondary && !revealed[`${o.id}:${k}`]}
                <button class="reveal other" style:color={o.color} onclick={() => (revealed[`${o.id}:${k}`] = true)} aria-label={t('reveal')}>
                  <span class="blur" aria-hidden="true">{o.cues[k].text}</span>
                </button>
              {:else}
                <div class="other" style:color={o.color}><WordRow text={o.cues[k].text} lang={o.lang} trans={siblings(i, j)} /></div>
              {/if}
            {/if}
          {/each}
        </div>
      </div>
    {/snippet}
  </VirtualList>
{/if}

<style>
  .empty { display: grid; justify-items: center; gap: var(--space-3); padding: var(--space-6) var(--space-4); text-align: center; }
  .line { display: flex; gap: var(--space-2); padding: 8px 10px; border-radius: var(--radius-sm); cursor: pointer; margin: 2px 0; }
  .line:hover { background: color-mix(in srgb, var(--accent-soft) 55%, transparent); }
  .line.on { background: var(--accent-soft); box-shadow: inset 3px 0 0 var(--accent); }
  .time {
    all: unset; flex: none; min-width: 42px; padding-top: 3px; text-align: right; cursor: pointer;
    font-size: 0.75rem; color: var(--muted); font-variant-numeric: tabular-nums;
  }
  .time:hover { color: var(--accent); }
  .time:focus-visible { outline: 3px solid var(--focus); border-radius: 4px; }
  .texts { min-width: 0; flex: 1; }
  .main { font-size: 1.05rem; }
  .other { font-size: 0.9rem; margin-top: 2px; }
  button.other { all: unset; display: block; cursor: pointer; font-size: 0.9rem; margin-top: 2px; }
  .blur { filter: blur(5px); user-select: none; }
</style>
