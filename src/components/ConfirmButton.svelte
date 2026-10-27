<script lang="ts">
  import type { Snippet } from 'svelte';
  import { t } from '../lib/i18n/index.svelte';

  let { onconfirm, danger = true, label, children, ...rest }: {
    onconfirm: () => void; danger?: boolean; label?: string; children: Snippet; [k: string]: unknown;
  } = $props();
  let armed = $state(false);
  let timer: ReturnType<typeof setTimeout>;

  function click() {
    if (armed) { clearTimeout(timer); armed = false; onconfirm(); return; }
    armed = true;
    timer = setTimeout(() => (armed = false), 5000);
  }
</script>

<span class="wrap">
  <button type="button" class:danger class:armed onclick={click} aria-label={label} {...rest}>
    {#if armed}{t('common.confirm')}{:else}{@render children()}{/if}
  </button>
  {#if armed}<button type="button" onclick={() => { clearTimeout(timer); armed = false; }}>{t('common.cancel')}</button>{/if}
</span>

<style>
  .wrap { display: inline-flex; gap: 6px; }
  .danger { color: var(--danger); }
  .armed { background: var(--danger); border-color: var(--danger); color: #fff; }
</style>
