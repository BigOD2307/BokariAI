import { getSearxngURL } from './config/serverRegistry';

interface SearxngSearchOptions {
  categories?: string[];
  engines?: string[];
  language?: string;
  pageno?: number;
  time_range?: 'day' | 'week' | 'month' | 'year';
}

interface SearxngSearchResult {
  title: string;
  url: string;
  img_src?: string;
  thumbnail_src?: string;
  thumbnail?: string;
  content?: string;
  author?: string;
  iframe_src?: string;
  /** SearXNG's JSON API returns this for many engines (Google News, Bing News…). */
  publishedDate?: string;
}

const tryFetchSearxng = async (
  baseURL: string,
  query: string,
  opts?: SearxngSearchOptions,
  timeoutMs = 8000,
): Promise<{ results: SearxngSearchResult[]; suggestions: string[] } | null> => {
  try {
    const url = new URL(`${baseURL}/search?format=json`);
    url.searchParams.append('q', query);

    if (opts) {
      Object.keys(opts).forEach((key) => {
        const value = opts[key as keyof SearxngSearchOptions];
        if (Array.isArray(value)) {
          url.searchParams.append(key, value.join(','));
          return;
        }
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Bokari/1.0 (AI Journalist Platform)',
        'Accept': 'application/json',
      },
    });

    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    const results: SearxngSearchResult[] = data.results || [];
    const suggestions: string[] = data.suggestions || [];

    return { results, suggestions };
  } catch {
    return null;
  }
};

/**
 * Local SearXNG only. A prior version fell back to six public third-party
 * instances when the local one failed — that sends every user question to
 * servers Bokari does not control, unacceptable for a product whose pitch is
 * trust. Local unavailable now simply means "no SearXNG results"; callers
 * (src/lib/retrieval/) treat that as a miss and continue their own chain.
 */
export const searchSearxng = async (
  query: string,
  opts?: SearxngSearchOptions,
) => {
  // The configured URL AND the bundled SEARXNG_API_URL env (the Docker image
  // runs SearXNG on :8080). We try both because the persisted config can hold
  // a stale dev URL (e.g. :4000) — the env is the deployment's source of truth.
  const localCandidates = Array.from(
    new Set([getSearxngURL(), process.env.SEARXNG_API_URL].filter(Boolean) as string[]),
  );
  for (const url of localCandidates) {
    // Generous timeout: a bundled SearXNG can take several seconds when slow
    // engines time out before the fast ones (Google/Bing) answer.
    const result = await tryFetchSearxng(url, query, opts, 12000);
    if (result && result.results.length > 0) {
      return result;
    }
  }

  console.warn('[Bokari Search] Local SearXNG unavailable or empty for query:', query);
  return { results: [], suggestions: [] };
};
