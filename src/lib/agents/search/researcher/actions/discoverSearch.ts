/**
 * @module agents/search/researcher/actions/discoverSearch
 * @description Search Bokari's indexed Discover articles via BGE-M3
 * cosine similarity.  This is the citation engine: when the user
 * asks a question, the agent can call this tool to ground its
 * answer in our own corpus.
 *
 * Flow:
 *   1. Embed the user's queries via the AI gateway (BGE-M3).
 *   2. Pull the most recent embedded Discover articles from
 *      Supabase (default 500, last 30 days).
 *   3. Compute cosine in JS, drop below `minScore`, return top-K.
 *   4. Emit the hits as search results so the chat UI can render
 *      them as citations, and so the agent can read the snippets
 *      and quote from them in its answer.
 *
 * Design choices:
 *   - We do NOT call this action automatically — the agent decides
 *     when to cite.  This keeps the response quality high and the
 *     embedding cost low.
 *   - minScore defaults to 0.55 — just above the neutral 0.5 —
 *     so we never return garbage.  The agent can override.
 *   - We do NOT fail on empty results; we return [] so the agent
 *     can fall back to web_search.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */
import z from 'zod';
import { ResearchAction } from '../../types';
import { Chunk, SearchResultsResearchBlock } from '@/lib/types';
import { embed } from '@/lib/ai/gateway';
import { discoverCosineSearch, type DiscoverSearchHit } from '@/lib/discover/search';
import { getEmbeddedDiscoverCandidates } from '@/lib/supabase/queries/discover';

const actionSchema = z.object({
  queries: z
    .array(z.string())
    .min(1)
    .max(3)
    .describe(
      '1-3 search queries. We embed each independently and merge hits by max score, so use different angles (overview, specifics, synonyms).',
    ),
  topic: z
    .string()
    .optional()
    .describe(
      'Optional topic filter (e.g. "africa", "tech", "finance"). When set, we only search articles in that topic.',
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .describe('Max number of articles to return. Default 5.'),
  minScore: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('Minimum cos01 score [0..1] to include. Default 0.55.'),
});

const toolDescription =
  'Search Bokari\'s indexed Discover articles (African news, tech, finance, etc.) using BGE-M3 semantic similarity. Use this when the user asks about recent African news, technology, finance, or any topic we regularly index. Prefer this over web_search when the user wants up-to-date African context.';

const longDescription = `
Use this tool to search Bokari's own Discover corpus — articles that
Bokari has indexed, extracted, and embedded with BGE-M3.

This is the *citation engine*: results come with title, source,
published date, and a 280-char snippet, so you can quote them
directly and the UI will render them as clickable citations.

Provide 1-3 queries (one per call). Use different angles:
  - Overview: "bamako news 2026"
  - Specifics: "Mali president inauguration"
  - Synonyms/cross-lang: "Mali nouveau président"

Returns 0-5 hits (or whatever limit you set). When you find good
hits, cite the title and source in your answer — the user can click
through to read the full article.

If this tool is present and relevant to the user's question, you
SHOULD use it before falling back to web_search.  Our corpus is
focused on African news, tech, and finance — for those topics it
is faster, more relevant, and more current than the open web.
`;

function hitToChunk(hit: DiscoverSearchHit): Chunk {
  return {
    content: hit.snippet || hit.title,
    metadata: {
      title: hit.title,
      url: hit.url,
      // Custom keys (passed through to the UI as-is):
      source: 'bokari-discover',
      domain: hit.domain,
      publishedAt: hit.publishedAt?.toISOString() ?? null,
      author: hit.author ?? null,
      thumbnail: hit.thumbnail ?? null,
      language: hit.language,
      topic: hit.topic,
      score: hit.score,
      cosine: hit.cosine,
    },
  };
}

const discoverSearchAction: ResearchAction<typeof actionSchema> = {
  name: 'discover_search',
  schema: actionSchema,
  getToolDescription: () => toolDescription,
  getDescription: () => longDescription,
  // Always enabled for V1.  Phase 5 may add classifier-based gating
  // (e.g. only when the query is news / current-events).
  enabled: (config) => config.classification.classification.skipSearch === false,
  execute: async (input, additionalConfig) => {
    const queries = input.queries.slice(0, 3);
    const limit = input.limit ?? 5;
    const minScore = input.minScore ?? 0.55;
    const topic = input.topic;

    // 1. UI sub-step
    const researchBlock = additionalConfig.session.getBlock(
      additionalConfig.researchBlockId,
    );
    if (researchBlock && researchBlock.type === 'research') {
      researchBlock.data.subSteps.push({
        id: crypto.randomUUID(),
        type: 'searching',
        searching: queries,
      });
      additionalConfig.session.updateBlock(additionalConfig.researchBlockId, [
        {
          op: 'replace',
          path: '/data/subSteps',
          value: researchBlock.data.subSteps,
        },
      ]);
    }

    // 2. Embed the queries (BGE-M3 via gateway)
    let queryEmbeddings: number[][];
    try {
      queryEmbeddings = await embed(queries);
    } catch (err) {
      console.error('[discoverSearch] Embedding failed:', err);
      return { type: 'search_results', results: [] };
    }

    // 3. Fetch embedded candidates from Supabase
    const candidates = await getEmbeddedDiscoverCandidates({
      limit: 500,
      maxAgeDays: 30,
      topic,
    });

    if (candidates.length === 0) {
      console.warn('[discoverSearch] No embedded candidates found');
      return { type: 'search_results', results: [] };
    }

    // 4. Cosine search for each query, merge by hit id with max score
    const bestById = new Map<string, DiscoverSearchHit>();
    for (const qEmb of queryEmbeddings) {
      const hits = discoverCosineSearch(qEmb, candidates, { limit, minScore, topic });
      for (const hit of hits) {
        const existing = bestById.get(hit.id);
        if (!existing || hit.score > existing.score) {
          bestById.set(hit.id, hit);
        }
      }
    }

    // 5. Sort and slice
    const merged = Array.from(bestById.values()).sort((a, b) => b.score - a.score);
    const finalHits = merged.slice(0, limit);
    const results: Chunk[] = finalHits.map(hitToChunk);

    // 6. UI sub-step (search_results)
    if (researchBlock && researchBlock.type === 'research') {
      const subStep: SearchResultsResearchBlock = {
        id: crypto.randomUUID(),
        type: 'search_results',
        reading: results,
      };
      researchBlock.data.subSteps.push(subStep as any);
      additionalConfig.session.updateBlock(additionalConfig.researchBlockId, [
        {
          op: 'replace',
          path: '/data/subSteps',
          value: researchBlock.data.subSteps,
        },
      ]);
    }

    return {
      type: 'search_results',
      results,
    };
  },
};

export default discoverSearchAction;
