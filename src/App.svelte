<script lang="ts">
  import Header from './components/Header.svelte';
  import Toasts from './components/Toasts.svelte';
  import Home from './routes/Home.svelte';
  import Watch from './routes/Watch.svelte';
  import Words from './routes/Words.svelte';
  import Help from './routes/Help.svelte';
  import NotFound from './routes/NotFound.svelte';
  import { router } from './lib/router.svelte';
  import { t } from './lib/i18n/index.svelte';

  const pages = { home: Home, words: Words, help: Help, notfound: NotFound } as const;
  // The player stays mounted once opened so leaving and returning never reloads the video.
  let watchOpened = $state(router.route === 'watch');
  $effect(() => { if (router.route === 'watch') watchOpened = true; });

  const Page = $derived(router.route === 'watch' ? null : pages[router.route]);
</script>

<a class="skip" href="#main" onclick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>{t('skip')}</a>
<Header />
<main id="main" tabindex="-1">
  {#if watchOpened}
    <div class="page" hidden={router.route !== 'watch'}><Watch /></div>
  {/if}
  {#if Page}
    {#key router.route}
      <div class="page"><Page /></div>
    {/key}
  {/if}
</main>
<footer><small class="muted">{t('footer.note')}</small></footer>
<Toasts />

<style>
  main { max-width: 1200px; margin: 0 auto; padding: var(--space-4); outline: none; min-height: 70dvh; }
  .page { animation: enter 0.25s ease-out; }
  .page[hidden] { display: none; }
  @keyframes enter { from { opacity: 0; transform: translateY(6px); } }
  footer { text-align: center; padding: var(--space-5) var(--space-4); }
  .skip { position: absolute; left: -999px; top: 8px; z-index: 300; background: var(--accent); color: var(--accent-ink); padding: 10px 16px; border-radius: 10px; }
  .skip:focus { left: 8px; }
</style>
