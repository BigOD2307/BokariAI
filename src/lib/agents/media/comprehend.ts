/**
 * @module agents/media/comprehend
 * @description PURE, unit-testable transcript comprehension helpers. No
 * network, no LLM calls inside the pure functions — the embedding function is
 * injected so callers wire in `gateway.embed` while tests pass a stub.
 *
 * Strategy:
 *   - Time-window chunking: group transcript segments into ~30-60s windows,
 *     carrying the window's `startTime` so citations stay accurate.
 *   - SHORT videos (few chunks / under a token budget): "stuff" the whole
 *     transcript into the prompt with [mm:ss] markers.
 *   - LONG videos: BGE-M3 embed each chunk + the query, cosine top-k, and stuff
 *     only the most relevant windows.
 *   - Citations are formatted as `youtu.be/<id>?t=<seconds>` pointing at the
 *     window start.
 */
import type { TranscriptSegment } from '@/lib/youtube/types';
import { cosine } from '@/lib/discover/cosine';
import { citationLink, formatTimestamp } from '@/lib/youtube/id';

/** A contiguous time-window of transcript text. */
export interface TranscriptChunk {
  /** Concatenated segment text for the window. */
  text: string;
  /** Window start, seconds from video start (used for citations). */
  startTime: number;
  /** Window end, seconds from video start. */
  endTime: number;
}

export interface ChunkOptions {
  /** Target window length in seconds. Default 45. */
  windowSeconds?: number;
}

/**
 * Group segments into ~`windowSeconds` windows. Each window carries its start
 * time so a citation can deep-link to it. Segments with no timing (start=0,
 * duration=0) collapse into a single window — the "flat transcript" case from
 * ElevenLabs / Bright Data formatted_transcript.
 */
export function chunkTranscript(
  segments: TranscriptSegment[],
  opts?: ChunkOptions,
): TranscriptChunk[] {
  const windowSeconds = opts?.windowSeconds ?? 45;
  if (segments.length === 0) return [];

  const chunks: TranscriptChunk[] = [];
  let curText: string[] = [];
  let curStart = segments[0].start;
  let curEnd = segments[0].start;

  const flush = () => {
    if (curText.length === 0) return;
    chunks.push({
      text: curText.join(' ').replace(/\s+/g, ' ').trim(),
      startTime: curStart,
      endTime: curEnd,
    });
    curText = [];
  };

  for (const seg of segments) {
    const segEnd = seg.start + (seg.duration || 0);
    // Start a new window once we've spanned the target length.
    if (curText.length > 0 && seg.start - curStart >= windowSeconds) {
      flush();
      curStart = seg.start;
    }
    curText.push(seg.text);
    curEnd = Math.max(curEnd, segEnd, seg.start);
  }
  flush();

  return chunks;
}

/**
 * Render chunks into a single prompt-ready string with [mm:ss] markers, e.g.
 *   [00:00] Bonjour à tous...
 *   [00:45] Ensuite, nous parlons de...
 */
export function stuffChunks(chunks: TranscriptChunk[]): string {
  return chunks
    .map((c) => `${formatTimestamp(c.startTime)} ${c.text}`)
    .join('\n');
}

/** A scored chunk plus its citation link, returned by the selection step. */
export interface RankedChunk extends TranscriptChunk {
  score: number;
  /** youtu.be/<id>?t=<seconds> deep link to the window start. */
  citation: string;
}

export type EmbedFn = (texts: string[]) => Promise<number[][]>;

export interface ComprehendOptions extends ChunkOptions {
  /**
   * Below this chunk count we "stuff" the whole transcript (no embedding round
   * trip). Default 12 (~9 min at 45s windows).
   */
  stuffThreshold?: number;
  /** How many chunks to keep for long videos. Default 8. */
  topK?: number;
}

export interface ComprehendResult {
  videoId: string;
  /** "stuff" (whole transcript) or "rank" (top-k by cosine). */
  strategy: 'stuff' | 'rank';
  /** The chunks selected for the writer, each with a citation link. */
  chunks: RankedChunk[];
  /** Prompt-ready context with [mm:ss] markers. */
  context: string;
}

/**
 * Comprehend a transcript against a query. SHORT transcripts are stuffed whole;
 * LONG ones are embedded (via the injected `embed`) and the top-k chunks by
 * cosine similarity are kept. Citations are `youtu.be/<id>?t=<seconds>`.
 *
 * Pure aside from the injected `embed` — tests pass a deterministic stub.
 */
export async function comprehendTranscript(
  videoId: string,
  query: string,
  segments: TranscriptSegment[],
  embed: EmbedFn,
  opts?: ComprehendOptions,
): Promise<ComprehendResult> {
  const stuffThreshold = opts?.stuffThreshold ?? 12;
  const topK = opts?.topK ?? 8;
  const chunks = chunkTranscript(segments, opts);

  const withCitation = (c: TranscriptChunk, score: number): RankedChunk => ({
    ...c,
    score,
    citation: citationLink(videoId, c.startTime),
  });

  // SHORT video → stuff the whole thing, no embeddings.
  if (chunks.length <= stuffThreshold) {
    const ranked = chunks.map((c) => withCitation(c, 1));
    return {
      videoId,
      strategy: 'stuff',
      chunks: ranked,
      context: stuffChunks(chunks),
    };
  }

  // LONG video → embed query + chunks, keep top-k by cosine.
  const vectors = await embed([query, ...chunks.map((c) => c.text)]);
  const queryVec = vectors[0] ?? [];
  const ranked = chunks
    .map((c, i) => withCitation(c, cosine(queryVec, vectors[i + 1] ?? [])))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    // Re-sort the kept chunks chronologically so the stuffed context reads in
    // video order (citations remain attached per chunk regardless).
    .sort((a, b) => a.startTime - b.startTime);

  return {
    videoId,
    strategy: 'rank',
    chunks: ranked,
    context: stuffChunks(ranked),
  };
}
