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

// Paint right away; pages render once saved data has loaded (see App.svelte).
void app.init();
mount(App, { target: document.getElementById('app')! });
