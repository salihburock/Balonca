<script lang="ts">
  import { app } from '../lib/state.svelte';
  import { t, i18n } from '../lib/i18n/index.svelte';
  import { LANGUAGES, langName } from '../lib/languages';
  import { anthropicTranslator, MODELS } from '../lib/translate/anthropic';
  import { translateCues, TranslateError } from '../lib/translate/runner';
  import { toast } from '../lib/toast.svelte';
  import type { MessageKey } from '../lib/i18n/tr';

  const STORE = 'balonca.anthropicKey';
  const saved = (() => { try { return localStorage.getItem(STORE) ?? ''; } catch { return ''; } })();

  let key = $state(saved);
  let remember = $state(!!saved);
  let sourceId = $state('');
  let target = $state(i18n.locale === 'en' ? 'en' : 'tr');
  let model = $state<string>(MODELS[0].id);
  let running = $state(false);
  let done = $state(0);
  let total = $state(0);
  let ctl: AbortController | null = null;

  const source = $derived(app.tracks.find((x) => x.id === sourceId) ?? app.tracks[0]);

  function persistKey() {
    try { remember && key ? localStorage.setItem(STORE, key) : localStorage.removeItem(STORE); } catch {}
  }
  function forget() { key = ''; remember = false; persistKey(); }

  async function start() {
    if (!source) { toast(t('translate.need'), 'error'); return; }
    persistKey();
    ctl = new AbortController();
    running = true; done = 0; total = source.cues.length;
    const from = langName(source.lang, 'en');
    const to = langName(target, 'en');
    try {
      const cues = await translateCues({
        cues: source.cues, signal: ctl.signal,
        translate: anthropicTranslator({ apiKey: key.trim(), model, from, to }),
        onProgress: (d, n) => { done = d; total = n; },
      });
      app.addCues(cues, `${source.name} → ${target}`, target);
      toast(t('translate.done', { n: cues.length }), 'success');
    } catch (e) {
      const code = e instanceof TranslateError ? e.code : 'network';
      toast(t(`translate.err.${code}` as MessageKey), code === 'cancelled' ? 'info' : 'error', 7000);
    } finally {
      running = false; ctl = null;
    }
  }
</script>

<details class="tr">
  <summary>{t('translate.title')}</summary>
  <p class="muted">{t('translate.desc')}</p>
  {#if !app.tracks.length}
    <p class="muted">{t('translate.need')}</p>
  {:else}
    <form onsubmit={(e) => { e.preventDefault(); void start(); }}>
      <label>{t('translate.key')}
        <input type="password" bind:value={key} autocomplete="off" spellcheck="false" placeholder="sk-ant-…" required disabled={running} />
      </label>
      <p class="muted small">{t('translate.key.note')}</p>
      <div class="inline">
        <label class="check"><input type="checkbox" bind:checked={remember} onchange={persistKey} /> {t('translate.remember')}</label>
        {#if saved || (remember && key)}<button type="button" onclick={forget}>{t('translate.forget')}</button>{/if}
      </div>
      <label>{t('translate.source')}
        <select bind:value={sourceId} disabled={running}>
          {#each app.tracks as tr}<option value={tr.id}>{tr.label || langName(tr.lang, i18n.locale)} · {tr.name}</option>{/each}
        </select>
      </label>
      <label>{t('translate.target')}
        <select bind:value={target} disabled={running}>
          {#each Object.keys(LANGUAGES) as code}<option value={code}>{langName(code, i18n.locale)}</option>{/each}
        </select>
      </label>
      <label>{t('translate.model')}
        <select bind:value={model} disabled={running}>
          {#each MODELS as m}<option value={m.id}>{m.label}</option>{/each}
        </select>
      </label>
      <p class="muted small">{t('translate.cost')}</p>
      {#if running}
        <progress max={total} value={done} aria-label={t('translate.progress', { done, total })}></progress>
        <div class="inline">
          <span aria-live="polite">{t('translate.progress', { done, total })}</span>
          <button type="button" onclick={() => ctl?.abort()}>{t('translate.cancel')}</button>
        </div>
      {:else}
        <button class="primary" type="submit">{t('translate.start')}</button>
      {/if}
    </form>
  {/if}
</details>

<style>
  .tr { border-top: 1px solid var(--line); padding-top: var(--space-2); }
  summary { cursor: pointer; font-weight: 700; min-height: 44px; display: flex; align-items: center; }
  form { display: grid; gap: var(--space-3); }
  label { display: grid; gap: 4px; font-weight: 700; }
  label.check { display: flex; align-items: center; gap: 8px; font-weight: 400; min-height: 44px; }
  label.check input { width: 20px; height: 20px; accent-color: var(--accent); }
  .small { font-size: 0.85rem; margin: 0; }
  .inline { display: flex; gap: var(--space-3); align-items: center; justify-content: space-between; flex-wrap: wrap; }
  progress { width: 100%; height: 12px; accent-color: var(--accent); }
</style>
