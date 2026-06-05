import { z } from 'zod';
import { ModelWithProvider } from '@/lib/models/types';
import { startTimer, logStage } from '@/lib/observability/latence';
import { buildChatStream, ChatStreamBody } from './stream';

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
  optimizationMode: z.enum(['speed', 'balanced', 'quality', 'learn'], {
    message: 'Optimization mode must be one of: speed, balanced, quality, learn',
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

const safeValidateBody = (data: unknown) => {
  const result = bodySchema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    };
  }
  return { success: true, data: result.data };
};

export const POST = async (req: Request) => {
  const tTotal = startTimer();
  try {
    const tParse = startTimer();
    const reqBody = (await req.json()) as { optimizationMode?: string };
    const parseBody = safeValidateBody(reqBody);
    if (!parseBody.success) {
      return Response.json(
        { message: 'Invalid request body', error: parseBody.error },
        { status: 400 },
      );
    }
    logStage('chat.parse', tParse(), { mode: reqBody.optimizationMode });

    const body = parseBody.data as ChatStreamBody;
    if (body.message.content === '') {
      return Response.json(
        { message: 'Please provide a message to process' },
        { status: 400 },
      );
    }

    const stream = buildChatStream(req, body, tTotal);
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (err) {
    console.error('An error occurred while processing chat request:', err);
    logStage('chat.total', tTotal(), { ok: false, threw: true });
    return Response.json(
      { message: 'An error occurred while processing chat request' },
      { status: 500 },
    );
  }
};
