import z from 'zod';
import { ResearchAction } from '../../types';
import { Chunk, SearchResultsResearchBlock } from '@/lib/types';
import { searchSearxng } from '@/lib/search';

const schema = z.object({
  queries: z.array(z.string()).describe('List of YouTube search queries'),
});

const youtubeSearchDescription = `
Use this tool to search YouTube for relevant videos, talks, tutorials, news clips, and explainers related to the user's query. Provide a list of concise search queries that will help gather comprehensive video information on the topic at hand.
You can provide up to 3 queries at a time. Make sure the queries are specific and relevant to the user's needs.

For example, if the user is interested in how mobile money works in West Africa, your queries could be:
1. "comment fonctionne le mobile money Afrique de l'Ouest"
2. "Wave Orange Money tutoriel"
3. "mobile money Sénégal explication"

If this tool is present and no other tools are more relevant, you MUST use this tool to get the needed video information.
`;

const youtubeSearchAction: ResearchAction<typeof schema> = {
  name: 'youtube_search',
  schema: schema,
  getDescription: () => youtubeSearchDescription,
  getToolDescription: () =>
    "Use this tool to search YouTube for relevant videos, talks, tutorials, and explainers related to the user's query. Provide a list of concise search queries that will help gather comprehensive video information on the topic at hand.",
  enabled: (config) =>
    config.sources.includes('youtube') &&
    config.classification.classification.skipSearch === false &&
    config.classification.classification.youtubeSearch === true,
  execute: async (input, additionalConfig) => {
    input.queries = input.queries.slice(0, 3);

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

    const search = async (q: string) => {
      const res = await searchSearxng(q, {
        engines: ['youtube'],
      });

      const resultChunks: Chunk[] = res.results.map((r) => ({
        content: r.content || r.title,
        metadata: {
          title: r.title,
          url: r.url,
          thumbnail: r.thumbnail,
          iframe_src: r.iframe_src,
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

    return {
      type: 'search_results',
      results,
    };
  },
};

export default youtubeSearchAction;
