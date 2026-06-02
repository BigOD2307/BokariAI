/**
 * @module agents/search/async
 * @description Background variant of the search agent that writes
 * progress to a job store instead of a session.  Used by
 * `/api/research-async` for "deep research" tasks that may take
 * 30-60s — too slow for an SSE stream.
 *
 * Contract:
 *   - start with `runAsyncResearch(input, jobId)` — the caller has
 *     already created the job via `createJob`.
 *   - progress is reported through `setProgress` at each major
 *     step (init, search, reading, writing).
 *   - on success, `completeJob(jobId, { answer, sources })`.
 *   - on failure, `failJob(jobId, error.message)`.
 *
 * The output `answer` is the assembled text block from the writer
 * pass; `sources` is the de-duped list of search findings.  We do
 * NOT include widgets, suggestions, or research sub-steps — those
 * are SSE-only artifacts and don't make sense in a polling model.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */
import { classify } from './classifier';
import Researcher from './researcher';
import SessionManager from '@/lib/session';
import {
  SearchAgentInput,
  SearchSources,
} from './types';
import { Chunk } from '@/lib/types';
import { withTimeout } from '@/lib/utils/streamTimeout';
import {
  setProgress,
  completeJob,
  failJob,
} from '@/lib/jobs/research';

// Same writer budgets as the live search agent.
const LLM_FIRST_CHUNK_MS = 60_000;
const LLM_IDLE_MS = 30_000;
const LLM_TOTAL_MS = 5 * 60_000;

/** Cap on injected sources.  Mirrors the live search agent. */
const MAX_WRITER_RESULTS = 8;

export type AsyncResearchResult = {
  answer: string;
  sources: Array<{ title: string; url: string; snippet: string }>;
};

/**
 * Run a search job in the background.  Resolves when the job is
 * in a terminal state (completed or failed).  The actual mutation
 * is visible to the polling endpoint via `getJob(jobId)`.
 */
export async function runAsyncResearch(
  jobId: string,
  input: SearchAgentInput,
): Promise<void> {
  try {
    setProgress(jobId, {
      stage: 'classifier',
      percent: 5,
      message: 'Analyse de votre question…',
    });

    const classification = await classify({
      chatHistory: input.chatHistory,
      enabledSources: input.config.sources as SearchSources[],
      query: input.followUp,
      llm: input.config.llm,
    });

    if (classification.classification.skipSearch) {
      setProgress(jobId, {
        stage: 'writing',
        percent: 60,
        message: 'Génération de la réponse…',
      });
      const answer = await generateAnswer(
        jobId,
        input,
        classification.standaloneFollowUp || input.followUp,
        [],
      );
      completeJob(jobId, {
        answer,
        sources: [],
      });
      return;
    }

    setProgress(jobId, {
      stage: 'search',
      percent: 15,
      message: 'Recherche en cours…',
    });

    const session = SessionManager.createSession();
    const researcher = new Researcher();
    const searchResult = await researcher.research(session, {
      chatHistory: input.chatHistory,
      followUp: input.followUp,
      classification,
      config: input.config,
    });

    setProgress(jobId, {
      stage: 'reading',
      percent: 50,
      message: 'Lecture des sources…',
    });

    setProgress(jobId, {
      stage: 'writing',
      percent: 70,
      message: 'Rédaction de la réponse…',
    });
    const answer = await generateAnswer(
      jobId,
      input,
      classification.standaloneFollowUp || input.followUp,
      searchResult.searchFindings,
    );

    completeJob(jobId, {
      answer,
      sources: searchResult.searchFindings.slice(0, MAX_WRITER_RESULTS).map(toSourceSummary),
    });
  } catch (err) {
    failJob(
      jobId,
      err instanceof Error ? err.message : 'Unknown error during research',
    );
  }
}

function toSourceSummary(chunk: Chunk): {
  title: string;
  url: string;
  snippet: string;
} {
  return {
    title: (chunk.metadata?.['title'] as string) ?? 'Untitled',
    url: (chunk.metadata?.['url'] as string) ?? '',
    snippet: (chunk.content ?? '').slice(0, 280),
  };
}

/** Run the writer pass and assemble the final text answer. */
async function generateAnswer(
  jobId: string,
  input: SearchAgentInput,
  standaloneQuery: string,
  findings: Chunk[],
): Promise<string> {
  const finalContext = findings
    .slice(0, MAX_WRITER_RESULTS)
    .map(
      (f, i) =>
        `<result index=${i + 1} title=${f.metadata.title}>${f.content}</result>`,
    )
    .join('\n');

  const prompt = `You are Bokari, an expert research assistant.\n\n<search_results>\n${finalContext}\n</search_results>\n\nUser question: ${standaloneQuery}\n\nProvide a thorough, well-cited answer.`;

  const stream = withTimeout(
    input.config.llm.streamText({
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: input.followUp },
      ],
    }),
    {
      firstChunkMs: LLM_FIRST_CHUNK_MS,
      idleMs: LLM_IDLE_MS,
      totalMs: LLM_TOTAL_MS,
      label: 'async-research/writer',
    },
  );

  let buffer = '';
  let emittedFirst = false;
  for await (const chunk of stream) {
    if (!emittedFirst) {
      emittedFirst = true;
      setProgress(jobId, {
        stage: 'writing',
        percent: 85,
        message: 'Rédaction en cours…',
      });
    }
    buffer += chunk.contentChunk;
  }

  setProgress(jobId, {
    stage: 'finalizing',
    percent: 95,
    message: 'Finalisation…',
  });
  return buffer;
}

// Re-exported for tests.
export const _internal = { toSourceSummary };
