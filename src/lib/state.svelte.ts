import { DEFAULT_SETTINGS, type Settings } from './settings';
import { TRACK_COLORS, uid, type SavedWord, type StoredTrack } from './types';
import { openBalonca, loadSettings, saveSettings, loadWords, putWord, deleteWord, deleteLanguage, loadTracks, saveTracks,
  getLastVideo, setLastVideo, exportBackup, parseBackup, importBackup, type Db } from './storage';
import { parseSubtitles } from './subtitles';
import { detectLangFromFilename } from './languages';
import { makeWord, toggleWord, wordId } from './words/bags';
import { schedule, type Grade } from './srs/scheduler';
import { setLocale } from './i18n/index.svelte';
import { theme, applyTheme } from './theme.svelte';

const debounce = <A extends unknown[]>(fn: (...a: A) => void, ms: number) => {
  let h: ReturnType<typeof setTimeout>;
  return (...a: A) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); };
};

class AppState {
  ready = $state(false);
  storageOk = $state(true); // false when IndexedDB is unavailable (private mode etc.): app still works, nothing persists
  settings = $state<Settings>({ ...DEFAULT_SETTINGS });
  words = $state<SavedWord[]>([]);
  vid = $state<string | null>(null);
  tracks = $state<StoredTrack[]>([]);
  savedIds = $derived(new Set(this.words.map((w) => w.id)));
  visibleTracks = $derived(this.tracks.filter((t) => t.visible));

  private db: Db | null = null;
  private persistTracks = debounce(() => {
    if (this.db && this.vid) void saveTracks(this.db, this.vid, $state.snapshot(this.tracks) as StoredTrack[]);
  }, 400);
  private persistSettings = debounce(() => {
    if (this.db) void saveSettings(this.db, $state.snapshot(this.settings) as Settings);
  }, 300);

  async init(): Promise<string | null> {
    try {
      this.db = await openBalonca();
      this.settings = await loadSettings(this.db);
      this.words = await loadWords(this.db);
      this.applySettings(false);
      const last = await getLastVideo(this.db);
      this.ready = true;
      return last;
    } catch {
      this.storageOk = false;
      this.ready = true;
      return null;
    }
  }

  /** Mirrors theme/locale to the UI modules; `persist` is false while loading. */
  private applySettings(persist: boolean) {
    theme.value = this.settings.theme;
    applyTheme();
    setLocale(this.settings.locale);
    if (persist) this.persistSettings();
  }

  setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    this.settings[key] = value;
    if (key === 'theme' || key === 'locale') this.applySettings(true);
    else this.persistSettings();
  }

  async openVideo(id: string) {
    if (this.vid === id) return;
    this.vid = id;
    this.tracks = this.db ? await loadTracks(this.db, id) : [];
    if (this.db) await setLastVideo(this.db, id);
  }

  /** Parses subtitle text into a new track. Throws SubtitleParseError on bad input. */
  addTrack(text: string, name: string, hintLang?: string) {
    const res = parseSubtitles(text);
    const lang = hintLang || detectLangFromFilename(name) || '??';
    const track: StoredTrack = {
      id: uid(), vid: this.vid ?? '', name, lang, label: lang === '??' ? name.replace(/\.[^.]+$/, '') : '',
      color: TRACK_COLORS[this.tracks.length % TRACK_COLORS.length], visible: true, offset: 0, cues: res.cues,
    };
    this.tracks.push(track);
    this.persistTracks();
    return { track, result: res };
  }

  /** Adds an already-parsed track (e.g. the result of a translation). */
  addCues(cues: StoredTrack['cues'], name: string, lang: string) {
    const track: StoredTrack = {
      id: uid(), vid: this.vid ?? '', name, lang, label: '',
      color: TRACK_COLORS[this.tracks.length % TRACK_COLORS.length], visible: true, offset: 0, cues,
    };
    this.tracks.push(track);
    this.persistTracks();
    return track;
  }

  updateTrack(id: string, patch: Partial<Pick<StoredTrack, 'label' | 'lang' | 'color' | 'visible' | 'offset'>>) {
    const t = this.tracks.find((x) => x.id === id);
    if (!t) return;
    Object.assign(t, patch);
    this.persistTracks();
  }

  removeTrack(id: string) {
    this.tracks = this.tracks.filter((t) => t.id !== id);
    this.persistTracks();
  }

  /** Saves the word if new, removes it if already saved. Returns true when it was added. */
  toggleWord(args: { lang: string; word: string; ctx: string; trans?: { lang: string; text: string }[]; t: number }): boolean {
    const w = makeWord({ ...args, vid: this.vid ?? undefined });
    const { list, added } = toggleWord(this.words, w);
    this.words = list;
    if (this.db) void (added ? putWord(this.db, $state.snapshot(w) as SavedWord) : deleteWord(this.db, w.id));
    return added;
  }

  isSaved(lang: string, key: string) {
    return this.savedIds.has(wordId(lang, key));
  }

  removeWord(id: string) {
    this.words = this.words.filter((w) => w.id !== id);
    if (this.db) void deleteWord(this.db, id);
  }

  clearLanguage(lang: string) {
    this.words = this.words.filter((w) => w.lang !== lang);
    if (this.db) void deleteLanguage(this.db, lang);
  }

  grade(id: string, grade: Grade) {
    const w = this.words.find((x) => x.id === id);
    if (!w) return;
    Object.assign(w, schedule(w, grade));
    if (this.db) void putWord(this.db, $state.snapshot(w) as SavedWord);
  }

  async exportAll(): Promise<Blob> {
    if (!this.db) throw new Error('no-storage');
    return new Blob([JSON.stringify(await exportBackup(this.db))], { type: 'application/json' });
  }

  async importAll(text: string, mode: 'replace' | 'merge') {
    if (!this.db) throw new Error('no-storage');
    const backup = parseBackup(text);
    const counts = await importBackup(this.db, backup, mode);
    this.words = await loadWords(this.db);
    if (mode === 'replace') {
      this.settings = await loadSettings(this.db);
      this.applySettings(false);
      this.vid = null;
    } else if (this.vid) {
      this.tracks = await loadTracks(this.db, this.vid);
    }
    return counts;
  }

}

export const app = new AppState();
export type { Grade };
