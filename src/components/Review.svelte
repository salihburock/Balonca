<script lang="ts">
  import Mascot from './Mascot.svelte';
  import { app } from '../lib/state.svelte';
  import { reviewQueue, schedule, DAY, type Grade } from '../lib/srs/scheduler';
  import { tokenize } from '../lib/words/tokenize';
  import { t, i18n } from '../lib/i18n/index.svelte';
  import { langName } from '../lib/languages';

  let { lang, onclose }: { lang: string; onclose: () => void } = $props();

  // The session queue is fixed when it starts; "again" cards go to the back of it.
  let queue = $state<string[]>(reviewQueue(app.words.filter((w) => w.lang === lang)).map((w) => w.id));
  let reviewed = $state(0);
  let shown = $state(false);

  const card = $derived(app.words.find((w) => w.id === queue[0]));
  const parts = $derived(card ? tokenize(card.ctx, card.lang) : []);

  function preview(g: Grade): string {
    if (!card) return '';
    if (g === 'again') return t('review.again.hint');
    const s = schedule(card, g);
    return t('review.days', { n: Math.max(1, Math.round((s.due! - Date.now()) / DAY)) });
  }

  function answer(g: Grade) {
    if (!card) return;
    const id = card.id;
    app.grade(id, g);
    reviewed++;
    queue = g === 'again' ? [...queue.slice(1), id] : queue.slice(1);
    shown = false;
  }

  function onkey(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey || !card) return;
    if (!shown && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); shown = true; }
    else if (shown && e.key === '1') answer('again');
    else if (shown && e.key === '2') answer('good');
    else if (shown && e.key === '3') answer('easy');
    else if (e.key === 'Escape') onclose();
  }
</script>

<svelte:window onkeydown={onkey} />

<section class="review card" aria-label={t('review.title')}>
  <header>
    <h2>{t('review.title')} · {langName(lang, i18n.locale)}</h2>
    <button onclick={onclose}>{t('review.finish')}</button>
  </header>

  {#if card}
    <p class="muted left" aria-live="polite">{t('review.left', { n: queue.length })}</p>
    <div class="face">
      <div class="word" lang={card.lang}>{card.w}</div>
      {#if !shown}
        <p class="muted">{t('review.hint')}</p>
        <button class="primary big" onclick={() => (shown = true)}>{t('review.show')}</button>
      {:else}
        <div class="back" aria-live="polite">
          <div class="label muted">{t('review.context')}</div>
          <p class="sentence" lang={card.lang}>{#each parts as p}{#if p.isWord && p.key === card.w}<mark>{p.text}</mark>{:else}{p.text}{/if}{/each}</p>
          {#each card.trans as tr}<p class="trans" lang={tr.lang}>{tr.text}</p>{/each}
        </div>
        <div class="grades">
          <button class="again" onclick={() => answer('again')}><strong>{t('review.again')}</strong><small>{preview('again')}</small><kbd>1</kbd></button>
          <button class="good primary" onclick={() => answer('good')}><strong>{t('review.good')}</strong><small>{preview('good')}</small><kbd>2</kbd></button>
          <button class="easy" onclick={() => answer('easy')}><strong>{t('review.easy')}</strong><small>{preview('easy')}</small><kbd>3</kbd></button>
        </div>
      {/if}
    </div>
  {:else}
    <div class="done">
      <Mascot size={96} float />
      <h3>{t('review.done')}</h3>
      <p class="muted">{t('review.done.desc', { n: reviewed })}</p>
      <button class="primary" onclick={onclose}>{t('review.finish')}</button>
    </div>
  {/if}
</section>

<style>
  .review { display: grid; gap: var(--space-3); margin-bottom: var(--space-4); }
  header { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); }
  h2 { font-size: 1.15rem; }
  .left { margin: 0; text-align: center; font-size: 0.9rem; }
  .face { display: grid; justify-items: center; gap: var(--space-4); text-align: center; padding: var(--space-4) 0; }
  .word { font: 800 clamp(2rem, 8vw, 3.2rem) var(--font-display); color: var(--accent); overflow-wrap: anywhere; }
  .big { min-height: 52px; padding: 0 var(--space-6); font-size: 1.05rem; }
  .back { display: grid; gap: var(--space-2); max-width: 36rem; }
  .label { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; }
  .sentence { font-size: 1.2rem; margin: 0; }
  .trans { margin: 0; color: var(--muted); font-size: 1.05rem; }
  mark { background: var(--accent-soft); color: var(--accent); border-radius: 6px; padding: 0 4px; font-weight: 700; }
  .grades { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-3); width: min(100%, 30rem); }
  .grades button { display: grid; gap: 2px; justify-items: center; padding: var(--space-3) var(--space-2); min-height: 72px; }
  .grades small { opacity: 0.8; font-weight: 400; }
  .grades kbd { font-size: 0.7rem; opacity: 0.6; }
  .again { border-color: var(--danger); }
  .done { display: grid; justify-items: center; gap: var(--space-3); padding: var(--space-5) 0; text-align: center; }
</style>
