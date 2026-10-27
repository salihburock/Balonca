<script lang="ts">
  import Mascot from './Mascot.svelte';
  import { onMount } from 'svelte';
  import { t, i18n } from '../lib/i18n/index.svelte';
  import { router } from '../lib/router.svelte';
  import { app } from '../lib/state.svelte';
  import type { ThemeSetting } from '../lib/settings';

  const NEXT: Record<ThemeSetting, ThemeSetting> = { auto: 'light', light: 'dark', dark: 'auto' };
  let el: HTMLElement;
  onMount(() => {
    // The watch page sticks its video under the header, so publish the header's real height.
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  });

  const links = [
    ['home', 'nav.home'],
    ['watch', 'nav.watch'],
    ['words', 'nav.words'],
    ['help', 'nav.help'],
  ] as const;
  const themeIcon = { auto: '◐', light: '☀', dark: '☾' } as const;
</script>

<header bind:this={el}>
  <a class="logo" href="#/" aria-label="Balonca"><Mascot size={34} /><span>Balonca</span></a>
  <nav aria-label="Main">
    {#each links as [route, key]}
      <a href={`#/${route === 'home' ? '' : route}`} aria-current={router.route === route ? 'page' : undefined}>{t(key)}</a>
    {/each}
  </nav>
  <div class="tools">
    <button class="icon" onclick={() => app.setSetting('locale', i18n.locale === 'tr' ? 'en' : 'tr')} aria-label={t('lang.switch')}>
      {i18n.locale.toUpperCase()}
    </button>
    <button class="icon" onclick={() => app.setSetting('theme', NEXT[app.settings.theme])} aria-label={t(`theme.${app.settings.theme}`)} title={t(`theme.${app.settings.theme}`)}>
      <span aria-hidden="true">{themeIcon[app.settings.theme]}</span>
    </button>
  </div>
</header>

<style>
  header {
    position: sticky; top: 0; z-index: 30;
    display: flex; align-items: center; gap: var(--space-3);
    padding: var(--space-2) var(--space-4);
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--line);
  }
  .logo { display: flex; align-items: center; gap: 6px; text-decoration: none; color: var(--text);
    font: 800 20px var(--font-display); }
  nav { display: flex; gap: 2px; margin-left: auto; overflow-x: auto; }
  nav a { padding: 10px 14px; border-radius: 99px; color: var(--muted); text-decoration: none; font-weight: 700; white-space: nowrap; }
  nav a:hover { color: var(--text); }
  nav a[aria-current='page'] { background: var(--accent-soft); color: var(--accent); }
  .tools { display: flex; gap: var(--space-2); }
  .icon { min-width: 44px; padding: 0 10px; }
  @media (max-width: 640px) {
    header { flex-wrap: wrap; }
    nav { order: 3; width: 100%; margin-left: 0; justify-content: space-between; }
    .tools { margin-left: auto; }
  }
</style>
