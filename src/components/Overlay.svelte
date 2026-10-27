<script lang="ts">
  import WordRow from './WordRow.svelte';
  import { app } from '../lib/state.svelte';
  import { player } from '../lib/player/controller.svelte';
  import { t } from '../lib/i18n/index.svelte';

  /** Secondary lines the user chose to reveal, per track: remembered until the line changes. */
  let revealed = $state<Record<string, number>>({});

  const lines = $derived(
    app.visibleTracks
      .map((tr, i) => ({ tr, i, idx: player.active[tr.id] ?? -1 }))
      .filter((l) => l.idx >= 0),
  );
  /** Translations to store with a saved word: every other line on screen right now. */
  const siblings = (me: string) => () =>
    lines.filter((x) => x.tr.id !== me).map((x) => ({ lang: x.tr.lang, text: x.tr.cues[x.idx].text }));
  const hidden = (l: { tr: { id: string }; i: number; idx: number }) =>
    app.settings.hideSecondary && l.i > 0 && revealed[l.tr.id] !== l.idx;
</script>

<div class="overlay {app.settings.subStyle}" data-wordmode>
  {#each lines as l (l.tr.id)}
    {@const cue = l.tr.cues[l.idx]}
    {#if hidden(l)}
      <button class="line secondary" onclick={() => (revealed[l.tr.id] = l.idx)} aria-label={t('reveal')}>
        <i style:background={l.tr.color}></i><span class="blur" aria-hidden="true">{cue.text}</span>
      </button>
    {:else}
      <div class="line" class:secondary={l.i > 0}>
        <i style:background={l.tr.color}></i><WordRow text={cue.text} lang={l.tr.lang} trans={siblings(l.tr.id)} />
      </div>
    {/if}
  {/each}
</div>

<style>
  .overlay {
    position: absolute; left: 2%; right: 2%; bottom: 8%; z-index: 5;
    display: flex; flex-direction: column; align-items: center; gap: 0.2em;
    pointer-events: none;
    font-size: calc(var(--sub-size) * var(--sub-scale, 1));
    line-height: 1.3; color: #fff; text-align: center;
  }
  .line {
    all: unset;
    box-sizing: border-box;
    pointer-events: auto; max-width: 100%;
    padding: 0.08em 0.55em; border-radius: 0.45em;
    font: inherit; text-align: center; color: inherit;
  }
  button.line { cursor: pointer; }
  button.line:focus-visible { outline: 3px solid var(--pink); }
  i { display: inline-block; width: 0.35em; height: 0.35em; border-radius: 50%; margin-right: 0.45em; vertical-align: middle; }
  .blur { filter: blur(0.28em); user-select: none; }
  .secondary { font-size: 0.85em; }

  .box .line { background: rgb(0 0 0 / var(--sub-bg)); text-shadow: 0 1px 2px #000; }
  .outline .line {
    paint-order: stroke fill; -webkit-text-stroke: 0.16em #000;
    text-shadow: 0 0 0.1em #000, 0 0.04em 0.1em #000;
  }
  .shadow .line { text-shadow: 0 0 0.18em #000, 0 0.05em 0.12em #000, 0 0.08em 0.24em #000, 0 0 0.5em #000; }
  .contrast .line { background: #000; color: #ffe14a; font-weight: 700; }
  .contrast :global(.w:hover) { color: #000; background: #ffe14a; }
  .contrast :global(.w.sv) { text-decoration-color: #ff8fb8; }
</style>
