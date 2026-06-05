/**
 * @module youtube/id
 * @description Pure helpers for extracting a YouTube video id from the many
 * URL shapes (watch?v=, youtu.be/, /embed/, /shorts/) or a bare 11-char id, and
 * for building citation links. No network, fully unit-testable.
 */

/** A YouTube video id is exactly 11 chars of [A-Za-z0-9_-]. */
const ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extract an 11-char video id from a URL or bare id. Returns null when nothing
 * id-shaped is present. Handles watch?v=, youtu.be/, /embed/, /shorts/, /v/.
 */
export function extractVideoId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Bare id.
  if (ID_RE.test(trimmed)) return trimmed;

  // ?v= or &v= anywhere.
  const v = trimmed.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (v) return v[1];

  // youtu.be/<id>, /embed/<id>, /shorts/<id>, /v/<id>
  const path = trimmed.match(
    /(?:youtu\.be\/|\/embed\/|\/shorts\/|\/v\/)([A-Za-z0-9_-]{11})/,
  );
  if (path) return path[1];

  return null;
}

/**
 * Find the first YouTube video id mentioned anywhere in a free-text query
 * (used to decide whether the comprehension action should fire). Returns null
 * when the text has no YouTube reference.
 */
export function findVideoIdInText(text: string): string | null {
  if (!text) return null;
  // A YouTube URL must be present for us to treat a token as a video id — we
  // deliberately do NOT match bare 11-char tokens here to avoid false positives
  // on arbitrary words.
  const urlMatch = text.match(
    /https?:\/\/[^\s]*(?:youtube\.com|youtu\.be)[^\s]*/i,
  );
  if (urlMatch) return extractVideoId(urlMatch[0]);
  return null;
}

/** Canonical citation link to a timestamp inside a video. */
export function citationLink(videoId: string, seconds: number): string {
  const t = Math.max(0, Math.floor(seconds || 0));
  return `https://youtu.be/${videoId}?t=${t}`;
}

/** Format seconds as [mm:ss] (or [h:mm:ss] past an hour) for stuffed prompts. */
export function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `[${h}:${pad(m)}:${pad(s)}]` : `[${pad(m)}:${pad(s)}]`;
}
