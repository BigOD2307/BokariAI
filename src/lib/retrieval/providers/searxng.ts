import type { SearchDocument, SearchProvider, SearchQueryOptions } from '../types';
import { canonicalizeUrl, domainOf } from '../url';
import { parsePublishedAt } from '../dates';
import { searchSearxng } from '@/lib/searxng';

/**
 * The SearXNG instance bundled in the Docker image (:8080), via the existing
 * local-only adapter (src/lib/searxng.ts). Free, but a scraper-of-scrapers:
 * quality varies with the hour and engines block it periodically, which is
 * why it never leads the news chain (src/lib/retrieval/index.ts).
 */
export class SearxngProvider implements SearchProvider {
  readonly name = 'searxng';

  isConfigured(): boolean {
    return Boolean(process.env.SEARXNG_API_URL);
  }

  async search(query: string, opts: SearchQueryOptions): Promise<SearchDocument[]> {
    const time_range =
      opts.maxAgeDays && opts.maxAgeDays <= 1
        ? 'day'
        : opts.maxAgeDays && opts.maxAgeDays <= 7
          ? 'week'
          : opts.maxAgeDays && opts.maxAgeDays <= 31
            ? 'month'
            : undefined;

    const { results } = await searchSearxng(query, {
      language: opts.language,
      categories: opts.intent === 'news' ? ['news'] : undefined,
      time_range,
    });

    return results.slice(0, opts.limit).flatMap((r, index) => {
      if (!r.url || !r.title) return [];
      const canonicalUrl = canonicalizeUrl(r.url);
      if (!canonicalUrl) return [];
      return [
        {
          url: r.url,
          canonicalUrl,
          title: r.title.trim(),
          snippet: (r.content ?? '').trim(),
          domain: domainOf(r.url),
          publishedAt: parsePublishedAt((r as { publishedDate?: string }).publishedDate),
          provider: this.name,
          rank: index + 1,
        },
      ];
    });
  }
}
