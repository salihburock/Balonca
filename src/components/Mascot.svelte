<script lang="ts">
  let { size = 40, float = false }: { size?: number; float?: boolean } = $props();
</script>

<svg class:float width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
  <path fill="var(--accent)" d="M18 14h64a12 12 0 0 1 12 12v36a12 12 0 0 1-12 12H56L38 92V74H18A12 12 0 0 1 6 62V26A12 12 0 0 1 18 14z" />
  <circle cx="36" cy="46" r="5" fill="var(--accent-ink)" />
  <circle cx="64" cy="46" r="5" fill="var(--accent-ink)" />
  <path d="M42 58q8 8 16 0" stroke="var(--accent-ink)" stroke-width="4" fill="none" stroke-linecap="round" />
  <circle cx="26" cy="58" r="5" fill="var(--pink)" opacity=".8" />
  <circle cx="74" cy="58" r="5" fill="var(--pink)" opacity=".8" />
</svg>

<style>
  svg { display: block; flex: none; }
  .float { animation: bob 3.2s ease-in-out infinite; }
  @keyframes bob { 50% { transform: translateY(-8px); } }
</style>
