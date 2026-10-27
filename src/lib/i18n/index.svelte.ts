import { tr, type MessageKey } from './tr';
import { en } from './en';

export type Locale = 'tr' | 'en';
export const LOCALES: Record<Locale, Record<MessageKey, string>> = { tr, en };
export const LOCALE_LABELS: Record<Locale, string> = { tr: 'Türkçe', en: 'English' };

function initial(): Locale {
  try {
    const saved = localStorage.getItem('balonca.locale');
    if (saved === 'tr' || saved === 'en') return saved;
  } catch {}
  return 'tr';
}

export const i18n = $state({ locale: initial() });

export function setLocale(l: Locale) {
  i18n.locale = l;
  document.documentElement.lang = l;
  try { localStorage.setItem('balonca.locale', l); } catch {}
}

export const t = (key: MessageKey): string => LOCALES[i18n.locale][key] ?? tr[key];
