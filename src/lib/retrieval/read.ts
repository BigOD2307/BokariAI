import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import TurndownService from 'turndown';
import { extractMetadata } from '@/lib/discover/metadataExtractor';
import { assertPublicHttpUrl } from '@/lib/net/url-guard';

export type ReadPage = {
  url: string;
  title: string | null;
  /** Article body as markdown, boilerplate removed. */
  text: string;
  publishedAt: Date | null;
  author: string | null;
  /** Raw byte length fetched — useful to spot sites serving app shells. */
  bytes: number;
};

const FETCH_TIMEOUT_MS = 8_000;
const MAX_BYTES = 3_000_000;
/** Hard ceiling on extracted text. Passage selection (passages.ts) is what
 *  keeps the prompt small; this only protects memory against pathological
 *  pages. */
const MAX_TEXT = 60_000;

let turndown: TurndownService | null = null;
function getTurndown(): TurndownService {
  if (!turndown) {
    turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
    turndown.remove(['script', 'style', 'nav', 'footer', 'header', 'aside', 'noscript', 'iframe', 'form']);
  }
  return turndown;
}

/**
 * Fetch and extract one page. Never throws — a failed read is a missing source,
 * not a failed request.
 *
 * Readability is Firefox's Reader Mode algorithm: it scores DOM nodes by text
 * density and link ratio, which is why it beats the old `<article>|<main>`
 * regex (src/lib/utils/extractContent.ts) on the WordPress themes most
 * African news sites run.
 */
export async function readPage(rawUrl: string): Promise<ReadPage | null> {
  let url: URL;
  try {
    url = await assertPublicHttpUrl(rawUrl);
  } catch {
    return null;
  }

  let html: string;
  let bytes = 0;
  try {
    const res = await fetch(url, {
      headers: {
        // Some sites 403 unknown agents; identify honestly and give a contact.
        'User-Agent': 'Mozilla/5.0 (compatible; BokariBot/1.0; +https://bokari.space/bot)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.7',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    if (!(res.headers.get('content-type') ?? '').includes('html')) return null;

    const buffer = await res.arrayBuffer();
    bytes = buffer.byteLength;
    if (bytes > MAX_BYTES) return null;
    html = new TextDecoder('utf-8').decode(buffer);
  } catch {
    return null;
  }

  // Metadata comes from the RAW html: Readability strips <head>, and that is
  // where JSON-LD and OpenGraph publication dates live.
  const metadata = extractMetadata(html);

  let text = '';
  let title: string | null = null;
  try {
    const { document } = parseHTML(html);
    const article = new Readability(document as unknown as Document, {
      charThreshold: 250,
    }).parse();

    if (article?.content) {
      title = article.title?.trim() || null;
      text = getTurndown().turndown(article.content);
    }
  } catch {
    // Readability throws on malformed documents; fall through to the body text.
  }

  if (text.trim().length < 200) {
    try {
      const { document } = parseHTML(html);
      text = (document.body?.textContent ?? '').replace(/\s+/g, ' ');
    } catch {
      return null;
    }
  }

  text = text.replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_TEXT);
  if (text.length < 200) return null;

  return {
    url: rawUrl,
    title,
    text,
    publishedAt: metadata.publishedAt,
    author: metadata.author,
    bytes,
  };
}

/** Read many pages with bounded concurrency. Failures are simply absent. */
export async function readPages(
  urls: string[],
  concurrency = 6,
): Promise<Map<string, ReadPage>> {
  const out = new Map<string, ReadPage>();
  const queue = [...urls];

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    for (let url = queue.shift(); url; url = queue.shift()) {
      const page = await readPage(url);
      if (page) out.set(url, page);
    }
  });

  await Promise.all(workers);
  return out;
}
