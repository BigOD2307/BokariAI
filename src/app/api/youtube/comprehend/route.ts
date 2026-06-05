/**
 * @module api/youtube/comprehend
 * @description Optional async endpoint for the SLOW YouTube comprehension path
 * (audio STT in particular can take minutes), riding the existing in-memory
 * research-job store (`src/lib/jobs/research.ts`).
 *
 *   POST /api/youtube/comprehend
 *     Body: { videoUrl: string, question?: string, lang?: string }
 *     → 202 { jobId, status: 'pending' }   (the jobId is the bearer secret)
 *
 *   GET  /api/youtube/comprehend?jobId=…
 *     → 200 { jobId, status, progress, result?, error? }
 *
 * Like /api/research-async, GET is intentionally unauthenticated: the 128-bit
 * jobId is the secret. The transcript chain + comprehension run in the
 * background; the client polls.
 */
import { z } from 'zod';
import {
  createJob,
  getJob,
  setProgress,
  completeJob,
  failJob,
} from '@/lib/jobs/research';
import { extractVideoId, findVideoIdInText, citationLink } from '@/lib/youtube/id';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  videoUrl: z.string().min(1, 'videoUrl is required'),
  question: z.string().optional().default(''),
  lang: z.string().optional().default('fr'),
});

export const POST = async (req: Request) => {
  try {
    const raw = await req.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        {
          message: 'Invalid request body',
          error: parsed.error.issues.map((e) => e.message),
        },
        { status: 400 },
      );
    }
    const { videoUrl, question, lang } = parsed.data;
    const videoId = extractVideoId(videoUrl) ?? findVideoIdInText(videoUrl);
    if (!videoId) {
      return Response.json(
        { message: 'Could not extract a YouTube video id from videoUrl' },
        { status: 400 },
      );
    }

    const jobId = createJob({ videoId, question, lang });

    void (async () => {
      try {
        setProgress(jobId, { stage: 'transcript', percent: 20 });
        const { fetchTranscript } = await import('@/lib/agents/media/transcript');
        const transcript = await fetchTranscript(videoId, lang);
        if (
          transcript.source === 'unavailable' ||
          transcript.segments.length === 0
        ) {
          completeJob(jobId, {
            answer: `Aucune transcription disponible pour cette vidéo (${videoId}).`,
            sources: [],
          });
          return;
        }

        setProgress(jobId, { stage: 'comprehend', percent: 60 });
        const { comprehendTranscript } = await import(
          '@/lib/agents/media/comprehend'
        );
        const { embed } = await import('@/lib/ai/gateway');
        const comprehension = await comprehendTranscript(
          videoId,
          question || 'Résume cette vidéo.',
          transcript.segments,
          embed,
        );

        completeJob(jobId, {
          answer: comprehension.context,
          sources: comprehension.chunks.map((c) => ({
            title: `@ ${Math.floor(c.startTime)}s`,
            url: c.citation || citationLink(videoId, c.startTime),
            snippet: c.text.slice(0, 200),
          })),
        });
      } catch (err) {
        failJob(jobId, err instanceof Error ? err.message : 'Unknown error');
      }
    })();

    return Response.json({ jobId, status: 'pending' }, { status: 202 });
  } catch (err) {
    console.error('[Bokari] youtube comprehend job error:', err);
    return Response.json(
      { message: 'An error occurred while creating the comprehension job' },
      { status: 500 },
    );
  }
};

export const GET = async (req: Request) => {
  const url = new URL(req.url);
  const jobId = url.searchParams.get('jobId');
  if (!jobId) {
    return Response.json(
      { message: 'jobId query param is required' },
      { status: 400 },
    );
  }
  const job = getJob(jobId);
  if (!job) {
    return Response.json(
      { message: 'Job not found or expired' },
      { status: 404 },
    );
  }
  return Response.json(
    {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      result: job.result ?? null,
      error: job.error ?? null,
    },
    { status: 200 },
  );
};
