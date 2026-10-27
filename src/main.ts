import '@fontsource-variable/nunito';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import './styles/tokens.css';
import './styles/base.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { applyTheme } from './lib/theme.svelte';
import { i18n } from './lib/i18n/index.svelte';
import { app } from './lib/state.svelte';

applyTheme(); // best guess from localStorage until IndexedDB settings load
document.documentElement.lang = i18n.locale;

// Load saved data first so the first paint already has the right theme, language and last video.
app.init().then(async (last) => {
  if (last) await app.openVideo(last);
  mount(App, { target: document.getElementById('app')! });
});
