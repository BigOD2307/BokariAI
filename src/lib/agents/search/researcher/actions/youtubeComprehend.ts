import z from 'zod';
import { ResearchAction } from '../../types';
import { Chunk, ReadingResearchBlock } from '@/lib/types';
import { extractVideoId, findVideoIdInText } from '@/lib/youtube/id';
import { fetchTranscript } from '@/lib/agents/media/transcript';
import { comprehendTranscript } from '@/lib/agents/media/comprehend';
import { embed } from '@/lib/ai/gateway';

const schema = z.object({
  urls: z
    .array(z.string())
    .describe(
      'YouTube video URLs (or 11-char video ids) whose transcript should be read and comprehended.',
    ),
  question: z
    .string()
    .optional()
    .describe('What to look for in the video (defaults to the user query).'),
});

const actionDescription = `
Use this tool to read and comprehend the transcript of a specific YouTube video the user referenced. It fetches the transcript (captions, or audio transcription as a fallback for Wolof/Bambara/Hausa), chunks it by time window, and returns the most relevant passages with deep-link citations (youtu.be/<id>?t=<seconds>).
ONLY call this when the user has explicitly provided or referenced a YouTube video URL/id and asks about its content (e.g. "summarize this video", "what does this YouTube talk say about X"). Never call it speculatively.
You can provide up to 2 video URLs at a time.
`;

const youtubeComprehendAction: ResearchAction<typeof schema> = {
  name: 'youtube_comprehend',
  schema: schema,
  getToolDescription: () =>
    'Read and comprehend the transcript of a specific YouTube video the user referenced. Returns the most relevant passages with timestamped deep-link citations. Only use when the user provided a YouTube URL/id and asks about its content.',
  getDescription: () => actionDescription,
  // Gated like scrapeURL — but only fires when the standalone query actually
  // contains a YouTube URL/id, mirroring scrapeURL's "only on explicit URL"
  // discipline. This keeps it off speculative calls.
  enabled: (config) =>
    config.classification.classification.skipSearch === false &&
    findVideoIdInText(config.classification.standaloneFollowUp) !== null,
  execute: async (params, additionalConfig) => {
    const urls = params.urls.slice(0, 2);
    const question =
      params.question ||
      additionalConfig.classification?.standaloneFollowUp ||
      '';
    const lang = 'fr';

    const researchBlock = additionalConfig.session.getBlock(
      additionalConfig.researchBlockId,
    );

    let readingBlockId = crypto.randomUUID();
    let readingEmitted = false;

    const results: Chunk[] = [];

    await Promise.all(
      urls.map(async (raw) => {
        const videoId = extractVideoId(raw) ?? findVideoIdInText(raw);
        if (!videoId) {
          results.push({
            content: `Could not extract a YouTube video id from "${raw}".`,
            metadata: { url: raw, title: `Invalid YouTube reference` },
          });
          return;
        }

        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const title = `YouTube ${videoId}`;

        if (
          !readingEmitted &&
          researchBlock &&
          researchBlock.type === 'research'
        ) {
          readingEmitted = true;
          researchBlock.data.subSteps.push({
            id: readingBlockId,
            type: 'reading',
            reading: [{ content: '', metadata: { url: videoUrl, title } }],
          });
          additionalConfig.session.updateBlock(
            additionalConfig.researchBlockId,
            [
              {
                op: 'replace',
                path: '/data/subSteps',
                value: researchBlock.data.subSteps,
              },
            ],
          );
        } else if (
          readingEmitted &&
          researchBlock &&
          researchBlock.type === 'research'
        ) {
          const subStepIndex = researchBlock.data.subSteps.findIndex(
            (step: any) => step.id === readingBlockId,
          );
          const subStep = researchBlock.data.subSteps[
            subStepIndex
          ] as ReadingResearchBlock;
          subStep.reading.push({
            content: '',
            metadata: { url: videoUrl, title },
          });
          additionalConfig.session.updateBlock(
            additionalConfig.researchBlockId,
            [
              {
                op: 'replace',
                path: '/data/subSteps',
                value: researchBlock.data.subSteps,
              },
            ],
          );
        }

        const transcript = await fetchTranscript(videoId, lang);
        if (
          transcript.source === 'unavailable' ||
          transcript.segments.length === 0
        ) {
          results.push({
            content: `No transcript could be retrieved for ${videoUrl}.`,
            metadata: { url: videoUrl, title },
          });
          return;
        }

        const comprehension = await comprehendTranscript(
          videoId,
          question,
          transcript.segments,
          embed,
        );

        // One chunk per relevant window, each carrying its deep-link citation
        // so the writer can cite youtu.be/<id>?t=<seconds>.
        for (const chunk of comprehension.chunks) {
          results.push({
            content: chunk.text,
            metadata: {
              url: chunk.citation,
              title: `${title} @ ${Math.floor(chunk.startTime)}s`,
              transcriptSource: transcript.source,
            },
          });
        }
      }),
    );

    return {
      type: 'search_results',
      results,
    };
  },
};

export default youtubeComprehendAction;
