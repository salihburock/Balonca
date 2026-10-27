<script lang="ts">
  import Mascot from '../components/Mascot.svelte';
  import Review from '../components/Review.svelte';
  import ConfirmButton from '../components/ConfirmButton.svelte';
  import { app } from '../lib/state.svelte';
  import { t, i18n } from '../lib/i18n/index.svelte';
  import { langName } from '../lib/languages';
  import { countByLang, filterWords, toCsv, languagesIn } from '../lib/words/bags';
  import { progress, reviewQueue } from '../lib/srs/scheduler';
  import { download } from '../lib/download';
  import { toast } from '../lib/toast.svelte';
  import { watchUrl } from '../lib/router.svelte';
  import { BackupError } from '../lib/storage';
  import type { MessageKey } from '../lib/i18n/tr';

  const PAGE = 100;
  let picked = $state<string | null>(null);
  let query = $state('');
  let limit = $state(PAGE);
  let reviewing = $state(false);
  let pendingBackup = $state<string | null>(null);
  let importInput: HTMLInputElement;

  const langs = $derived(languagesIn(app.words));
  const lang = $derived(picked && langs.includes(picked) ? picked : (langs[0] ?? null));
  const counts = $derived(countByLang(app.words));
  const inLang = $derived(lang ? app.words.filter((w) => w.lang === lang) : []);
  const stats = $derived(progress(inLang));
  const all = $derived(filterWords(app.words, { lang: lang ?? undefined, query }));
  const shown = $derived(all.slice(0, limit));
  const dueCount = $derived(reviewQueue(inLang).length);
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  $effect(() => { void lang; void query; limit = PAGE; });

  async function exportAll() {
    try {
      download(await app.exportAll(), `balonca-backup-${new Date().toISOString().slice(0, 10)}.json`);
      toast(t('backup.exported'), 'success');
    } catch { toast(t('backup.err.no-storage'), 'error'); }
  }
  async function picks(file: File | undefined) {
    if (file) pendingBackup = await file.text();
  }
  async function doImport(mode: 'merge' | 'replace') {
    try {
      const r = await app.importAll(pendingBackup!, mode);
      toast(t('backup.done', r), 'success');
      pendingBackup = null;
    } catch (e) {
      const code = e instanceof BackupError ? e.code : 'no-storage';
      toast(t(`backup.err.${code}` as MessageKey), 'error', 7000);
    }
  }
</script>

<div class="page">
  <h1>{t('words.title')}</h1>

  {#if reviewing && lang}
    <Review {lang} onclose={() => (reviewing = false)} />
  {/if}

  {#if !app.words.length}
    <div class="card empty">
      <Mascot size={96} float />
      <h2>{t('words.empty.title')}</h2>
      <p class="muted">{t('words.empty.desc')}</p>
      <a class="cta" href="#/watch">{t('words.empty.cta')}</a>
    </div>
  {:else}
    <div class="stats">
      <div class="card stat"><b>{stats.total}</b><span>{t('words.total')}</span></div>
      <div class="card stat"><b>{stats.due}</b><span>{t('words.due')}</span></div>
      <div class="card stat"><b>{stats.learned}</b><span>{t('words.learned')}</span></div>
    </div>
    <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={stats.percent} aria-label={t('words.progress', { n: stats.percent })}>
      <span style:width="{stats.percent}%"></span>
    </div>
    <p class="muted pct">{t('words.progress', { n: stats.percent })}</p>

    <div class="card">
      <div class="chips" role="group" aria-label={t('words.title')}>
        {#each langs as l}
          <button class="chip" class:on={l === lang} aria-pressed={l === lang} onclick={() => (picked = l)}>
            {langName(l, i18n.locale)} <span class="n">{counts[l]}</span>
          </button>
        {/each}
      </div>
      <div class="tools">
        <input type="search" bind:value={query} placeholder={t('words.search')} aria-label={t('words.search')} />
        <button class="primary" disabled={!dueCount} onclick={() => (reviewing = true)} title={dueCount ? '' : t('words.review.none')}>
          {t('words.review', { n: dueCount })}
        </button>
        <button onclick={() => lang && download(new Blob([toCsv(inLang)], { type: 'text/csv;charset=utf-8' }), `balonca-${lang}.csv`)}>{t('words.csv')}</button>
        {#if lang}
          <ConfirmButton onconfirm={() => { app.clearLanguage(lang!); picked = null; }}>{t('words.clear')}</ConfirmButton>
        {/if}
      </div>

      {#if !shown.length}
        <p class="muted">{t('words.none')}</p>
      {:else}
        <ul class="list">
          {#each shown as w (w.id)}
            <li>
              <div class="body">
                <strong lang={w.lang}>{w.w}</strong>
                {#if (w.ivl ?? 0) >= 7}<span class="badge" title={t('words.learned')}>✓</span>{/if}
                <div class="ctx muted" lang={w.lang}>{w.ctx}</div>
                {#each w.trans as tr}<div class="ctx tr" lang={tr.lang}>{tr.text}</div>{/each}
              </div>
              {#if w.vid}<a class="btn" href={watchUrl(w.vid, w.t)} aria-label={t('words.play', { time: fmt(w.t) })}>▶ {fmt(w.t)}</a>{/if}
              <button class="del" onclick={() => app.removeWord(w.id)} aria-label={t('words.remove', { word: w.w })}>✕</button>
            </li>
          {/each}
        </ul>
        {#if all.length > shown.length}
          <button class="more" onclick={() => (limit += PAGE)}>+ {all.length - shown.length}</button>
        {/if}
      {/if}
    </div>
  {/if}

  <div class="card backup">
    <h2>{t('backup.title')}</h2>
    <p class="muted">{t('backup.desc')}</p>
    <div class="row">
      <button onclick={exportAll}>{t('backup.export')}</button>
      <button onclick={() => importInput.click()}>{t('backup.import')}</button>
      <input bind:this={importInput} type="file" accept=".json,application/json" hidden
        onchange={(e) => { picks(e.currentTarget.files?.[0]); e.currentTarget.value = ''; }} />
    </div>
    {#if pendingBackup}
      <div class="choice">
        <div><button class="primary" onclick={() => doImport('merge')}>{t('backup.merge')}</button><p class="muted">{t('backup.merge.desc')}</p></div>
        <div><ConfirmButton onconfirm={() => doImport('replace')}>{t('backup.replace')}</ConfirmButton><p class="muted">{t('backup.replace.desc')}</p></div>
        <button onclick={() => (pendingBackup = null)}>{t('common.cancel')}</button>
      </div>
    {/if}
  </div>
</div>

<style>
  .page { display: grid; gap: var(--space-4); }
  h1 { font-size: clamp(1.6rem, 5vw, 2.2rem); }
  .empty { display: grid; justify-items: center; gap: var(--space-3); padding: var(--space-6) var(--space-4); text-align: center; }
  .cta { display: inline-flex; align-items: center; min-height: 48px; padding: 0 28px; background: var(--accent); color: var(--accent-ink); border-radius: 99px; font-weight: 800; text-decoration: none; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3); }
  .stat { text-align: center; display: grid; padding: var(--space-3); }
  .stat b { font: 800 clamp(1.6rem, 6vw, 2.2rem) var(--font-display); color: var(--accent); }
  .stat span { color: var(--muted); font-size: 0.9rem; }
  .bar { height: 10px; background: var(--surface-2); border-radius: 99px; overflow: hidden; }
  .bar span { display: block; height: 100%; background: linear-gradient(90deg, var(--accent), var(--pink)); border-radius: 99px; transition: width 0.4s ease; }
  .pct { margin: calc(var(--space-3) * -1) 0 0; font-size: 0.85rem; text-align: right; }
  .chips { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-3); }
  .chip { border-radius: 99px; }
  .chip.on { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
  .chip .n { opacity: 0.75; font-weight: 400; margin-left: 4px; }
  .tools { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; }
  .tools input { flex: 1 1 200px; min-width: 0; }
  button:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .list { list-style: none; margin: var(--space-3) 0 0; padding: 0; }
  li { display: flex; gap: var(--space-2); align-items: center; padding: var(--space-3) 0; border-top: 1px solid var(--line); }
  .body { flex: 1; min-width: 0; }
  .body strong { font-size: 1.1rem; }
  .badge { color: var(--good); font-weight: 800; margin-left: 6px; }
  .ctx { font-size: 0.9rem; overflow-wrap: anywhere; }
  .ctx.tr { color: var(--text); opacity: 0.8; }
  .btn { display: inline-flex; align-items: center; min-height: 44px; padding: 0 12px; border: 1.5px solid var(--line); border-radius: var(--radius-sm); text-decoration: none; font-weight: 700; color: var(--text); background: var(--surface); }
  .btn:hover { border-color: var(--accent); }
  .del { min-width: 44px; padding: 0; color: var(--danger); }
  .more { width: 100%; margin-top: var(--space-3); }
  .backup h2 { font-size: 1.1rem; margin-bottom: var(--space-2); }
  .row { display: flex; gap: var(--space-2); flex-wrap: wrap; }
  .choice { display: grid; gap: var(--space-3); margin-top: var(--space-4); padding: var(--space-4); border-radius: var(--radius-sm); background: var(--surface-2); }
  .choice p { margin: 4px 0 0; font-size: 0.9rem; }
</style>
