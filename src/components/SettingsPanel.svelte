<script lang="ts">
  import { app } from '../lib/state.svelte';
  import { t } from '../lib/i18n/index.svelte';
  import type { MessageKey } from '../lib/i18n/tr';
  import type { SubStyle } from '../lib/settings';

  const styles: SubStyle[] = ['box', 'outline', 'shadow', 'contrast'];
  const toggles = [
    ['pauseOnSave', 'settings.pauseOnSave'],
    ['autoScroll', 'settings.autoScroll'],
    ['hideSecondary', 'settings.hideSecondary'],
    ['autoPause', 'settings.autoPause'],
  ] as const;
  const keys: [string, MessageKey][] = [
    ['Space', 'kbd.play'], ['← →', 'kbd.line'], ['R', 'kbd.loop'], ['F', 'kbd.full'], ['W', 'kbd.word'],
  ];
</script>

<div class="panel">
  <section>
    <h3>{t('settings.subtitles')}</h3>
    <div class="preview {app.settings.subStyle}" style:--sub-size="{app.settings.subSize}px" style:--sub-bg={app.settings.subBg / 100} style:--sub-scale="0.8" aria-label={t('settings.preview')}>
      <span class="line">{t('settings.preview.text')}</span>
    </div>
    <label class="field">
      <span>{t('settings.size')} <output>{app.settings.subSize}px</output></span>
      <input type="range" min="14" max="48" value={app.settings.subSize} oninput={(e) => app.setSetting('subSize', +e.currentTarget.value)} />
    </label>
    <label class="field">
      <span>{t('settings.bg')} <output>{app.settings.subBg}%</output></span>
      <input type="range" min="0" max="100" value={app.settings.subBg} oninput={(e) => app.setSetting('subBg', +e.currentTarget.value)} />
    </label>
    <fieldset class="styles">
      <legend>{t('settings.style')}</legend>
      {#each styles as s}
        <label class="chip" class:on={app.settings.subStyle === s}>
          <input type="radio" name="substyle" value={s} checked={app.settings.subStyle === s} onchange={() => app.setSetting('subStyle', s)} />
          {t(`settings.style.${s}`)}
        </label>
      {/each}
    </fieldset>
  </section>

  <section>
    <h3>{t('settings.behavior')}</h3>
    {#each toggles as [key, label]}
      <label class="toggle">
        <input type="checkbox" checked={app.settings[key]} onchange={(e) => app.setSetting(key, e.currentTarget.checked)} />
        <span>{t(label)}</span>
      </label>
    {/each}
  </section>

  <section>
    <h3>{t('settings.shortcuts')}</h3>
    <dl class="keys">
      {#each keys as [k, label]}<div><dt><kbd>{k}</kbd></dt><dd>{t(label)}</dd></div>{/each}
    </dl>
  </section>
</div>

<style>
  .panel { display: grid; gap: var(--space-5); }
  h3 { font-size: 1rem; margin-bottom: var(--space-2); }
  section { display: grid; gap: var(--space-2); }
  .preview { background: #3a4a63 linear-gradient(135deg, #3a4a63, #7a5c8a); border-radius: var(--radius-sm); min-height: 84px; display: grid; place-items: end center; padding: var(--space-3); overflow: hidden; }
  .line { font-size: calc(var(--sub-size) * var(--sub-scale)); color: #fff; padding: 0.08em 0.55em; border-radius: 0.45em; line-height: 1.3; text-align: center; }
  .box .line { background: rgb(0 0 0 / var(--sub-bg)); text-shadow: 0 1px 2px #000; }
  .outline .line { paint-order: stroke fill; -webkit-text-stroke: 0.16em #000; text-shadow: 0 0 0.1em #000; }
  .shadow .line { text-shadow: 0 0 0.18em #000, 0 0.05em 0.12em #000, 0 0.08em 0.24em #000, 0 0 0.5em #000; }
  .contrast .line { background: #000; color: #ffe14a; font-weight: 700; }
  .field { display: grid; gap: 4px; }
  .field span { display: flex; justify-content: space-between; font-weight: 700; }
  .field output { color: var(--muted); font-weight: 400; }
  input[type='range'] { width: 100%; accent-color: var(--accent); min-height: 32px; }
  fieldset { border: 0; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--space-2); }
  legend { font-weight: 700; margin-bottom: var(--space-2); padding: 0; }
  .chip { display: inline-flex; align-items: center; min-height: 44px; padding: 0 var(--space-4); border: 1.5px solid var(--line); border-radius: 99px; cursor: pointer; font-weight: 700; background: var(--surface); }
  .chip.on { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
  .chip input { position: absolute; opacity: 0; pointer-events: none; }
  .chip:has(input:focus-visible) { outline: 3px solid var(--focus); outline-offset: 2px; }
  .toggle { display: flex; align-items: center; gap: var(--space-3); min-height: 44px; cursor: pointer; }
  .toggle input { width: 22px; height: 22px; accent-color: var(--accent); flex: none; }
  .keys { margin: 0; display: grid; gap: 6px; }
  .keys div { display: flex; gap: var(--space-3); align-items: baseline; }
  dt { min-width: 5.5rem; } dd { margin: 0; color: var(--muted); }
  kbd { font: 700 0.85rem var(--font-body); background: var(--surface-2); border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 6px; padding: 2px 8px; }
</style>
