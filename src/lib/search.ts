/**
 * Bokari Search Module
 *
 * Plain web/news/academic search is now delegated to src/lib/retrieval/
 * (SearXNG + TinyFish + Serper, with real dates and no scraper — see BUG-02,
 * BUG-22, BUG-23, BUG-27). This file still owns the `engines` string-routing
 * convention for images, YouTube and social (dispatched below), plus the raw
 * DuckDuckGo scraper those two still use — it will keep shrinking as those
 * move to real providers too.
 */
import { searchWeb, type SearchIntent } from './retrieval';

interface SearchResult {
  title: string;
  url: string;
  content?: string;
  img_src?: string;
  thumbnail_src?: string;
  thumbnail?: string;
  author?: string;
  iframe_src?: string;
  /** ISO string, when the provider returned a real per-result date (C4). */
  publishedAt?: string;
}

export type { SearchResult };

interface SearchOptions {
  categories?: string[];
  engines?: string[];
  language?: string;
  pageno?: number;
  maxResults?: number;
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
};

/**
 * DuckDuckGo HTML search (~1-2s)
 * Reliable server-side scraping via html.duckduckgo.com
 */
const searchDuckDuckGo = async (
  query: string,
): Promise<SearchResult[]> => {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) return [];

    const html = await response.text();
    const results: SearchResult[] = [];

    const resultPattern =
      /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = resultPattern.exec(html)) !== null) {
      const rawUrl = match[1];
      const title = decodeEntities(match[2].replace(/<[^>]*>/g, '').trim());
      const snippet = decodeEntities(match[3].replace(/<[^>]*>/g, '').trim());

      let actualUrl = rawUrl;
      const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
      if (uddgMatch) {
        actualUrl = decodeURIComponent(uddgMatch[1]);
      }

      if (actualUrl && title && !actualUrl.includes('duckduckgo.com')) {
        results.push({ title, url: actualUrl, content: snippet });
      }
    }

    return results;
  } catch (err) {
    console.warn('[Bokari Search] DDG failed:', err);
    return [];
  }
};

/**
 * Decode HTML entities left in scraped text. DDG/Brave strip tags but keep
 * entities (&#39; &eacute; &amp; &laquo; …); React renders runtime strings
 * literally, so undecoded entities show up verbatim — very visible in French.
 * Decoding is idempotent and safe on already-clean text.
 */
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë',
  agrave: 'à', acirc: 'â', auml: 'ä', aelig: 'æ',
  igrave: 'ì', icirc: 'î', iuml: 'ï',
  ograve: 'ò', ocirc: 'ô', ouml: 'ö', oelig: 'œ',
  ugrave: 'ù', ucirc: 'û', uuml: 'ü',
  ccedil: 'ç', ntilde: 'ñ', szlig: 'ß',
  laquo: '«', raquo: '»', hellip: '…', middot: '·', bull: '•',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
  ndash: '–', mdash: '—', deg: '°', euro: '€',
  copy: '©', reg: '®', trade: '™',
};

const safeCodePoint = (n: number): string => {
  try {
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
  } catch {
    return '';
  }
};

/** Decode numeric (&#39; / &#x27;) and common named HTML entities. */
export const decodeEntities = (s: string): string => {
  if (!s || s.indexOf('&') === -1) return s;
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => safeCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeCodePoint(parseInt(d, 10)))
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, name) => {
      const dec = NAMED_ENTITIES[name.toLowerCase()];
      return dec !== undefined ? dec : m;
    });
};

/**
 * Image search via DuckDuckGo JSON API
 */
const searchImages = async (
  query: string,
): Promise<{ results: SearchResult[]; suggestions: string[] }> => {
  try {
    const tokenRes = await fetch(
      `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`,
      { headers: HEADERS, signal: AbortSignal.timeout(6000) },
    );
    const tokenHtml = await tokenRes.text();
    const vqd = tokenHtml.match(/vqd=["']?([^"'&]+)/)?.[1];

    if (!vqd) return { results: [], suggestions: [] };

    const imgRes = await fetch(
      `https://duckduckgo.com/i.js?l=fr-fr&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,,,&p=1`,
      { headers: { ...HEADERS, Accept: 'application/json' }, signal: AbortSignal.timeout(6000) },
    );
    const imgData = await imgRes.json();

    const results: SearchResult[] = (imgData.results || [])
      .slice(0, 10)
      .map((r: any) => ({
        title: r.title || '',
        url: r.url || r.source || '',
        img_src: r.image || r.thumbnail || '',
        thumbnail: r.thumbnail || r.image || '',
      }))
      .filter((r: SearchResult) => r.img_src);

    return { results, suggestions: [] };
  } catch (err) {
    console.warn('[Bokari Search] Image search failed:', err);
    return { results: [], suggestions: [] };
  }
};

/**
 * YouTube search via DuckDuckGo
 */
const searchYouTube = async (
  query: string,
): Promise<{ results: SearchResult[]; suggestions: string[] }> => {
  const results = await searchDuckDuckGo(`site:youtube.com ${query}`);

  return {
    results: results
      .filter((r) => r.url.includes('youtube.com/watch'))
      .map((r) => {
        const videoId = r.url.match(/[?&]v=([^&]+)/)?.[1] || '';
        return {
          ...r,
          thumbnail: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '',
          img_src: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '',
          iframe_src: videoId ? `https://www.youtube.com/embed/${videoId}` : '',
        };
      }),
    suggestions: [],
  };
};

/** Social network engine names recognised by the `engines` convention. */
const SOCIAL_ENGINES = new Set(['x', 'reddit', 'linkedin']);
/** Legacy `engines` values academicSearch.ts already sends — none of these
 *  are real engines, they're the "this is an academic query" signal
 *  (BUG-27: the old dispatcher silently ignored them and ran a web search). */
const ACADEMIC_ENGINES = new Set(['arxiv', 'google scholar', 'pubmed']);

function intentFromEngines(engines: string[] | undefined): SearchIntent {
  const lower = (engines ?? []).map((e) => e.toLowerCase());
  if (lower.some((e) => ACADEMIC_ENGINES.has(e))) return 'academic';
  if (lower.includes('news')) return 'news';
  return 'general';
}

function toLegacyResults(
  documents: import('./retrieval').SearchDocument[],
): { results: SearchResult[]; suggestions: string[] } {
  return {
    results: documents.map((d) => ({
      title: d.title,
      url: d.url,
      content: d.snippet,
      publishedAt: d.publishedAt?.toISOString(),
    })),
    suggestions: [],
  };
}

export const searchSearxng = async (
  query: string,
  opts?: SearchOptions,
): Promise<{ results: SearchResult[]; suggestions: string[] }> => {
  if (opts?.engines?.some((e) => e.toLowerCase().includes('image'))) {
    return searchImages(query);
  }

  // Internal raw-scrape engine: the YouTube provider's `scrape` adapter routes
  // here to use the DDG site:youtube.com path WITHOUT re-entering the provider
  // (which would recurse). Public callers use `youtube`.
  if (opts?.engines?.some((e) => e.toLowerCase() === 'youtube_scrape')) {
    return searchYouTube(query);
  }

  // Public YouTube engine: route through the cached, env-selected provider
  // (API / Bright Data / scrape) with graceful fallback. Dynamic import breaks
  // the module cycle (the scrape adapter imports searchSearxng from here).
  if (opts?.engines?.some((e) => e.toLowerCase().includes('youtube'))) {
    const { cachedYouTubeSearch } = await import('@/lib/youtube/cache');
    return cachedYouTubeSearch(query, {
      language: opts?.language || 'fr',
      maxResults: opts?.maxResults,
    });
  }

  // Social dispatch: engines:['x'|'reddit'|'linkedin'] route to the social
  // provider router (Bright Data or site-operator fallback). Dynamic import
  // breaks the module cycle (the site adapter imports searchSearxng from here).
  const socialEngine = opts?.engines?.find((e) =>
    SOCIAL_ENGINES.has(e.toLowerCase()),
  );
  if (socialEngine) {
    const { cachedSocialSearch } = await import('@/lib/social/cache');
    return cachedSocialSearch(socialEngine.toLowerCase() as 'x' | 'reddit' | 'linkedin', query, {
      language: opts?.language || 'fr',
      maxResults: opts?.maxResults,
    });
  }

  // Plain web / news / academic: SearXNG + TinyFish + Serper, chained and
  // fused by intent (src/lib/retrieval/) — no more direct DuckDuckGo/Brave
  // scraping, which datacenter IPs get rate-limited/blocked on (BUG-02).
  const intent = intentFromEngines(opts?.engines);
  const outcome = await searchWeb(query, {
    intent,
    language: opts?.language || 'fr',
    maxAgeDays: intent === 'news' ? 30 : undefined,
    limit: opts?.maxResults ?? 12,
  });
  return toLegacyResults(outcome.documents);
};

/**
 * News search for the Discover feed AND the autonomous article generator.
 * Delegates to the same provider chain as the chat's news intent
 * (Serper → TinyFish → SearXNG, src/lib/retrieval/) instead of its own
 * hand-rolled SearXNG-then-scraper fallback.
 */
export const searchNews = async (
  query: string,
  language: string = 'fr',
): Promise<SearchResult[]> => {
  const q = `${query} actualite ${new Date().getFullYear()}`;
  const outcome = await searchWeb(q, { intent: 'news', language, maxAgeDays: 30, limit: 12 });
  return toLegacyResults(outcome.documents).results;
};
