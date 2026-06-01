import { createHash } from 'crypto';
import TurnDown from 'turndown';
import { extractMetadata, type ArticleMetadata } from './metadataExtractor';

export type ExtractionResult = {
  url: string;
  fullContent: string | null;
  metadata: ArticleMetadata;
  contentHash: string | null;
  success: boolean;
  error?: string;
};

export type ExtractOptions = {
  timeoutMs?: number;
  maxLength?: number;
};

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_LENGTH = 4_000;

let _turndown: TurnDown | null = null;
function getTurndown(): TurnDown {
  if (!_turndown) {
    _turndown = new TurnDown({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
    _turndown.remove(['script', 'style', 'nav', 'footer', 'header', 'aside', 'noscript', 'iframe']);
  }
  return _turndown;
}

function extractContentFromHtml(html: string, maxLength: number): string | null {
  let contentHtml = html;
  const mainMatch = html.match(/<(article|main)[^>]*>([\s\S]*?)<\/\1>/i);
  if (mainMatch) {
    contentHtml = mainMatch[2];
  } else {
    contentHtml = contentHtml
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  }

  const markdown = getTurndown().turndown(contentHtml);
  const cleaned = markdown.replace(/\n{3,}/g, '\n\n').replace(/^\s+$/gm, '').trim();

  if (cleaned.length < 50) return null;
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

/**
 * Extract a single article: full markdown content + metadata + content hash.
 * Always resolves; never throws.  On failure, returns success=false with
 * a human-readable error so callers can log and decide.
 */
export async function extractArticle(
  url: string,
  options: ExtractOptions = {},
): Promise<ExtractionResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;

  let rawHtml: string | null = null;
  try {
    rawHtml = await fetchRawHtml(url, timeoutMs);
  } catch (err) {
    return {
      url,
      fullContent: null,
      metadata: { author: null, publishedAt: null, canonicalUrl: null },
      contentHash: null,
      success: false,
      error: `fetch failed: ${(err as Error).message ?? 'unknown'}`,
    };
  }

  if (rawHtml === null) {
    return {
      url,
      fullContent: null,
      metadata: { author: null, publishedAt: null, canonicalUrl: null },
      contentHash: null,
      success: false,
      error: 'fetch failed: non-html or non-2xx',
    };
  }

  const metadata = extractMetadata(rawHtml);
  const fullContent = extractContentFromHtml(rawHtml, maxLength);
  if (fullContent === null) {
    return {
      url,
      fullContent: null,
      metadata,
      contentHash: null,
      success: false,
      error: 'extraction produced no usable content',
    };
  }

  const contentHash = createHash('sha256').update(fullContent).digest('hex');

  return {
    url,
    fullContent,
    metadata,
    contentHash,
    success: true,
  };
}

/**
 * Extract many articles in parallel, with a concurrency cap so we don't
 * hammer the network or get rate-limited.
 *
 * Order of the returned array is the same as the input `urls` array.
 * Returns ALL results, including failures — callers filter as needed.
 */
export async function extractArticlesInParallel(
  urls: string[],
  options: ExtractOptions & { maxConcurrent?: number } = {},
): Promise<ExtractionResult[]> {
  const maxConcurrent = options.maxConcurrent ?? 5;
  const results: ExtractionResult[] = new Array(urls.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (true) {
      const idx = cursor++;
      if (idx >= urls.length) return;
      const url = urls[idx];
      results[idx] = await extractArticle(url, options);
    }
  }

  const workers = Array.from(
    { length: Math.min(maxConcurrent, urls.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

/**
 * Internal: fetch HTML and validate content-type.  Returns null on
 * non-2xx / non-HTML.  We keep this private to extractArticle because
 * the public caller should not need raw HTML.
 */
async function fetchRawHtml(url: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Bokari/1.0; +https://bokari.ai)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return null;
    }
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}
