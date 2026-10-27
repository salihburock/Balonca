<script lang="ts">
  import { app } from '../lib/state.svelte';
  import { ingestText } from '../lib/ingest';
  import { t, i18n } from '../lib/i18n/index.svelte';
  import { displayLanguage } from '../lib/languages';
  import { listRemoteSubs, fetchRemoteSub, SubsApiError, SUBS_API_ENABLED, type RemoteList } from '../lib/ytsubs/api';
  import { filterTracks, countKinds, type KindFilter, type RemoteTrack } from '../lib/ytsubs/filter';
  import { toast } from '../lib/toast.svelte';
  import type { MessageKey } from '../lib/i18n/tr';

  let list = $state<RemoteList | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let query = $state('');
  let kind = $state<KindFilter>('all');
  let busy = $state<string | null>(null);
  let ctl: AbortController | null = null;

  const KINDS: KindFilter[] = ['all', 'manual', 'auto', 'auto-translated'];
  const shown = $derived(list ? filterTracks(list.tracks, { query, kind }) : []);
  const counts = $derived(list ? countKinds(list.tracks) : null);
  const other = () => (i18n.locale === 'tr' ? 'en' : 'tr');
  const isAdded = (tr: RemoteTrack) => app.tracks.some((x) => x.name.startsWith(`${list?.id}.${tr.code}.`));

  // A different video means a different list.
  $effect(() => { void app.vid; ctl?.abort(); list = null; error = null; query = ''; kind = 'all'; });

  const message = (e: unknown) => t(`ytsubs.err.${e instanceof SubsApiError ? e.code : 'failed'}` as MessageKey);

  async function load() {
    if (!app.vid) return;
    ctl?.abort();
    ctl = new AbortController();
    loading = true; error = null;
    try { list = await listRemoteSubs(app.vid, ctl.signal); }
    catch (e) { if (!(e instanceof SubsApiError && e.code === 'cancelled')) error = message(e); }
    finally { loading = false; }
  }

  async function add(tr: RemoteTrack) {
    if (!list || busy) return;
    busy = tr.code;
    try {
      const text = await fetchRemoteSub(list.id, tr);
      // yt-dlp names its files "<id>.<code>.<ext>"; the code (without "-orig") is the language hint.
      const lang = tr.code.replace(/-orig$/i, '').split('-')[0].toLowerCase();
      ingestText(text, `${list.id}.${tr.code}.json3`, lang);
    } catch (e) {
      toast(message(e), 'error', 9000);
    } finally { busy = null; }
  }
</script>

{#if SUBS_API_ENABLED}
  <section class="yt">
    <h3>{t('ytsubs.title')}</h3>
    <p class="muted small">{t('ytsubs.desc')}</p>

    {#if !app.vid}
      <p class="muted">{t('ytsubs.need')}</p>
    {:else}
      <button class="primary" onclick={load} disabled={loading}>{list ? t('ytsubs.refresh') : t('ytsubs.list')}</button>
    {/if}

    {#if loading}<p class="muted" role="status">{t('ytsubs.loading')}</p>{/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}

    {#if list}
      {#if !list.tracks.length}
        <p class="muted">{t('ytsubs.empty')}</p>
      {:else}
        <input type="search" bind:value={query} placeholder={t('ytsubs.filter')} aria-label={t('ytsubs.filter')} autocomplete="off" />
        <div class="chips" role="group" aria-label={t('ytsubs.title')}>
          {#each KINDS as k}
            {#if k === 'all' || counts?.[k]}
              <button class="chip" class:on={kind === k} aria-pressed={kind === k} onclick={() => (kind = k)}>
                {t(`ytsubs.kind.${k}` as MessageKey)} <span class="n">{counts?.[k]}</span>
              </button>
            {/if}
          {/each}
        </div>
        <p class="muted small" aria-live="polite">{t('ytsubs.count', { n: shown.length, total: list.tracks.length })}</p>

        <ul class="rows">
          {#each shown as tr (tr.kind + tr.code)}
            <li>
              <code class="code">{tr.code}</code>
              <div class="names">
                <strong>{displayLanguage(tr.code, i18n.locale)}</strong>
                <span class="muted small">{displayLanguage(tr.code, other())} · <em class="kind {tr.kind}">{t(`ytsubs.kind.${tr.kind}` as MessageKey)}</em></span>
              </div>
              {#if isAdded(tr)}
                <span class="done">✓ {t('ytsubs.added')}</span>
              {:else}
                <button onclick={() => add(tr)} disabled={busy !== null}>{busy === tr.code ? t('ytsubs.adding') : t('ytsubs.add')}</button>
              {/if}
            </li>
          {:else}
            <li class="muted">{t('ytsubs.none')}</li>
          {/each}
        </ul>
        <p class="muted small">{t('ytsubs.tip')}</p>
      {/if}
    {/if}
  </section>
{/if}

<style>
  .yt { display: grid; gap: var(--space-2); padding-bottom: var(--space-3); border-bottom: 1px solid var(--line); }
  h3 { font-size: 1rem; }
  .small { font-size: 0.85rem; margin: 0; }
  .error { color: var(--danger); font-weight: 700; margin: 0; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { border-radius: 99px; min-height: 36px; padding: 0 12px; font-size: 0.85rem; }
  .chip.on { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
  .chip .n { opacity: 0.75; font-weight: 400; margin-left: 2px; }
  .rows { list-style: none; margin: 0; padding: 0; max-height: 320px; overflow-y: auto; border: 1px solid var(--line); border-radius: var(--radius-sm); }
  li { display: flex; align-items: center; gap: var(--space-3); padding: 8px 12px; border-top: 1px solid var(--line); }
  li:first-child { border-top: 0; }
  .code { font: 700 0.8rem ui-monospace, monospace; background: var(--surface-2); border-radius: 6px; padding: 3px 8px; min-width: 4.4rem; text-align: center; flex: none; }
  .names { flex: 1; min-width: 0; display: grid; }
  .kind { font-style: normal; }
  .kind.auto { color: var(--accent); font-weight: 700; }
  .kind.manual { color: var(--good); font-weight: 700; }
  li button { min-width: 72px; padding: 0 12px; }
  .done { color: var(--good); font-weight: 700; white-space: nowrap; }
  button:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }
</style>
