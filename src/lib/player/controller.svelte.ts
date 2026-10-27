import { app } from '../state.svelte';
import { findCue, nextCue, prevCue } from './cues';
import { createPlayer, YT_PLAYING, type YTPlayer } from './youtube';

export type PlayerError = 'api-blocked' | 'invalid' | 'html5' | 'not-found' | 'not-embeddable';
const ERROR_MAP: Record<number, PlayerError> = { 2: 'invalid', 5: 'html5', 100: 'not-found', 101: 'not-embeddable', 150: 'not-embeddable' };

class PlayerController {
  ready = $state(false);
  playing = $state(false);
  error = $state<PlayerError | null>(null);
  time = $state(0); // refreshed ~4x/second, for the seek bar only
  duration = $state(0);
  rate = $state(1);
  loop = $state(false);
  /** Active cue index per visible track id, updated only when it actually changes. */
  active = $state<Record<string, number>>({});

  private yt: YTPlayer | null = null;
  private raf = 0;
  private lastUi = 0;
  private pending: { id: string; start: number } | null = null;
  private loadedId: string | null = null;
  private autoPausedAt = -1;

  async mount(host: HTMLElement) {
    try {
      this.yt = await createPlayer(host, {
        onReady: () => {
          this.ready = true;
          if (this.pending) this.load(this.pending.id, this.pending.start);
        },
        onState: (s) => { this.playing = s === YT_PLAYING; },
        onError: (code) => { this.error = ERROR_MAP[code] ?? 'html5'; },
      });
      this.loop_();
    } catch {
      this.error = 'api-blocked';
    }
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    try { this.yt?.destroy(); } catch {}
    this.yt = null; this.ready = false; this.loadedId = null; this.playing = false;
  }

  load(id: string, start = 0) {
    this.error = null;
    if (!this.ready || !this.yt) { this.pending = { id, start }; return; }
    this.pending = null;
    this.loadedId = id;
    this.yt.loadVideoById({ videoId: id, startSeconds: start });
    this.yt.setPlaybackRate(this.rate);
  }

  get loaded() { return this.loadedId; }
  iframe() { return this.yt?.getIframe() ?? null; }
  now() { return this.ready && this.yt ? this.yt.getCurrentTime() : 0; }

  play() { this.yt?.playVideo(); }
  pause() { this.yt?.pauseVideo(); }
  toggle() { if (this.ready) (this.playing ? this.pause() : this.play()); }
  seek(t: number) { if (this.ready) { this.yt?.seekTo(Math.max(0, t), true); this.time = t; } }
  setRate(r: number) { this.rate = r; this.yt?.setPlaybackRate(r); }

  /** The first visible track drives the transcript, line navigation, repeat and auto-pause. */
  get primary() { return app.visibleTracks[0]; }

  jump(dir: 1 | -1) {
    const p = this.primary;
    if (!p) return;
    const i = dir > 0 ? nextCue(p.cues, this.now(), p.offset) : prevCue(p.cues, this.now(), p.offset);
    if (i >= 0) this.seek(p.cues[i].start + p.offset);
  }

  seekToCue(trackId: string, index: number) {
    const tr = app.tracks.find((t) => t.id === trackId);
    if (tr?.cues[index]) this.seek(tr.cues[index].start + tr.offset);
  }

  private loop_ = () => {
    this.raf = requestAnimationFrame(this.loop_);
    if (!this.ready || !this.yt) return;
    const t = this.yt.getCurrentTime();

    const next: Record<string, number> = {};
    for (const tr of app.visibleTracks) next[tr.id] = findCue(tr.cues, t - tr.offset);
    const keys = Object.keys(next);
    if (keys.length !== Object.keys(this.active).length || keys.some((k) => next[k] !== this.active[k])) this.active = next;

    const p = app.visibleTracks[0];
    if (p) {
      const idx = next[p.id];
      if (this.autoPausedAt !== -1 && idx !== this.autoPausedAt) this.autoPausedAt = -1; // line changed: re-arm
      if (idx >= 0) {
        const end = p.cues[idx].end + p.offset;
        if (this.loop && t > end - 0.05) this.seek(p.cues[idx].start + p.offset);
        else if (app.settings.autoPause && this.playing && t > end - 0.1 && this.autoPausedAt !== idx) {
          this.autoPausedAt = idx;
          this.pause();
        }
      }
    }

    const nowMs = performance.now();
    if (nowMs - this.lastUi > 250) {
      this.lastUi = nowMs;
      this.time = t;
      this.duration = this.yt.getDuration() || this.duration;
    }
  };
}

export const player = new PlayerController();
