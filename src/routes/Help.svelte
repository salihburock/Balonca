<script lang="ts">
  import { t } from '../lib/i18n/index.svelte';
  import { toast } from '../lib/toast.svelte';
  import type { MessageKey } from '../lib/i18n/tr';

  const faq = [1, 2, 3, 4, 5, 6] as const;
  const CMD = 'yt-dlp --write-auto-subs --sub-langs nl --sub-format json3 --skip-download "https://youtu.be/VIDEO_ID"';
  const keys: [string, MessageKey][] = [
    ['Space', 'kbd.play'], ['← →', 'kbd.line'], ['R', 'kbd.loop'], ['F', 'kbd.full'], ['W', 'kbd.word'],
  ];

  async function copy() {
    try { await navigator.clipboard.writeText(CMD); toast('✓', 'success', 1500); } catch {}
  }
</script>

<div class="help">
  <h1>{t('help.title')}</h1>
  <p class="muted lead">{t('help.lead')}</p>

  <div class="card faq">
    {#each faq as n, i}
      <details open={i === 0}>
        <summary>{t(`help.q${n}` as MessageKey)}</summary>
        <div class="answer">
          <p>{t(`help.a${n}` as MessageKey)}</p>
          {#if n === 3}
            <div class="code">
              <code>{CMD}</code>
              <button onclick={copy} aria-label="Copy">⧉</button>
            </div>
            <p>{t('help.a3b')}</p>
          {/if}
        </div>
      </details>
    {/each}
    <details>
      <summary>{t('help.q7')}</summary>
      <dl class="keys">
        {#each keys as [k, label]}<div><dt><kbd>{k}</kbd></dt><dd>{t(label)}</dd></div>{/each}
      </dl>
    </details>
    <details>
      <summary>{t('help.q8')}</summary>
      <div class="answer"><p>{t('help.a8')}</p></div>
    </details>
  </div>
</div>

<style>
  .help { display: grid; gap: var(--space-3); max-width: 46rem; margin: 0 auto; }
  h1 { font-size: clamp(1.6rem, 5vw, 2.2rem); }
  .lead { margin: 0; }
  .faq { padding: var(--space-2) var(--space-4); }
  details { border-top: 1px solid var(--line); }
  details:first-child { border-top: 0; }
  summary { cursor: pointer; font-weight: 700; padding: var(--space-3) 0; min-height: 48px; display: flex; align-items: center; list-style: none; gap: 10px; }
  summary::-webkit-details-marker { display: none; }
  summary::before { content: '▸'; color: var(--accent); transition: transform 0.15s; flex: none; }
  details[open] > summary::before { transform: rotate(90deg); }
  .answer p { margin: 0 0 var(--space-3); }
  .code { display: flex; gap: var(--space-2); align-items: center; background: var(--surface-2); border-radius: var(--radius-sm); padding: var(--space-2) var(--space-3); margin-bottom: var(--space-3); }
  code { flex: 1; min-width: 0; font: 0.85rem ui-monospace, monospace; overflow-wrap: anywhere; }
  .code button { min-width: 44px; padding: 0; }
  .keys { margin: 0 0 var(--space-3); display: grid; gap: 8px; }
  .keys div { display: flex; gap: var(--space-3); align-items: baseline; }
  dt { min-width: 5.5rem; } dd { margin: 0; color: var(--muted); }
  kbd { font: 700 0.85rem var(--font-body); background: var(--surface-2); border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 6px; padding: 2px 8px; }
</style>
