export interface LangInfo { tr: string; en: string; aliases: string[] }

/** Languages we can name and detect from file names. Unknown codes still work, they just show the code. */
export const LANGUAGES: Record<string, LangInfo> = {
  nl: { tr: 'Felemenkçe', en: 'Dutch', aliases: ['dutch', 'nederlands', 'flemish', 'vlaams', 'felemenkçe', 'felemenkce'] },
  tr: { tr: 'Türkçe', en: 'Turkish', aliases: ['turkish', 'türkçe', 'turkce', 'turkce'] },
  en: { tr: 'İngilizce', en: 'English', aliases: ['english', 'ingilizce'] },
  de: { tr: 'Almanca', en: 'German', aliases: ['german', 'deutsch', 'almanca'] },
  fr: { tr: 'Fransızca', en: 'French', aliases: ['french', 'français', 'francais', 'fransızca'] },
  es: { tr: 'İspanyolca', en: 'Spanish', aliases: ['spanish', 'español', 'espanol', 'ispanyolca'] },
  it: { tr: 'İtalyanca', en: 'Italian', aliases: ['italian', 'italiano', 'italyanca'] },
  pt: { tr: 'Portekizce', en: 'Portuguese', aliases: ['portuguese', 'português', 'portugues'] },
  ru: { tr: 'Rusça', en: 'Russian', aliases: ['russian', 'русский', 'rusça'] },
  ja: { tr: 'Japonca', en: 'Japanese', aliases: ['japanese', 'japonca'] },
  ko: { tr: 'Korece', en: 'Korean', aliases: ['korean', 'korece'] },
  zh: { tr: 'Çince', en: 'Chinese', aliases: ['chinese', 'çince'] },
  ar: { tr: 'Arapça', en: 'Arabic', aliases: ['arabic', 'arapça'] },
  pl: { tr: 'Lehçe', en: 'Polish', aliases: ['polish', 'polski'] },
  sv: { tr: 'İsveççe', en: 'Swedish', aliases: ['swedish', 'svenska'] },
  da: { tr: 'Danca', en: 'Danish', aliases: ['danish', 'dansk'] },
  no: { tr: 'Norveççe', en: 'Norwegian', aliases: ['norwegian', 'norsk'] },
  fi: { tr: 'Fince', en: 'Finnish', aliases: ['finnish', 'suomi'] },
  el: { tr: 'Yunanca', en: 'Greek', aliases: ['greek'] },
  uk: { tr: 'Ukraynaca', en: 'Ukrainian', aliases: ['ukrainian'] },
  cs: { tr: 'Çekçe', en: 'Czech', aliases: ['czech'] },
  hu: { tr: 'Macarca', en: 'Hungarian', aliases: ['hungarian'] },
  ro: { tr: 'Romence', en: 'Romanian', aliases: ['romanian'] },
  hi: { tr: 'Hintçe', en: 'Hindi', aliases: ['hindi'] },
  fa: { tr: 'Farsça', en: 'Persian', aliases: ['persian', 'farsi'] },
  he: { tr: 'İbranice', en: 'Hebrew', aliases: ['hebrew'] },
  id: { tr: 'Endonezce', en: 'Indonesian', aliases: ['indonesian'] },
};

export function langName(code: string, locale: 'tr' | 'en'): string {
  return LANGUAGES[code]?.[locale] ?? code;
}

const SUB_EXT = /\.(srt|vtt|json3|json|txt|sbv|ass)$/i;
const ALIAS_TO_CODE = new Map<string, string>(
  Object.entries(LANGUAGES).flatMap(([code, l]) => l.aliases.map((a) => [a, code] as const)),
);

/**
 * Guesses a language code from a subtitle file name.
 * Short codes only count right before the extension or in brackets ("video.nl.srt", "clip [tr].vtt"),
 * so a title like "Where is it.srt" is not mistaken for Italian.
 */
export function detectLangFromFilename(filename: string): string | null {
  const base = filename.replace(/^.*[\\/]/, '');
  if (!SUB_EXT.test(base)) return null;
  const stem = base.replace(SUB_EXT, '');

  const bracket = stem.match(/[[(]([a-z]{2,3})(?:[-_][a-z0-9]+)?[\])]/i);
  if (bracket && LANGUAGES[bracket[1].toLowerCase()]) return bracket[1].toLowerCase();

  const tail = stem.match(/[._-]([a-z]{2,3})(?:[-_][A-Za-z0-9]+)?$/);
  if (tail && LANGUAGES[tail[1].toLowerCase()]) return tail[1].toLowerCase();

  const tokens = stem.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean).reverse();
  for (const tok of tokens) {
    const hit = ALIAS_TO_CODE.get(tok);
    if (hit) return hit;
  }
  return null;
}
