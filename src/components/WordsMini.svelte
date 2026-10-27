<script lang="ts">
  import Mascot from './Mascot.svelte';
  import { app } from '../lib/state.svelte';
  import { player } from '../lib/player/controller.svelte';
  import { t, i18n } from '../lib/i18n/index.svelte';
  import { langName } from '../lib/languages';

  const mine = $derived(app.words.filter((w) => w.vid && w.vid === app.vid).sort((a, b) => b.added - a.added));
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
</script>

<div class="panel">
  <div class="top">
    <h3>{t('words.here')} <span class="count">{mine.length}</span></h3>
    <a href="#/words">{t('words.all')} →</a>
  </div>
  {#if !mine.length}
    <div class="empty"><Mascot size={56} /><p class="muted">{t('words.here.empty')}</p></div>
  {:else}
    <ul>
      {#each mine as w (w.id)}
        <li>
          <div class="body">
            <strong lang={w.lang}>{w.w}</strong> <span class="tag">{langName(w.lang, i18n.locale)}</span>
            <div class="ctx muted" lang={w.lang}>{w.ctx}</div>
          </div>
          <button onclick={() => player.seek(w.t)} aria-label={t('words.play', { time: fmt(w.t) })}>▶ {fmt(w.t)}</button>
          <button class="del" onclick={() => app.removeWord(w.id)} aria-label={t('words.remove', { word: w.w })}>✕</button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .panel { display: grid; gap: var(--space-3); }
  .top { display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-3); }
  h3 { font-size: 1rem; }
  .count { background: var(--accent-soft); color: var(--accent); border-radius: 99px; padding: 1px 10px; font-size: 0.85rem; }
  .empty { display: grid; justify-items: center; gap: var(--space-2); text-align: center; padding: var(--space-5) 0; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-3) 0; border-top: 1px solid var(--line); }
  .body { flex: 1; min-width: 0; }
  .ctx { font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
  .tag { font-size: 0.75rem; color: var(--muted); }
  li button { padding: 0 12px; min-width: 44px; }
  .del { color: var(--danger); }
</style>
