/**
 * @module agents/search/researcher/actions/newsSearch
 * @description Search Bokari's own African news corpus (C9) — the outlets we
 * ingest directly via RSS (Lefaso, Studio Tamani, Actualite.cd, AIP…), read
 * BEFORE the search engines index them.
 *
 * Flow:
 *   1. `searchNews` runs the hybrid rank inside Postgres (full-text + pgvector
 *      cosine + freshness decay + tier lift) — see src/lib/news/search.ts.
 *   2. Hits are emitted as search results with ISO publishedAt so selectEvidence
 *      (C6) freshness-scoring and the [S1]/[S2] citation contract (C7) treat
 *      them exactly like web results.
 *   3. The full stored body is already in the row, so the hit content is the
 *      article's own extracted text — no extra page fetch, no extra latency.
 *
 * Design choices:
 *   - Enabled whenever the web is (the corpus is a news-first overlay of the
 *     web, not a separate "source" the user must think about), but the agent
 *     is told to prefer it for current-events questions.
 *   - Never throws: an empty corpus or a DB hiccup returns [] so the agent
 *     falls back to web_search.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */
import z from 'zod';
import { ResearchAction } from '../../types';
import { Chunk } from '@/lib/types';
import { searchNews, type NewsHit } from '@/lib/news/search';

const actionSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      'The search query, in the user’s language (French for most African users).',
    ),
  countries: z
    .array(z.string().length(2))
    .optional()
    .describe(
      'ISO country codes to prioritize outlets from (e.g. ["ML"] for Mali, ["SN","CI"]). Omit for all of Africa.',
    ),
});

const newsSearchAction: ResearchAction<typeof actionSchema> = {
  name: 'news_corpus_search',
  schema: actionSchema,
  getToolDescription: () =>
    "Search Bokari's own corpus of African news articles (Mali, Senegal, Côte d'Ivoire, Burkina Faso, RDC, and pan-African outlets), ingested directly from the newsrooms' feeds. This is the FIRST choice for any current-events question about Africa or francophone Africa: the articles are full-text, dated, and often indexed here hours before search engines see them. Every hit carries its real publication date and source label.",
  getDescription: () =>
    `Search the African news corpus first for questions about recent events in Africa (politics, security, economy, society, sports). One call takes one query and returns full-text excerpts with publication dates and editorial labels (agency / certified / state media / aggregator). Use it before web_search for African current events; fall back to web_search when it returns nothing relevant.`,
  enabled: (config) =>
    config.sources.includes('web') &&
    config.classification.classification.skipSearch === false,
  execute: async (input, additionalConfig) => {
    const researchBlock = additionalConfig.session.getBlock(
      additionalConfig.researchBlockId,
    );

    let hits: NewsHit[] = [];
    try {
      hits = await searchNews(input.query, {
        limit: 8,
        countries: input.countries,
      });
    } catch (err) {
      console.warn(
        '[newsSearch] corpus search failed, agent falls back to web:',
        err,
      );
    }

    const results: Chunk[] = hits.map((h) => ({
      content: h.body || h.title,
      metadata: {
        title: h.title,
        url: h.url,
        publishedAt: h.publishedAt.toISOString(),
        // Editorial provenance, surfaced to the reader in the sources panel.
        sourceName: h.sourceName,
        sourceTier: h.tier,
        sourceStateMedia: h.isStateMedia,
        sourceCertified: h.isCertified,
        sourceSuspendedIn: h.suspendedIn,
        fromCorpus: true,
      },
    }));

    if (
      researchBlock &&
      researchBlock.type === 'research' &&
      results.length > 0
    ) {
      researchBlock.data.subSteps.push({
        id: crypto.randomUUID(),
        type: 'search_results',
        reading: results,
      });
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

export default newsSearchAction;
