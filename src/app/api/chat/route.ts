import { z } from 'zod';
import { startTimer, logStage } from '@/lib/observability/latence';
import { buildChatStream, ChatStreamBody } from './stream';
import { chargeOrReject } from '@/lib/quota/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const messageSchema = z.object({
  messageId: z.string().min(1, 'Message ID is required'),
  chatId: z.string().min(1, 'Chat ID is required'),
  content: z.string().min(1, 'Message content is required'),
});

// NOTE: chatModel/embeddingModel are deliberately NOT accepted here anymore.
// The model is a server-side decision (BOKARI_CHAT_PROVIDER/MODEL, resolved
// by src/lib/ai/resolve.ts) — the browser used to pick it from localStorage,
// which is how a public deployment ended up paying for gpt-4o on every
// request (BUG-01). Any legacy client still sending those fields is fine:
// zod silently strips unrecognised keys by default.
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

    // Charge BEFORE any work happens: an unmetered LLM/search call is a bill,
    // a refused-but-uncharged one is just a 429. Guests are allowed here (no
    // requireAccount) — they're metered against a fingerprinted daily quota
    // instead of a user id.
    const charged = await chargeOrReject(req, { mode: body.optimizationMode });
    if (charged instanceof Response) return charged;

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
