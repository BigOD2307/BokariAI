/**
 * @module agents/media/transcript
 * @description `fetchTranscript(videoId, langHint)` — a graded, first-success
 * chain that tries, in order:
 *
 *   1. Bright Data YouTube transcript (when configured) — the implementation
 *      brief recommends Bright Data as PRIMARY for transcripts; the video
 *      record carries `transcript` / `formatted_transcript`.
 *   2. youtubei.js InnerTube — the JS-first, zero-key path (works in
 *      Dockerfile.slim, no yt-dlp / Python).
 *   3. Optional managed transcript API (`TRANSCRIPT_API_KEY`) — a thin hook
 *      for a hosted provider.
 *   4. ElevenLabs scribe_v1 audio STT — the LAST resort and the Wolof / Bambara
 *      / Hausa path: when no caption track exists we transcribe the audio.
 *
 * Returns `{ videoId, segments, lang, source }`. On total failure it returns a
 * typed `source:'unavailable'` result rather than throwing — every step is
 * wrapped in try/catch so a degraded transcript never breaks a research turn.
 * The successful result is cached (exact-hash, namespaced) to avoid re-fetching
 * the same video.
 */
import type {
  TranscriptResult,
  TranscriptSegment,
  TranscriptSource,
} from '@/lib/youtube/types';
import { SemanticCache } from '@/lib/cache/store';
import { hashQuery, FRESH_TTL_MS } from '@/lib/cache/semantic';

const BRIGHTDATA_BASE = 'https://api.brightdata.com';

/** TTL for cached transcripts. Transcripts are immutable per video, so we use
 *  a long-ish TTL; tunable via env, defaults to FRESH_TTL_MS for parity. */
const TRANSCRIPT_CACHE_TTL_MS = (() => {
  const raw = Number(process.env.BOKARI_TRANSCRIPT_CACHE_TTL_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : FRESH_TTL_MS;
})();

const PLACEHOLDER_EMBEDDING = [0];

let _store: SemanticCache | null = null;
const defaultStore = (): SemanticCache => {
  if (!_store) _store = new SemanticCache();
  return _store;
};

/** Test-only: inject (or reset with null) the backing cache store. */
export const setTranscriptCacheStore = (store: SemanticCache | null): void => {
  _store = store;
};

const cacheKey = (videoId: string, lang: string): string =>
  hashQuery(`transcript:${videoId}:${lang}`);

const unavailable = (videoId: string, lang: string): TranscriptResult => ({
  videoId,
  segments: [],
  lang,
  source: 'unavailable',
});

// ---------------------------------------------------------------------------
// 1. Bright Data
// ---------------------------------------------------------------------------

const brightDataConfigured = (): boolean =>
  Boolean(
    process.env.BRIGHTDATA_API_KEY?.trim() &&
      process.env.BRIGHTDATA_DS_YOUTUBE_VIDEOS?.trim(),
  );

/** Parse Bright Data's transcript field(s) into timed segments. The video
 *  record may expose a structured array (`transcript`) or a flat string
 *  (`formatted_transcript`); we handle both. */
const parseBrightDataTranscript = (
  rec: Record<string, unknown>,
): TranscriptSegment[] => {
  const structured = rec.transcript;
  if (Array.isArray(structured)) {
    const segs: TranscriptSegment[] = [];
    for (const item of structured) {
      if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>;
        const text =
          (typeof o.text === 'string' && o.text) ||
          (typeof o.line === 'string' && o.line) ||
          '';
        if (!text.trim()) continue;
        const start = Number(o.start ?? o.offset ?? o.start_time ?? 0) || 0;
        const duration = Number(o.duration ?? o.dur ?? 0) || 0;
        segs.push({ text: text.trim(), start, duration });
      }
    }
    if (segs.length > 0) return segs;
  }
  const flat =
    (typeof rec.formatted_transcript === 'string' && rec.formatted_transcript) ||
    (typeof structured === 'string' && structured) ||
    '';
  if (flat.trim()) {
    // No timing info — one big segment at t=0.
    return [{ text: flat.trim(), start: 0, duration: 0 }];
  }
  return [];
};

const fromBrightData = async (
  videoId: string,
  langHint: string,
): Promise<TranscriptResult | null> => {
  if (!brightDataConfigured()) return null;
  const key = process.env.BRIGHTDATA_API_KEY!.trim();
  const dataset = process.env.BRIGHTDATA_DS_YOUTUBE_VIDEOS!.trim();
  const headers = {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  const pollIntervalMs = Number(process.env.BRIGHTDATA_POLL_INTERVAL_MS) || 4000;
  const pollTimeoutMs = Number(process.env.BRIGHTDATA_POLL_TIMEOUT_MS) || 45000;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  try {
    // Synchronous collect-by-URL: single video, low latency, inline result.
    const params = new URLSearchParams({ dataset_id: dataset, format: 'json' });
    const res = await fetch(`${BRIGHTDATA_BASE}/datasets/v3/scrape?${params}`, {
      method: 'POST',
      headers,
      body: JSON.stringify([
        {
          url: `https://www.youtube.com/watch?v=${videoId}`,
          transcription_language: langHint.slice(0, 2),
        },
      ]),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    let json: unknown = await res.json();

    // Sync /scrape can degrade to a snapshot_id we must poll.
    if (
      json &&
      typeof json === 'object' &&
      !Array.isArray(json) &&
      typeof (json as { snapshot_id?: string }).snapshot_id === 'string'
    ) {
      const snapshotId = (json as { snapshot_id: string }).snapshot_id;
      const deadline = Date.now() + pollTimeoutMs;
      let ready = false;
      while (Date.now() < deadline) {
        const prog = await fetch(
          `${BRIGHTDATA_BASE}/datasets/v3/progress/${snapshotId}`,
          { headers, signal: AbortSignal.timeout(15000) },
        );
        if (prog.ok) {
          const { status } = (await prog.json()) as { status?: string };
          if (status === 'ready') {
            ready = true;
            break;
          }
          if (status === 'failed') return null;
        }
        await sleep(pollIntervalMs);
      }
      if (!ready) return null;
      const snap = await fetch(
        `${BRIGHTDATA_BASE}/datasets/v3/snapshot/${snapshotId}?format=json`,
        { headers, signal: AbortSignal.timeout(20000) },
      );
      if (snap.status !== 200) return null;
      json = await snap.json();
    }

    const records: Record<string, unknown>[] = Array.isArray(json)
      ? (json as Record<string, unknown>[])
      : json && typeof json === 'object'
        ? [json as Record<string, unknown>]
        : [];
    for (const rec of records) {
      const segments = parseBrightDataTranscript(rec);
      if (segments.length > 0) {
        const lang =
          (typeof rec.transcription_language === 'string' &&
            rec.transcription_language) ||
          langHint;
        return { videoId, segments, lang, source: 'brightdata' };
      }
    }
    return null;
  } catch (err) {
    console.warn('[Bokari Transcript] Bright Data failed:', err);
    return null;
  }
};

// ---------------------------------------------------------------------------
// 2. youtubei.js InnerTube
// ---------------------------------------------------------------------------

const fromInnerTube = async (
  videoId: string,
  langHint: string,
): Promise<TranscriptResult | null> => {
  try {
    const { Innertube } = await import('youtubei.js');
    const yt = await Innertube.create({ retrieve_player: false });
    const info = await yt.getInfo(videoId);
    const transcriptData = await info.getTranscript();
    const segs =
      transcriptData?.transcript?.content?.body?.initial_segments ?? [];
    const segments: TranscriptSegment[] = [];
    for (const s of segs) {
      // InnerTube segments expose snippet text + ms offsets; tolerate shape
      // drift by reading defensively.
      const seg = s as unknown as Record<string, any>;
      const text: string =
        seg?.snippet?.text ?? seg?.snippet?.toString?.() ?? '';
      if (!text || !text.trim()) continue;
      const startMs = Number(seg?.start_ms ?? seg?.startMs ?? 0) || 0;
      const endMs = Number(seg?.end_ms ?? seg?.endMs ?? 0) || 0;
      const start = startMs / 1000;
      const duration = endMs > startMs ? (endMs - startMs) / 1000 : 0;
      segments.push({ text: text.trim(), start, duration });
    }
    if (segments.length === 0) return null;
    return { videoId, segments, lang: langHint, source: 'innertube' };
  } catch (err) {
    console.warn('[Bokari Transcript] InnerTube failed:', err);
    return null;
  }
};

// ---------------------------------------------------------------------------
// 3. Optional managed API
// ---------------------------------------------------------------------------

const fromManaged = async (
  videoId: string,
  langHint: string,
): Promise<TranscriptResult | null> => {
  const key = process.env.TRANSCRIPT_API_KEY?.trim();
  const base = process.env.TRANSCRIPT_API_URL?.trim();
  if (!key || !base) return null;
  try {
    const url = `${base.replace(/\/$/, '')}/transcript?video_id=${encodeURIComponent(
      videoId,
    )}&lang=${encodeURIComponent(langHint.slice(0, 2))}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      segments?: Array<{ text?: string; start?: number; duration?: number }>;
      lang?: string;
    };
    const segments: TranscriptSegment[] = (json.segments ?? [])
      .map((s) => ({
        text: (s.text ?? '').trim(),
        start: Number(s.start ?? 0) || 0,
        duration: Number(s.duration ?? 0) || 0,
      }))
      .filter((s) => s.text);
    if (segments.length === 0) return null;
    return { videoId, segments, lang: json.lang ?? langHint, source: 'managed' };
  } catch (err) {
    console.warn('[Bokari Transcript] managed API failed:', err);
    return null;
  }
};

// ---------------------------------------------------------------------------
// 4. ElevenLabs scribe_v1 audio STT (Wolof / Bambara / Hausa path)
// ---------------------------------------------------------------------------

/**
 * Transcribe the video's audio via ElevenLabs scribe_v1. This is the path for
 * African languages with no caption track. We fetch the audio stream through
 * youtubei.js (JS-only, slim-image-safe) and POST it to ElevenLabs with a
 * DYNAMIC `language_code` (the STT route was made dynamic; here we pass the
 * hint directly). Slow — meant for the async path, not the SSE hot path.
 */
const fromElevenLabs = async (
  videoId: string,
  langHint: string,
): Promise<TranscriptResult | null> => {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  // STT is opt-in for the slow path; without an explicit enable flag we skip it
  // so a research turn never blocks on multi-minute audio transcription.
  if (!key || (process.env.BOKARI_YOUTUBE_STT_ENABLED ?? 'false') === 'false') {
    return null;
  }
  try {
    const { Innertube } = await import('youtubei.js');
    const yt = await Innertube.create();
    const info = await yt.getInfo(videoId);
    const stream = await info.download({
      type: 'audio',
      quality: 'best',
      format: 'mp4',
    });
    // Collect the stream into a Blob for the multipart upload.
    const chunks: Uint8Array[] = [];
    const reader = (stream as ReadableStream<Uint8Array>).getReader();
    // Cap the download to keep the worst case bounded (~25MB).
    let total = 0;
    const MAX_BYTES = 25 * 1024 * 1024;
    while (total < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.length;
      }
    }
    const audioBlob = new Blob(chunks as BlobPart[], { type: 'audio/mp4' });

    const form = new FormData();
    form.append('audio', audioBlob, 'audio.mp4');
    form.append('model_id', 'scribe_v1');
    form.append('language_code', langHint.slice(0, 2) || 'fr');

    const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': key },
      body: form,
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { text?: string };
    const text = (data.text ?? '').trim();
    if (!text) return null;
    // ElevenLabs returns a flat transcription — one segment at t=0.
    return {
      videoId,
      segments: [{ text, start: 0, duration: 0 }],
      lang: langHint,
      source: 'elevenlabs',
    };
  } catch (err) {
    console.warn('[Bokari Transcript] ElevenLabs STT failed:', err);
    return null;
  }
};

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/** The first-success chain, in priority order. */
const CHAIN: Array<
  (videoId: string, langHint: string) => Promise<TranscriptResult | null>
> = [fromBrightData, fromInnerTube, fromManaged, fromElevenLabs];

/**
 * Fetch a transcript for `videoId`, preferring `langHint` (default "fr"). Tries
 * each provider in order and returns the first success; if all fail, returns a
 * typed `source:'unavailable'` result. Caches successes (exact-hash).
 */
export const fetchTranscript = async (
  videoId: string,
  langHint: string = 'fr',
  opts?: { store?: SemanticCache },
): Promise<TranscriptResult> => {
  const lang = (langHint || 'fr').toLowerCase();
  const store = opts?.store ?? defaultStore();
  const key = cacheKey(videoId, lang);

  try {
    const hit = store.getByHash(key);
    if (hit) {
      store.recordHit(hit.id);
      const parsed = JSON.parse(hit.response) as TranscriptResult;
      if (parsed && Array.isArray(parsed.segments)) return parsed;
    }
  } catch {
    /* corrupt entry — fall through */
  }

  let result: TranscriptResult = unavailable(videoId, lang);
  for (const step of CHAIN) {
    try {
      const out = await step(videoId, lang);
      if (out && out.segments.length > 0) {
        result = out;
        break;
      }
    } catch {
      /* each step is already defensive; keep going */
    }
  }

  // Only cache successes — an "unavailable" today might be available tomorrow.
  if (result.source !== 'unavailable') {
    try {
      store.upsert({
        query: `transcript:${videoId}:${lang}`,
        queryHash: key,
        embedding: PLACEHOLDER_EMBEDDING,
        response: JSON.stringify(result),
        metadata: { kind: 'transcript', source: result.source },
        ttlMs: TRANSCRIPT_CACHE_TTL_MS,
      });
    } catch {
      /* best-effort */
    }
  }

  return result;
};

export type { TranscriptResult, TranscriptSegment, TranscriptSource };
