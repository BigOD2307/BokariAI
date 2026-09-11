/**
 * POST /api/suggestions — follow-up suggestions for the last answer.
 *
 * Cost notes (C-optimisation): this runs on the resolved fast tier when one is
 * configured (an 8B-class model is plenty for suggesting follow-ups), through
 * the shared model cache — the old code built a fresh ModelRegistry per call,
 * which re-fetched the provider model list over the network every time. The
 * endpoint stays behind the global auth middleware like every other POST.
 */
import { requireUser, HttpError } from '@/lib/auth/require';
import { resolveModels } from '@/lib/ai/resolve';
import generateSuggestions from '@/lib/agents/suggestions';
import { ROLE_OPTIONS } from '@/lib/ai/roles';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    await requireUser(req);
  } catch (err) {
    return err instanceof HttpError
      ? err.toResponse()
      : Response.json({}, { status: 404 });
  }

  try {
    const body = (await req.json()) as { chatHistory?: [string, string][] };
    const history = Array.isArray(body.chatHistory)
      ? body.chatHistory.slice(-6)
      : [];
    if (history.length === 0) {
      return Response.json({ suggestions: [] }, { status: 200 });
    }

    const { llm, fastLlm } = await resolveModels();
    const suggestions = await generateSuggestions(
      {
        chatHistory: history.map(([role, content]) => ({
          role: role === 'human' ? 'user' : 'assistant',
          content,
        })),
      },
      // Suggestions are one-shot UI garnish — the cheap tier is exactly right.
      fastLlm ?? llm,
      ROLE_OPTIONS.title,
    );

    return Response.json({ suggestions }, { status: 200 });
  } catch (err) {
    console.error(`An error occurred while generating suggestions: ${err}`);
    return Response.json(
      { message: 'An error occurred while generating suggestions' },
      { status: 500 },
    );
  }
}
