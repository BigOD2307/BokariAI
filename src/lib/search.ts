/**
 * Bokari Search Module - Multi-engine parallel search
 * DDG Standard + DDG News in parallel for maximum coverage and speed
 * Optimized for Africa with source boosting and deduplication
 */

interface SearchResult {
  title: string;
  url: string;
  content?: string;
  img_src?: string;
  thumbnail_src?: string;
  thumbnail?: string;
  author?: string;
  iframe_src?: string;
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

// African news domains to boost in ranking
const AFRICAN_DOMAINS = new Set([
  'rfi.fr', 'france24.com', 'jeuneafrique.com', 'africanews.com',
  'allafrica.com', 'theafricareport.com', 'africanarguments.org',
  'maliactu.net', 'maliweb.net', 'bamada.net', 'journaldumali.com',
  'abamako.com', 'malijet.com',
  'seneweb.com', 'dakaractu.com', 'lequotidien.sn', 'pressafrik.com',
  'koaci.com', 'fratmat.info', 'abidjan.net', 'connectionivoirienne.net',
  'guineenews.org', 'guinee360.com', 'mosaiqueguinee.com',
  'burkina24.com', 'lefaso.net', 'lobs.bf',
  'nigerdiaspora.net', 'actuniger.com',
  'lnc-news.com', 'journalducameroun.com', 'camernews.com',
  'congopage.com', 'actualite.cd', 'radiookapi.net',
  'punchng.com', 'premiumtimesng.com', 'thenationonlineng.net', 'guardian.ng',
  'nation.africa', 'standardmedia.co.ke', 'monitor.co.ug',
  'reuters.com', 'bbc.com', 'lemonde.fr', 'apnews.com',
]);

/**
 * Score a search result for relevance (higher = better)
 * Boosts African news sources
 */
function scoreResult(result: SearchResult): number {
  let score = 0;
  try {
    const hostname = new URL(result.url).hostname.replace('www.', '');
    if (AFRICAN_DOMAINS.has(hostname)) score += 10;
    if (result.content && result.content.length > 100) score += 3;
    if (result.content && result.content.length > 200) score += 2;
    if (hostname.includes('facebook.com') || hostname.includes('twitter.com') || hostname.includes('tiktok.com')) score -= 5;
  } catch {
    // Invalid URL
  }
  return score;
}

/**
 * Deduplicate results by URL domain+path, keeping the best version
 */
function deduplicateResults(results: SearchResult[]): SearchResult[] {
  const seen = new Map<string, SearchResult>();

  for (const result of results) {
    try {
      const u = new URL(result.url);
      const key = u.hostname + u.pathname;
      const existing = seen.get(key);

      if (!existing) {
        seen.set(key, result);
      } else {
        if ((result.content?.length || 0) > (existing.content?.length || 0)) {
          seen.set(key, result);
        }
      }
    } catch {
      seen.set(result.url, result);
    }
  }

  return Array.from(seen.values());
}

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
      const title = match[2].replace(/<[^>]*>/g, '').trim();
      const snippet = match[3].replace(/<[^>]*>/g, '').trim();

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
 * DuckDuckGo News search via HTML lite endpoint
 * Adds recent news results to complement standard web search
 */
const searchDDGNews = async (
  query: string,
): Promise<SearchResult[]> => {
  try {
    // DDG news via the HTML lite interface with news parameters
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&iar=news&ia=news`;
    const response = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) return [];

    const html = await response.text();
    const results: SearchResult[] = [];

    // DDG news uses the same HTML structure as regular search
    const resultPattern =
      /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = resultPattern.exec(html)) !== null) {
      const rawUrl = match[1];
      const title = match[2].replace(/<[^>]*>/g, '').trim();
      const snippet = match[3].replace(/<[^>]*>/g, '').trim();

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
    console.warn('[Bokari Search] DDG News failed:', err);
    return [];
  }
};

/**
 * Brave Search as a third engine for extra coverage
 * Brave Search has a clean HTML interface that can be scraped
 */
const searchBrave = async (
  query: string,
  lang = 'fr',
): Promise<SearchResult[]> => {
  try {
    const url = `https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web&lang=${lang}`;
    const response = await fetch(url, {
      headers: {
        ...HEADERS,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) return [];

    const html = await response.text();
    const results: SearchResult[] = [];

    // Brave uses data attributes and specific class patterns
    // Match title links and snippets from Brave's HTML
    const snippetPattern = /<a[^>]+class="[^"]*heading[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<p[^>]+class="[^"]*snippet-description[^"]*"[^>]*>([\s\S]*?)<\/p>/gi;
    let match;
    while ((match = snippetPattern.exec(html)) !== null) {
      const resultUrl = match[1];
      const title = match[2].replace(/<[^>]*>/g, '').trim();
      const snippet = match[3].replace(/<[^>]*>/g, '').trim();

      if (resultUrl && title && !resultUrl.includes('brave.com')) {
        results.push({ title, url: resultUrl, content: snippet });
      }
    }

    return results;
  } catch (err) {
    console.warn('[Bokari Search] Brave failed:', err);
    return [];
  }
};

/**
 * Parallel multi-engine web search
 * Runs DDG Standard + DDG News + Brave simultaneously
 * Deduplicates and ranks with African source priority
 */
const searchParallel = async (
  query: string,
  lang = 'fr',
): Promise<{ results: SearchResult[]; suggestions: string[] }> => {
  // Run all engines in parallel for maximum speed
  const [ddgResults, ddgNewsResults, braveResults] = await Promise.all([
    searchDuckDuckGo(query),
    searchDDGNews(query),
    searchBrave(query, lang),
  ]);

  console.log(`[Bokari Search] DDG: ${ddgResults.length}, DDG News: ${ddgNewsResults.length}, Brave: ${braveResults.length}`);

  // Merge: DDG standard first, then news, then Brave extras
  const merged = [...ddgResults, ...ddgNewsResults, ...braveResults];

  // Deduplicate
  const unique = deduplicateResults(merged);

  // Score and sort: African sources first, then by content quality
  const scored = unique
    .map((r) => ({ result: r, score: scoreResult(r) }))
    .sort((a, b) => b.score - a.score)
    .map((s) => s.result);

  return { results: scored, suggestions: [] };
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

/**
 * Main search function - backward compatible interface
 * Uses parallel multi-engine search (DDG + DDG News + Brave)
 */
export const searchSearxng = async (
  query: string,
  opts?: SearchOptions,
): Promise<{ results: SearchResult[]; suggestions: string[] }> => {
  if (opts?.engines?.some((e) => e.toLowerCase().includes('image'))) {
    return searchImages(query);
  }

  if (opts?.engines?.some((e) => e.toLowerCase().includes('youtube'))) {
    return searchYouTube(query);
  }

  return searchParallel(query, opts?.language || 'fr');
};

/**
 * News search for Discover page
 */
export const searchNews = async (
  query: string,
  _language: string = 'fr',
): Promise<SearchResult[]> => {
  const { results } = await searchParallel(
    `${query} actualite ${new Date().getFullYear()}`,
  );
  return results;
};
