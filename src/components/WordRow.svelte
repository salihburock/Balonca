<script lang="ts">
  import { tokenize } from '../lib/words/tokenize';
  import { app } from '../lib/state.svelte';
  import { player } from '../lib/player/controller.svelte';
  import { t } from '../lib/i18n/index.svelte';
  import { toast } from '../lib/toast.svelte';

  let { text, lang, trans }: { text: string; lang: string; trans?: () => { lang: string; text: string }[] } = $props();
  const tokens = $derived(tokenize(text, lang));
  let popped = $state('');
  let timer: ReturnType<typeof setTimeout>;

  function save(key: string, surface: string) {
    const added = app.toggleWord({ lang, word: surface, ctx: text, trans: trans?.(), t: player.now() });
    if (added && app.settings.pauseOnSave) player.pause();
    if (added) toast(`${key} · ${t('word.saved')}`, 'success', 2200);
    popped = key;
    clearTimeout(timer);
    timer = setTimeout(() => (popped = ''), 350);
  }

  /** Arrow keys move between words; the event never reaches the global player shortcuts. */
  function onkeydown(e: KeyboardEvent) {
    const cur = (e.target as HTMLElement).closest('button.w');
    if (!cur || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    const all = [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('button.w')];
    const next = all[all.indexOf(cur as HTMLButtonElement) + (e.key === 'ArrowRight' ? 1 : -1)];
    e.preventDefault();
    e.stopPropagation();
    next?.focus();
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<span class="wordrow" {lang} {onkeydown}>{#each tokens as tok}{#if tok.isWord}<button
        type="button"
        class="w"
        class:sv={app.isSaved(lang, tok.key)}
        class:pop={popped === tok.key}
        tabindex="-1"
        aria-pressed={app.isSaved(lang, tok.key)}
        onclick={() => save(tok.key, tok.text)}>{tok.text}</button>{:else}{tok.text}{/if}{/each}</span>

<style>
  .w {
    all: unset;
    display: inline;
    cursor: pointer;
    border-radius: 0.25em;
    padding: 0.12em 0.04em;
    margin: -0.12em 0;
    touch-action: manipulation;
    transition: background 0.12s ease, color 0.12s ease;
  }
  .w:hover { background: var(--accent); color: var(--accent-ink); }
  .w:focus-visible { outline: 3px solid var(--pink); outline-offset: 1px; }
  .w.sv { text-decoration: underline wavy var(--pink); text-decoration-thickness: 1.5px; text-underline-offset: 0.22em; }
  .w.pop { animation: pop 0.32s ease-out; }
  @keyframes pop { 40% { transform: scale(1.3); background: var(--pink); color: #1a1226; } }
</style>
