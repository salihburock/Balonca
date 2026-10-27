import type { RemoteTrack } from './filter';

/** Base URL of the subtitle service. Same origin by default (nginx proxies /api); "off" hides the feature. */
const BASE = (import.meta.env.VITE_SUBS_API as string | undefined) ?? '/api';
export const SUBS_API_ENABLED = BASE !== 'off';

export type SubsErrorCode =
  | 'bad-request' | 'not-found' | 'bot-check' | 'yt-rate-limit' | 'busy' | 'rate-limit'
  | 'timeout' | 'no-subs' | 'unreachable' | 'failed' | 'cancelled';

export class SubsApiError extends Error {
  constructor(public readonly code: SubsErrorCode) { super(code); this.name = 'SubsApiError'; }
}

export interface RemoteList { id: string; title: string; duration: number; tracks: RemoteTrack[] }

const KNOWN = new Set<string>(['bad-request', 'not-found', 'bot-check', 'yt-rate-limit', 'busy', 'rate-limit', 'timeout', 'no-subs']);

async function request(path: string, signal?: AbortSignal): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { signal });
  } catch {
    throw new SubsApiError(signal?.aborted ? 'cancelled' : 'unreachable');
  }
  if (res.ok) return res;
  // A static host answers unknown paths with index.html (HTML, not our JSON): the service is not there.
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  throw new SubsApiError(body?.error && KNOWN.has(body.error) ? (body.error as SubsErrorCode) : body ? 'failed' : 'unreachable');
}

export async function listRemoteSubs(id: string, signal?: AbortSignal): Promise<RemoteList> {
  const res = await request(`/subs?v=${encodeURIComponent(id)}`, signal);
  const data = (await res.json().catch(() => null)) as RemoteList | null;
  if (!data || !Array.isArray(data.tracks)) throw new SubsApiError('unreachable');
  return data;
}

export async function fetchRemoteSub(id: string, track: RemoteTrack, signal?: AbortSignal): Promise<string> {
  const q = `v=${encodeURIComponent(id)}&lang=${encodeURIComponent(track.code)}&kind=${track.kind === 'manual' ? 'manual' : 'auto'}`;
  return (await request(`/sub?${q}`, signal)).text();
}
