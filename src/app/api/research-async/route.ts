import { z } from 'zod';
import ModelRegistry from '@/lib/models/registry';
import { ModelWithProvider } from '@/lib/models/types';
import { ChatTurnMessage } from '@/lib/types';
import { SearchSources } from '@/lib/agents/search/types';
import { createServerClient } from '@/lib/supabase/server';
import { MAX_HISTORY_ENTRIES, truncateHistory } from '@/lib/utils/chatHistory';
import { createJob, getJob } from '@/lib/jobs/research';
import { runAsyncResearch } from '@/lib/agents/search/async';
import { startTimer, logStage } from '@/lib/observability/latence';
import { recordTiming } from '@/lib/observability/ttfb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const messageSchema = z.object({
  messageId: z.string().min(1, 'Message ID is required'),
  chatId: z.string().min(1, 'Chat ID is required'),
  content: z.string().min(1, 'Message content is required'),
});

const chatModelSchema: z.ZodType<ModelWithProvider> = z.object({
  providerId: z.string({ message: 'Chat model provider id must be provided' }),
  key: z.string({ message: 'Chat model key must be provided' }),
});

const embeddingModelSchema: z.ZodType<ModelWithProvider> = z.object({
  providerId: z.string({
    message: 'Embedding model provider id must be provided',
  }),
  key: z.string({ message: 'Embedding model key must be provided' }),
});

const bodySchema = z.object({
  message: messageSchema,
  optimizationMode: z.enum(['speed', 'balanced', 'quality'], {
    message: 'Optimization mode must be one of: speed, balanced, quality',
  }),
  sources: z.array(z.string()).optional().default([]),
  history: z
    .array(z.tuple([z.string(), z.string()]))
    .optional()
    .default([]),
  files: z.array(z.string()).optional().default([]),
  chatModel: chatModelSchema,
  embeddingModel: embeddingModelSchema,
  systemInstructions: z.string().nullable().optional().default(''),
});

type Body = z.infer<typeof bodySchema>;

const safeValidateBody = (data: unknown) => {
  const result = bodySchema.safeParse(data);
  if (!result.success) {
    return {
      success: false as const,
      error: result.error.issues.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    };
  }
  return { success: true as const, data: result.data };
};

/**
 * POST  /api/research-async — start a background research job.
 *   Body: same shape as /api/chat
 *   Response: { jobId, status: 'pending' }
 *
 * GET   /api/research-async?jobId=… — poll a job.
 *   Response: { jobId, status, progress, result?, error? }
 *
 * The GET path does NOT require auth — the jobId is itself a
 * bearer secret (128 bits of entropy).  We could lock this down
 * later by tying the job to a user, but for now the polling
 * endpoint is intentionally open so the client can resume a
 * session that lost its cookies.
 */
export const POST = async (req: Request) => {
  const tTotal = startTimer();
  try {
    const tParse = startTimer();
    const reqBody = (await req.json()) as Body;
    const parseBody = safeValidateBody(reqBody);
    if (!parseBody.success) {
      return Response.json(
        { message: 'Invalid request body', error: parseBody.error },
        { status: 400 },
      );
    }
    logStage('research_async.parse', tParse(), {
      mode: (reqBody as { optimizationMode?: string }).optimizationMode,
    });

    const body = parseBody.data as Body;
    const { message } = body;

    if (message.content === '') {
      return Response.json(
        { message: 'Please provide a message to process' },
        { status: 400 },
      );
    }

    // Validate the requesting user, if any.  We don't reject
    // anonymous users — the jobId is the auth secret.
    let userId: string | undefined;
    try {
      const authClient = createServerClient(req);
      const {
        data: { user },
      } = await authClient.auth.getUser();
      userId = user?.id;
    } catch {
      userId = undefined;
    }

    const jobId = createJob({
      chatId: body.message.chatId,
      messageId: body.message.messageId,
      query: message.content,
      userId,
      mode: body.optimizationMode,
    });

    // Kick off the background work — model load + runAsyncResearch.
    // The jobId is returned immediately so the client can poll.
    void (async () => {
      try {
        const tLoad = startTimer();
        const registry = new ModelRegistry();
        const [llm, embedding] = await Promise.all([
          registry.loadChatModel(body.chatModel.providerId, body.chatModel.key),
          registry.loadEmbeddingModel(
            body.embeddingModel.providerId,
            body.embeddingModel.key,
          ),
        ]);
        logStage('research_async.load_models', tLoad());
        recordTiming('research_async.load_models', tLoad());

        const history: ChatTurnMessage[] = truncateHistory(
          body.history,
          MAX_HISTORY_ENTRIES,
        ).map((msg) =>
          msg[0] === 'human'
            ? { role: 'user', content: msg[1] }
            : { role: 'assistant', content: msg[1] },
        );

        await runAsyncResearch(jobId, {
          chatHistory: history,
          followUp: message.content,
          chatId: body.message.chatId,
          messageId: body.message.messageId,
          config: {
            llm,
            embedding,
            sources: body.sources as SearchSources[],
            mode: body.optimizationMode,
            fileIds: body.files,
            systemInstructions: body.systemInstructions || 'None',
          },
        });
      } catch (err) {
        console.error('[Bokari] async research background error:', err);
        const { failJob } = await import('@/lib/jobs/research');
        failJob(
          jobId,
          err instanceof Error ? err.message : 'Unknown error',
        );
      } finally {
        logStage('research_async.total', tTotal(), { jobId });
        recordTiming('research_async.total', tTotal());
      }
    })();

    return Response.json({ jobId, status: 'pending' }, { status: 202 });
  } catch (err) {
    console.error('An error occurred while creating research job:', err);
    logStage('research_async.total', tTotal(), { ok: false, threw: true });
    return Response.json(
      { message: 'An error occurred while creating research job' },
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
