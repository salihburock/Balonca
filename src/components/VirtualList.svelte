<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    count, estimate = 72, overscan = 6, label, resetKey = '', row, onuser,
  }: {
    count: number; estimate?: number; overscan?: number; label: string; resetKey?: unknown;
    row: Snippet<[number]>; onuser?: () => void;
  } = $props();

  let viewport: HTMLDivElement;
  let scrollTop = $state(0);
  let height = $state(400);
  let version = $state(0);
  let heights = new Map<number, number>();
  let raf = 0;

  // Row heights vary (translations underneath), so measure what is rendered and estimate the rest.
  const offsets = $derived.by(() => {
    void version;
    const o = new Float64Array(count + 1);
    for (let i = 0; i < count; i++) o[i + 1] = o[i] + (heights.get(i) ?? estimate);
    return o;
  });
  const total = $derived(offsets[count] ?? 0);

  function indexAt(y: number): number {
    let lo = 0, hi = count - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (offsets[mid] <= y) lo = mid; else hi = mid - 1; }
    return Math.max(0, lo);
  }
  const range = $derived.by(() => {
    if (!count) return { start: 0, end: -1 };
    const start = Math.max(0, indexAt(scrollTop) - overscan);
    const end = Math.min(count - 1, indexAt(scrollTop + height) + overscan);
    return { start, end };
  });
  const visible = $derived(Array.from({ length: Math.max(0, range.end - range.start + 1) }, (_, k) => range.start + k));

  $effect(() => { void resetKey; void count; heights = new Map(); version++; });

  function measure(node: HTMLElement, i: number) {
    let index = i;
    const ro = new ResizeObserver(() => {
      const h = node.offsetHeight;
      if (h && heights.get(index) !== h) {
        heights.set(index, h);
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => version++);
      }
    });
    ro.observe(node);
    return { update(n: number) { index = n; }, destroy() { ro.disconnect(); } };
  }

  export function scrollToIndex(i: number, smooth = true) {
    if (!viewport || i < 0 || i >= count) return;
    const h = heights.get(i) ?? estimate;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    viewport.scrollTo({ top: offsets[i] - height / 2 + h / 2, behavior: smooth && !reduce ? 'smooth' : 'auto' });
  }
</script>

<div
  class="viewport"
  bind:this={viewport}
  bind:clientHeight={height}
  onscroll={() => (scrollTop = viewport.scrollTop)}
  onwheel={() => onuser?.()}
  ontouchmove={() => onuser?.()}
  onpointerdown={() => onuser?.()}
  role="list"
  aria-label={label}
  tabindex="-1"
>
  <div class="spacer" style:height="{total}px">
    {#each visible as i (i)}
      <div class="item" style:transform="translateY({offsets[i]}px)" use:measure={i} role="listitem">
        {@render row(i)}
      </div>
    {/each}
  </div>
</div>

<style>
  .viewport { height: 100%; overflow-y: auto; overscroll-behavior: contain; position: relative; }
  .spacer { position: relative; width: 100%; }
  .item { position: absolute; top: 0; left: 0; right: 0; will-change: transform; }
</style>
