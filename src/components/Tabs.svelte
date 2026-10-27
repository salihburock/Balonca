<script lang="ts" generics="K extends string">
  import type { Snippet } from 'svelte';
  let { tabs, active = $bindable(), label, panel }: {
    tabs: { id: K; label: string }[]; active: K; label: string; panel: Snippet<[K]>;
  } = $props();

  function onkeydown(e: KeyboardEvent) {
    const i = tabs.findIndex((x) => x.id === active);
    const move = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (e.key === 'Home' || e.key === 'End' || move) {
      e.preventDefault();
      const n = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + move + tabs.length) % tabs.length;
      active = tabs[n].id;
      document.getElementById(`tab-${tabs[n].id}`)?.focus();
    }
  }
</script>

<!-- svelte-ignore a11y_interactive_supports_focus -->
<div class="tabs" role="tablist" aria-label={label} {onkeydown}>
  {#each tabs as tab (tab.id)}
    <button
      role="tab" id="tab-{tab.id}" aria-selected={active === tab.id} aria-controls="panel-{tab.id}"
      tabindex={active === tab.id ? 0 : -1} onclick={() => (active = tab.id)}
    >{tab.label}</button>
  {/each}
</div>
<div role="tabpanel" id="panel-{active}" aria-labelledby="tab-{active}" class="panel" tabindex="-1">
  {@render panel(active)}
</div>

<style>
  .tabs { display: flex; gap: 4px; background: var(--surface-2); padding: 4px; border-radius: 14px; margin-bottom: var(--space-3); }
  .tabs button { flex: 1; border: 0; background: none; padding: 0 6px; min-height: 44px; white-space: nowrap; color: var(--muted); }
  .tabs button:hover { transform: none; color: var(--text); }
  .tabs button[aria-selected='true'] { background: var(--surface); color: var(--accent); box-shadow: 0 2px 6px rgb(0 0 0 / 0.1); }
  .panel { min-width: 0; }
</style>
