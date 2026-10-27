<script lang="ts">
  import Header from './components/Header.svelte';
  import Home from './routes/Home.svelte';
  import Watch from './routes/Watch.svelte';
  import Words from './routes/Words.svelte';
  import Help from './routes/Help.svelte';
  import NotFound from './routes/NotFound.svelte';
  import { router } from './lib/router.svelte';

  const pages = { home: Home, watch: Watch, words: Words, help: Help, notfound: NotFound };
  const Page = $derived(pages[router.route]);
</script>

<Header />
<main id="main">
  {#key router.route}
    <div class="page"><Page /></div>
  {/key}
</main>

<style>
  main { max-width: 1200px; margin: 0 auto; padding: var(--space-4); }
  .page { animation: enter 0.25s ease-out; }
  @keyframes enter { from { opacity: 0; transform: translateY(6px); } }
</style>
