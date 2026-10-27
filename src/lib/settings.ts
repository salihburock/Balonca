export type ThemeSetting = 'auto' | 'light' | 'dark';
export type SubStyle = 'box' | 'outline' | 'shadow' | 'contrast';

export interface Settings {
  theme: ThemeSetting;
  locale: 'tr' | 'en';
  subSize: number; // px, 14-48
  subBg: number; // 0-100
  subStyle: SubStyle;
  pauseOnSave: boolean;
  autoScroll: boolean;
  hideSecondary: boolean; // blur 2nd+ tracks until clicked
  autoPause: boolean; // pause at the end of every line
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'auto',
  locale: 'tr',
  subSize: 26,
  subBg: 55,
  subStyle: 'box',
  pauseOnSave: true,
  autoScroll: true,
  hideSecondary: false,
  autoPause: false,
};

const clamp = (n: unknown, lo: number, hi: number, d: number) =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const oneOf = <T extends string>(v: unknown, opts: readonly T[], d: T): T =>
  (opts as readonly unknown[]).includes(v) ? (v as T) : d;

/** Validates untrusted settings (backup files, old data) and fills gaps with defaults. */
export function sanitizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  return {
    theme: oneOf(r.theme, ['auto', 'light', 'dark'] as const, d.theme),
    locale: oneOf(r.locale, ['tr', 'en'] as const, d.locale),
    subSize: clamp(r.subSize, 14, 48, d.subSize),
    subBg: clamp(r.subBg, 0, 100, d.subBg),
    subStyle: oneOf(r.subStyle, ['box', 'outline', 'shadow', 'contrast'] as const, d.subStyle),
    pauseOnSave: bool(r.pauseOnSave, d.pauseOnSave),
    autoScroll: bool(r.autoScroll, d.autoScroll),
    hideSecondary: bool(r.hideSecondary, d.hideSecondary),
    autoPause: bool(r.autoPause, d.autoPause),
  };
}
