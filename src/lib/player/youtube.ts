/** Minimal typing of the official YouTube IFrame Player API (we only use what we call). */
export interface YTPlayer {
  loadVideoById(o: { videoId: string; startSeconds?: number }): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  setPlaybackRate(r: number): void;
  getIframe(): HTMLIFrameElement;
  destroy(): void;
}
interface YTNamespace {
  Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer;
  PlayerState: { PLAYING: 1; PAUSED: 2; ENDED: 0; BUFFERING: 3 };
}
declare global {
  interface Window { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void }
}

export const YT_PLAYING = 1;

/** Accepts full URLs (watch, youtu.be, shorts, embed, live) or a bare 11-char id. */
export function parseVideoId(input: string): string | null {
  const s = input.trim();
  const m =
    s.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/|\/v\/)([\w-]{11})(?![\w-])/) ?? s.match(/^([\w-]{11})$/);
  return m ? m[1] : null;
}

let apiReady: Promise<YTNamespace> | null = null;

/** Loads https://www.youtube.com/iframe_api once. */
export function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiReady ??= new Promise<YTNamespace>((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT!); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { apiReady = null; reject(new Error('youtube-api-blocked')); };
    document.head.append(s);
  });
  return apiReady;
}

export async function createPlayer(
  host: HTMLElement,
  handlers: { onReady(): void; onState(state: number): void; onError(code: number): void },
): Promise<YTPlayer> {
  const YT = await loadYouTubeApi();
  return new YT.Player(host, {
    width: '100%', height: '100%',
    host: 'https://www.youtube-nocookie.com', // privacy-enhanced mode: no cookies until playback
    playerVars: { controls: 0, fs: 0, rel: 0, playsinline: 1, disablekb: 1, iv_load_policy: 3, cc_load_policy: 0, origin: location.origin },
    events: {
      onReady: () => handlers.onReady(),
      onStateChange: (e: { data: number }) => handlers.onState(e.data),
      onError: (e: { data: number }) => handlers.onError(e.data),
    },
  });
}
