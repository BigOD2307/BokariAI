import z from 'zod';
import { ResearchAction } from '../../types';
import { searchSearxng } from '@/lib/search';
import { Chunk, SearchResultsResearchBlock } from '@/lib/types';
import { fetchMultipleContent } from '@/lib/utils/extractContent';
import { getStoredContentForUrls } from '@/lib/supabase/queries';

const actionSchema = z.object({
  type: z.literal('web_search'),
  queries: z
    .array(z.string())
    .describe('An array of search queries to perform web searches for.'),
});

const speedModePrompt = `
MANDATORY: You MUST call this tool. Do NOT skip it.
Search the web with up to 3 targeted keyword queries. You get ONE call — make it count.
Use SEO-friendly keywords, not sentences. Cover different angles with each query.
Example: "GPT-5.1 features", "GPT-5.1 release date", "GPT-5.1 vs GPT-4"
`;

const balancedModePrompt = `
MANDATORY: You MUST call this tool at least twice.
Search the web with up to 3 targeted keyword queries per call.
Round 1: Broad overview queries. Round 2: Specific details based on what you learned.
Use SEO-friendly keywords. Cover different angles each round.
`;

const qualityModePrompt = `
MANDATORY: You MUST call this tool at least 4-5 times for thorough research.
Search the web with up to 3 targeted keyword queries per call.
Each round should explore a different angle: overview, details, comparisons, news, opinions.
Use SEO-friendly keywords. Be thorough and exhaustive.
`;

const webSearchAction: ResearchAction<typeof actionSchema> = {
  name: 'web_search',
  schema: actionSchema,
  getToolDescription: () =>
    "Use this tool to perform web searches based on the provided queries. This is useful when you need to gather information from the web to answer the user's questions. You can provide up to 3 queries at a time. You will have to use this every single time if this is present and relevant.",
  getDescription: (config) => {
    let prompt = '';

    switch (config.mode) {
      case 'speed':
        prompt = speedModePrompt;
        break;
      case 'balanced':
        prompt = balancedModePrompt;
        break;
      case 'quality':
        prompt = qualityModePrompt;
        break;
      default:
        prompt = speedModePrompt;
        break;
    }

    return prompt;
  },
  enabled: (config) =>
    config.sources.includes('web') &&
    config.classification.classification.skipSearch === false,
  execute: async (input, additionalConfig) => {
    input.queries = input.queries.slice(0, 3);

    const researchBlock = additionalConfig.session.getBlock(
      additionalConfig.researchBlockId,
    );

    if (researchBlock && researchBlock.type === 'research') {
      researchBlock.data.subSteps.push({
        id: crypto.randomUUID(),
        type: 'searching',
        searching: input.queries,
      });

      additionalConfig.session.updateBlock(additionalConfig.researchBlockId, [
        {
          op: 'replace',
          path: '/data/subSteps',
          value: researchBlock.data.subSteps,
        },
      ]);
    }

    const searchResultsBlockId = crypto.randomUUID();
    let searchResultsEmitted = false;

    let results: Chunk[] = [];

    const search = async (q: string) => {
      const res = await searchSearxng(q);

      const resultChunks: Chunk[] = res.results.map((r) => ({
        content: r.content || r.title,
        metadata: {
          title: r.title,
          url: r.url,
        },
      }));

      results.push(...resultChunks);

      if (
        !searchResultsEmitted &&
        researchBlock &&
        researchBlock.type === 'research'
      ) {
        searchResultsEmitted = true;

        researchBlock.data.subSteps.push({
          id: searchResultsBlockId,
          type: 'search_results',
          reading: resultChunks,
        });

        additionalConfig.session.updateBlock(additionalConfig.researchBlockId, [
          {
            op: 'replace',
            path: '/data/subSteps',
            value: researchBlock.data.subSteps,
          },
        ]);
      } else if (
        searchResultsEmitted &&
        researchBlock &&
        researchBlock.type === 'research'
      ) {
        const subStepIndex = researchBlock.data.subSteps.findIndex(
          (step) => step.id === searchResultsBlockId,
        );

        const subStep = researchBlock.data.subSteps[
          subStepIndex
        ] as SearchResultsResearchBlock;

        subStep.reading.push(...resultChunks);

        additionalConfig.session.updateBlock(additionalConfig.researchBlockId, [
          {
            op: 'replace',
            path: '/data/subSteps',
            value: researchBlock.data.subSteps,
          },
        ]);
      }
    };

    await Promise.all(input.queries.map(search));

    // Content fetching based on mode:
    // speed = fetch top 2 URLs (fast but enriched)
    // balanced = fetch top 4 URLs
    // quality = fetch top 6 URLs
    const mode = additionalConfig.mode || 'speed';
    const maxFetch = mode === 'speed' ? 2 : mode === 'balanced' ? 4 : 6;

    if (maxFetch > 0) {
      const uniqueUrls = [...new Set(
        results.map((r) => r.metadata.url).filter(Boolean),
      )];

      if (uniqueUrls.length > 0) {
        // Show "reading" step in research UI
        if (researchBlock && researchBlock.type === 'research') {
          researchBlock.data.subSteps.push({
            id: crypto.randomUUID(),
            type: 'reading',
            reading: uniqueUrls.slice(0, maxFetch).map((url) => ({
              content: '',
              metadata: {
                url,
                title: results.find((r) => r.metadata.url === url)?.metadata.title || '',
              },
            })),
          });

          additionalConfig.session.updateBlock(additionalConfig.researchBlockId, [
            {
              op: 'replace',
              path: '/data/subSteps',
              value: researchBlock.data.subSteps,
            },
          ]);
        }

        // Phase 2: look up pre-extracted content from the Discover cache
        // first, only live-fetch URLs that miss.  Saves 2-6s of network on
        // every query that hits a known article.  If the cache lookup
        // itself blows up, we degrade to live fetch (slower but never
        // crash the agent).
        const urlsToRead = uniqueUrls.slice(0, maxFetch);
        let stored: Map<string, { fullContent: string | null }> = new Map();
        try {
          stored = await getStoredContentForUrls(urlsToRead);
        } catch (err) {
          console.error('[webSearch] Discover cache lookup failed; falling back to live fetch:', err);
        }

        // Use cached content where available, fall back to live fetch for misses
        const contentMap = new Map<string, string>();
        for (const url of urlsToRead) {
          const hit = stored.get(url);
          if (hit?.fullContent) {
            contentMap.set(url, hit.fullContent);
          }
        }
        const cacheMisses = urlsToRead.filter((u) => !contentMap.has(u));
        if (cacheMisses.length > 0) {
          const fetched = await fetchMultipleContent(cacheMisses, cacheMisses.length);
          for (const [url, content] of fetched) {
            contentMap.set(url, content);
          }
        }

        // Enrich results with full content
        for (const result of results) {
          const fullContent = contentMap.get(result.metadata.url);
          if (fullContent) {
            result.content = `${result.content}\n\n--- Full article content ---\n${fullContent}`;
          }
        }
      }
    }

    return {
      type: 'search_results',
      results,
    };
  },
};

export default webSearchAction;
