export type Theme = 'auto' | 'light' | 'dark';
const ORDER: Theme[] = ['auto', 'light', 'dark'];

function initial(): Theme {
  try {
    const v = localStorage.getItem('balonca.theme');
    if (v === 'light' || v === 'dark' || v === 'auto') return v;
  } catch {}
  return 'auto';
}

export const theme = $state({ value: initial() });

const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

export function applyTheme() {
  const dark = theme.value === 'dark' || (theme.value === 'auto' && !!mq?.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function cycleTheme() {
  theme.value = ORDER[(ORDER.indexOf(theme.value) + 1) % ORDER.length];
  try { localStorage.setItem('balonca.theme', theme.value); } catch {}
  applyTheme();
}

mq?.addEventListener('change', applyTheme);
