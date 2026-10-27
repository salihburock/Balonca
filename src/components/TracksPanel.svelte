<script lang="ts">
  import { app } from '../lib/state.svelte';
  import { ingestFiles, ingestText } from '../lib/ingest';
  import { t, i18n } from '../lib/i18n/index.svelte';
  import { langName } from '../lib/languages';

  let over = $state(false);
  let pasted = $state('');
  let pasteLang = $state('');
  let input: HTMLInputElement;

  async function drop(e: DragEvent) {
    e.preventDefault();
    over = false;
    if (e.dataTransfer?.files.length) await ingestFiles(e.dataTransfer.files);
  }
  function addPasted() {
    if (!pasted.trim()) return;
    if (!app.vid) { ingestText('', 'paste'); return; }
    if (ingestText(pasted, pasteLang ? `paste.${pasteLang}.txt` : 'paste.txt', pasteLang.trim().toLowerCase() || undefined)) {
      pasted = '';
    }
  }
  const shift = (id: string, cur: number, d: number) => app.updateTrack(id, { offset: Math.round((cur + d) * 10) / 10 });
  const display = (tr: { label: string; lang: string }) => tr.label || langName(tr.lang, i18n.locale);
</script>

<div class="panel">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="drop"
    class:over
    ondragover={(e) => { e.preventDefault(); over = true; }}
    ondragleave={() => (over = false)}
    ondrop={drop}
  >
    <button class="dropbtn" onclick={() => input.click()}>
      <strong>{t('tracks.drop')}</strong>
      <span class="muted">{t('tracks.drop.hint')}</span>
    </button>
    <input
      bind:this={input} type="file" multiple hidden accept=".srt,.vtt,.json,.json3,.txt"
      onchange={(e) => { ingestFiles(e.currentTarget.files ?? []); e.currentTarget.value = ''; }}
    />
  </div>

  {#if app.tracks.length}
    <h3>{t('tracks.list')}</h3>
    <p class="muted small">{t('tracks.first')}</p>
    <ul class="tracks">
      {#each app.tracks as tr (tr.id)}
        <li class="track card">
          <div class="head">
            <input type="color" value={tr.color} aria-label={t('tracks.color')} oninput={(e) => app.updateTrack(tr.id, { color: e.currentTarget.value })} />
            <input
              class="grow" value={tr.label} placeholder={langName(tr.lang, i18n.locale)} aria-label={t('tracks.label')}
              onchange={(e) => app.updateTrack(tr.id, { label: e.currentTarget.value.trim() })}
            />
            <input
              class="code" value={tr.lang} aria-label={t('tracks.lang')} title={t('tracks.lang.help')} maxlength="12"
              onchange={(e) => app.updateTrack(tr.id, { lang: e.currentTarget.value.trim().toLowerCase() || tr.lang })}
            />
          </div>
          <div class="meta muted small">{display(tr)} · {t('tracks.lines', { n: tr.cues.length })} · {tr.name}</div>
          <div class="foot">
            <label class="check">
              <input type="checkbox" checked={tr.visible} onchange={(e) => app.updateTrack(tr.id, { visible: e.currentTarget.checked })} />
              {t('tracks.show')}
            </label>
            <span class="offset" role="group" aria-label={t('tracks.offset')}>
              <button onclick={() => shift(tr.id, tr.offset, -0.2)} aria-label={t('tracks.earlier')}>−</button>
              <output>{tr.offset.toFixed(1)}s</output>
              <button onclick={() => shift(tr.id, tr.offset, 0.2)} aria-label={t('tracks.later')}>+</button>
            </span>
            <button class="remove" onclick={() => app.removeTrack(tr.id)} aria-label={t('tracks.remove')} title={t('tracks.remove')}>✕</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  <details class="paste">
    <summary>{t('tracks.paste')}</summary>
    <textarea bind:value={pasted} rows="5" placeholder={t('tracks.paste.placeholder')} aria-label={t('tracks.paste')}></textarea>
    <div class="row">
      <input bind:value={pasteLang} placeholder={t('tracks.paste.lang')} aria-label={t('tracks.paste.lang')} maxlength="12" />
      <button class="primary" onclick={addPasted}>{t('tracks.paste.add')}</button>
    </div>
  </details>
</div>

<style>
  .panel { display: grid; gap: var(--space-3); }
  h3 { font-size: 1rem; margin-top: var(--space-2); }
  .small { font-size: 0.85rem; margin: 0; }
  .drop { border: 2px dashed var(--line); border-radius: var(--radius); transition: border-color 0.15s, background 0.15s; }
  .drop.over { border-color: var(--accent); background: var(--accent-soft); }
  .dropbtn { all: unset; box-sizing: border-box; display: grid; gap: 4px; justify-items: center; width: 100%; padding: var(--space-5) var(--space-4); text-align: center; cursor: pointer; }
  .dropbtn:focus-visible { outline: 3px solid var(--focus); border-radius: var(--radius); }
  .tracks { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); }
  .track { padding: var(--space-3); box-shadow: none; display: grid; gap: var(--space-2); }
  .head, .foot, .row { display: flex; gap: var(--space-2); align-items: center; }
  .foot { justify-content: space-between; flex-wrap: wrap; }
  .grow { flex: 1; min-width: 0; }
  .code { width: 4.5rem; text-align: center; }
  input[type='color'] { width: 44px; height: 44px; padding: 3px; border-radius: var(--radius-sm); border: 1.5px solid var(--line); background: var(--surface); }
  .meta { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .check { display: flex; align-items: center; gap: 8px; min-height: 44px; }
  .check input { width: 20px; height: 20px; accent-color: var(--accent); }
  .offset { display: inline-flex; align-items: center; gap: 4px; }
  .offset button { min-width: 44px; padding: 0; }
  .offset output { min-width: 3.4rem; text-align: center; font-weight: 700; font-variant-numeric: tabular-nums; }
  .remove { min-width: 44px; padding: 0; color: var(--danger); }
  .paste summary { cursor: pointer; font-weight: 700; padding: var(--space-2) 0; min-height: 44px; display: flex; align-items: center; }
  .paste textarea { width: 100%; margin-bottom: var(--space-2); font-family: ui-monospace, monospace; font-size: 0.85rem; }
  .row input { flex: 1; min-width: 0; }
</style>
