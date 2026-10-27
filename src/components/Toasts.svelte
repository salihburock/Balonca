<script lang="ts">
  import { toasts, dismiss } from '../lib/toast.svelte';
  import { t } from '../lib/i18n/index.svelte';
</script>

<div class="toasts" role="status" aria-live="polite">
  {#each toasts.list as x (x.id)}
    <div class="toast {x.kind}">
      <span>{x.msg}</span>
      <button onclick={() => dismiss(x.id)} aria-label={t('common.close')}>✕</button>
    </div>
  {/each}
</div>

<style>
  .toasts { position: fixed; z-index: 200; left: 50%; transform: translateX(-50%); bottom: max(16px, env(safe-area-inset-bottom)); display: grid; gap: 8px; width: min(92vw, 460px); pointer-events: none; }
  .toast {
    pointer-events: auto; display: flex; align-items: center; gap: 8px; justify-content: space-between;
    padding: 10px 8px 10px 16px; border-radius: var(--radius-sm); background: var(--text); color: var(--bg);
    box-shadow: var(--shadow-lg); animation: rise 0.22s ease-out; font-weight: 700;
  }
  .toast.success { border-left: 6px solid var(--good); }
  .toast.error { border-left: 6px solid var(--danger); }
  .toast button { all: unset; cursor: pointer; padding: 8px 12px; border-radius: 8px; flex: none; }
  .toast button:focus-visible { outline: 3px solid var(--pink); }
  @keyframes rise { from { opacity: 0; transform: translateY(10px); } }
</style>
