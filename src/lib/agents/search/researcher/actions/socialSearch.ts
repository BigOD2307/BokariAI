import z from 'zod';
import { ResearchAction, SearchSources } from '../../types';
import { Chunk, SearchResultsResearchBlock } from '@/lib/types';
import { searchSearxng } from '@/lib/search';
import type { SocialNetwork } from '@/lib/social/types';

/**
 * The social networks this action fans out to, derived from both the enabled
 * `sources` (the source-selector toggles) and the classifier's per-network
 * booleans. A network runs only when it is both selected AND classified
 * relevant — except the legacy `discussions` source, which keeps mapping to
 * Reddit so existing behaviour is preserved when no granular network is on.
 */
const resolveNetworks = (config: {
  classification: { classification: Record<string, boolean> };
  sources: SearchSources[];
}): SocialNetwork[] => {
  const cls = config.classification.classification;
  const nets = new Set<SocialNetwork>();
  if (config.sources.includes('x') && cls.xSearch) nets.add('x');
  if (config.sources.includes('reddit') && cls.redditSearch) nets.add('reddit');
  if (config.sources.includes('linkedin') && cls.linkedinSearch)
    nets.add('linkedin');
  // Legacy "Social" toggle → Reddit (the historical behaviour of this action).
  if (config.sources.includes('discussions') && cls.discussionSearch)
    nets.add('reddit');
  return [...nets];
};

const schema = z.object({
  queries: z.array(z.string()).describe('List of social search queries'),
});

const socialSearchDescription = `
Use this tool to perform social media searches for relevant posts, discussions, and trends related to the user's query. Provide a list of concise search queries that will help gather comprehensive social media information on the topic at hand.
You can provide up to 3 queries at a time. Make sure the queries are specific and relevant to the user's needs.

For example, if the user is interested in public opinion on electric vehicles, your queries could be:
1. "Electric vehicles public opinion 2024"
2. "Social media discussions on EV adoption"
3. "Trends in electric vehicle usage"

If this tool is present and no other tools are more relevant, you MUST use this tool to get the needed social media information.
`;

const socialSearchAction: ResearchAction<typeof schema> = {
  name: 'social_search',
  schema: schema,
  getDescription: () => socialSearchDescription,
  getToolDescription: () =>
    "Use this tool to perform social media searches for relevant posts, discussions, and trends related to the user's query. Provide a list of concise search queries that will help gather comprehensive social media information on the topic at hand.",
  enabled: (config) =>
    config.classification.classification.skipSearch === false &&
    resolveNetworks(config).length > 0,
  execute: async (input, additionalConfig) => {
    input.queries = input.queries.slice(0, 3);

    // Resolve which networks to fan out to from the enabled sources +
    // classifier booleans threaded through additionalConfig. Default to Reddit
    // (the historical behaviour) when that context is absent.
    const networks =
      additionalConfig.classification && additionalConfig.sources
        ? resolveNetworks({
            classification: additionalConfig.classification,
            sources: additionalConfig.sources,
          })
        : (['reddit'] as SocialNetwork[]);
    const activeNetworks: SocialNetwork[] =
      networks.length > 0 ? networks : ['reddit'];

    // Cap fan-out (networks x queries) to respect the agent timeouts. Mirrors
    // the MAX_WRITER_RESULTS discipline — keep total social calls bounded.
    const MAX_SOCIAL_CALLS = 9;

    const researchBlock = additionalConfig.session.getBlock(
      additionalConfig.researchBlockId,
    );

    if (researchBlock && researchBlock.type === 'research') {
      researchBlock.data.subSteps.push({
        type: 'searching',
        id: crypto.randomUUID(),
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

    const search = async ({ network, q }: { network: SocialNetwork; q: string }) => {
      const res = await searchSearxng(q, {
        engines: [network],
      });

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

    // Build the (network x query) fan-out, capped to MAX_SOCIAL_CALLS.
    const jobs: { network: SocialNetwork; q: string }[] = [];
    for (const network of activeNetworks) {
      for (const q of input.queries) {
        jobs.push({ network, q });
      }
    }

    await Promise.all(jobs.slice(0, MAX_SOCIAL_CALLS).map(search));

    return {
      type: 'search_results',
      results,
    };
  },
};

export default socialSearchAction;
