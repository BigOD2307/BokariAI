import { ResearcherOutput, SearchAgentInput } from './types';
import SessionManager from '@/lib/session';
import { classify, defaultClassification } from './classifier';
import Researcher from './researcher';
import { getWriterPrompt } from '@/lib/prompts/search/writer';
import { WidgetExecutor } from './widgets';
import supabase from '@/lib/db';
import { TextBlock, Chunk } from '@/lib/types';
import { withTimeout } from '@/lib/utils/streamTimeout';
import {
  looksLikeChartRequest,
  extractChartSpec,
} from '@/lib/agents/multimodal/charts';
import { pickWriterLlm } from './routing';
import { ROLE_OPTIONS } from '@/lib/ai/roles';
import { streamTextWithFallback } from '@/lib/ai/gateway';
import { selectEvidence, DEFAULT_BUDGET } from '@/lib/retrieval/select';
import { buildEvidence, toChunk } from './evidence';
import { auditCitations } from './citations';
import { checkFaithfulness, isFaithfulnessEnabled } from './faithfulness';
import {
  isRichBlocksEnabled,
  looksLikeComparisonRequest,
  looksLikeEntityRequest,
  looksLikeVerdictRequest,
  extractComparisonTable,
  extractEntityCard,
  extractVerdict,
} from './richBlocks';
import type { RichBlock } from '@/lib/types/multimodal';
import { runLearnBundle } from '@/lib/agents/learn/runLearnBundle';

/** Per-call LLM stream budgets.  These are the caps that prevent a
 *  stalled upstream (Groq / OpenRouter / Ollama) from pinning a
 *  Bokari request forever.  See `src/lib/utils/streamTimeout.ts`. */
const LLM_FIRST_CHUNK_MS = 60_000;
const LLM_IDLE_MS = 30_000;
const LLM_TOTAL_MS = 5 * 60_000;

/**
 * Fetch conversation memory for the current user.
 * Returns recent chat topics to give Bokari context about past interactions.
 *
 * Takes the CALLER's userId (already verified by the auth middleware), never a
 * chatId — resolving the owner from a client-supplied chatId let one user's
 * memory leak into another user's prompt (BUG-15).
 */
async function fetchMemory(
  userId: string | null,
  excludeChatId: string,
): Promise<string> {
  if (!userId) return '';

  try {
    const { data: recentChats } = await supabase
      .from('chats')
      .select('id, title, created_at')
      .eq('user_id', userId)
      .neq('id', excludeChatId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!recentChats || recentChats.length === 0) return '';

    const chatIds = recentChats.map((c: any) => c.id);
    const { data: firstMessages } = await supabase
      .from('messages')
      .select('chat_id, query')
      .in('chat_id', chatIds)
      .order('created_at', { ascending: true });

    const seenChats = new Set<string>();
    const memories: string[] = [];

    for (const c of recentChats as any[]) {
      if (seenChats.has(c.id)) continue;
      seenChats.add(c.id);

      const firstMsg = firstMessages?.find((m: any) => m.chat_id === c.id);
      const topic = c.title || firstMsg?.query || '';
      if (topic) memories.push(`- ${topic}`);
    }

    if (memories.length === 0) return '';

    return `Sujets recemment recherches par cet utilisateur :\n${memories.join('\n')}`;
  } catch (err) {
    console.warn('[Bokari] Memory fetch failed:', err);
    return '';
  }
}

class SearchAgent {
  async searchAsync(session: SessionManager, input: SearchAgentInput) {
    let exists: any = null;
    try {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', input.chatId)
        .eq('message_id', input.messageId)
        .maybeSingle();
      exists = data;
    } catch (dbErr) {
      console.error('[Bokari] DB error on findFirst:', dbErr);
    }

    // Sprint 3 C4: emit 'analyzing' events at every major step so
    // the client can update its spinner message within a tick of
    // each transition.  Without these, the user sees a blank
    // spinner for 200-800ms before the first event.
    session.emit('analyzing', {
      step: 'init',
      message: 'Préparation de la recherche…',
    });

    try {
      if (!exists) {
        await supabase.from('messages').insert({
          chat_id: input.chatId,
          message_id: input.messageId,
          backend_id: session.id,
          query: input.followUp,
          created_at: new Date().toISOString(),
          status: 'answering',
          response_blocks: [],
        });
      } else {
        await supabase
          .from('messages')
          .delete()
          .eq('chat_id', input.chatId)
          .gt('id', exists.id);
        await supabase
          .from('messages')
          .update({
            status: 'answering',
            backend_id: session.id,
            response_blocks: [],
          })
          .eq('chat_id', input.chatId)
          .eq('message_id', input.messageId);
      }
    } catch (dbErr) {
      console.error('[Bokari] DB error on message insert/update:', dbErr);
    }

    session.emit('analyzing', {
      step: 'classifier',
      message: 'Analyse de votre question…',
    });
    // Classification is a cheap structured call — run it on the fast tier when
    // configured (the 8B handles label assignment + complexity scoring fine).
    let classification;
    try {
      classification = await classify({
        chatHistory: input.chatHistory,
        enabledSources: input.config.sources,
        query: input.followUp,
        llm: input.config.fastLlm ?? input.config.llm,
      });
    } catch (err) {
      // A classifier failure must not kill the request: default to "search the
      // web, treat it as complex" and let the researcher do its job.
      console.warn('[Bokari] classifier failed, using defaults', {
        error: (err as Error)?.message,
      });
      classification = defaultClassification(input.followUp);
    }

    session.emit('analyzing', {
      step: 'widgets',
      message: 'Chargement des widgets…',
    });
    const widgetPromise = WidgetExecutor.executeAll({
      classification,
      chatHistory: input.chatHistory,
      followUp: input.followUp,
      llm: input.config.llm,
    }).then((widgetOutputs) => {
      widgetOutputs.forEach((o) => {
        session.emitBlock({
          id: crypto.randomUUID(),
          type: 'widget',
          data: { widgetType: o.type, params: o.data },
        });
      });
      return widgetOutputs;
    });

    let searchPromise: Promise<ResearcherOutput> | null = null;

    if (!classification.classification.skipSearch) {
      session.emit('analyzing', {
        step: 'search',
        message: 'Recherche en cours…',
      });
      const researcher = new Researcher();
      searchPromise = researcher.research(session, {
        chatHistory: input.chatHistory,
        followUp: input.followUp,
        classification,
        config: input.config,
      });
    }

    const memoryPromise = fetchMemory(input.userId ?? null, input.chatId);

    session.emit('analyzing', {
      step: 'reading',
      message: 'Lecture des sources…',
    });

    const [widgetOutputs, searchResults, memory] = await Promise.all([
      widgetPromise,
      searchPromise,
      memoryPromise,
    ]);

    session.emit('data', { type: 'researchComplete' });

    // Best-by-relevance evidence, computed ONCE and reused by every consumer
    // below (Learn, chart, rich blocks, writer, faithfulness) — replaces the
    // old `.slice(0, 8)` on searchFindings IN ARRIVAL ORDER (BUG-19): the
    // first 8 results of the fastest first-turn query, not the 8 best. Deep
    // research (35 iterations) used to spend 35x the budget producing
    // context the writer never read, because later turns land past index 8.
    const evidence = await selectEvidence(
      searchResults?.searchFindings ?? [],
      classification.standaloneFollowUp || input.followUp,
      DEFAULT_BUDGET[input.config.mode],
    );

    // C7: stable [S1]/[S2] ids (evidence.ts), not the arrival-order Chunk[]
    // above. The `source` block is no longer emitted here — a source the
    // writer was merely handed but never actually cited is not a source
    // ("Une source non lue n'est pas une source"). It is emitted after the
    // writer streams, from whichever sources survive `auditCitations`.
    const evidenceBundle = buildEvidence(evidence);

    // Learn mode ("Apprendre"): instead of a prose answer, generate a Socratic
    // reply + flashcards + a quiz from the research context and emit them as
    // blocks. Skips the chart / rich-block / writer / faithfulness path.
    if (input.config.mode === 'learn') {
      session.emit('analyzing', {
        step: 'learn',
        message: 'Préparation de tes fiches…',
      });
      const learnContext =
        evidence
          .map(
            (f, index) =>
              `<result index=${index + 1} title=${f.metadata.title}>${f.content}</result>`,
          )
          .join('\n') || '';
      const bundle = await runLearnBundle(
        input.followUp,
        learnContext,
        input.config.llm,
      );
      // Learn mode doesn't use the [Sn] citation contract (the bundle is
      // Socratic prose + flashcards, not a cited article), but every source
      // in evidenceBundle WAS actually handed to the model as context, so
      // showing them still honours "une source non lue n'est pas une
      // source" — none of these are unread.
      session.emitBlock({
        id: crypto.randomUUID(),
        type: 'source',
        data: evidenceBundle.sources.map(toChunk),
      });

      if (bundle) {
        session.emitBlock({
          id: crypto.randomUUID(),
          type: 'text',
          data: bundle.socraticReply,
        });
        session.emitBlock({
          id: crypto.randomUUID(),
          type: 'flashcard',
          data: { flashcards: bundle.flashcards },
        });
        if (bundle.quiz.length > 0) {
          session.emitBlock({
            id: crypto.randomUUID(),
            type: 'quiz',
            data: { questions: bundle.quiz },
          });
        }
      } else {
        session.emitBlock({
          id: crypto.randomUUID(),
          type: 'text',
          data: "Je n'ai pas pu générer de fiches pour cette question. Reformule-la ou réessaie.",
        });
      }
      session.emit('end', {});
      try {
        await supabase
          .from('messages')
          .update({
            status: 'completed',
            response_blocks: session.getAllBlocks(),
          })
          .eq('chat_id', input.chatId)
          .eq('message_id', input.messageId);
      } catch (dbErr) {
        console.error('[Bokari] DB error on learn completion:', dbErr);
      }
      return;
    }

    session.emit('analyzing', {
      step: 'chart',
      message: 'Extraction du graphique…',
    });

    if (looksLikeChartRequest(input.followUp)) {
      const chartSources = evidence
        .map((f, index) => ({
          id: index + 1,
          title: (f.metadata?.title as string) ?? `Source ${index + 1}`,
          content: f.content,
        }));
      try {
        const chart = await extractChartSpec(
          input.followUp,
          chartSources,
          input.config.llm,
        );
        if (chart) {
          session.emit('data', { type: 'chart', chart });
        }
      } catch (chartErr) {
        console.warn('[Bokari] chart extraction failed:', chartErr);
      }
    }

    // Rich illustration blocks (comparison table, entity card, fact-check
    // verdict) — opt-in via BOKARI_RICH_BLOCKS_ENABLED. Same post-research slot
    // as chart extraction (parallel, before the writer streams) so it adds no
    // serial latency. Each extractor fails closed to prose.
    if (isRichBlocksEnabled()) {
      const richSources = evidence
        .map((f, index) => ({
          id: index + 1,
          title: (f.metadata?.title as string) ?? `Source ${index + 1}`,
          content: f.content,
        }));
      if (richSources.length > 0) {
        const richLlm = input.config.llm;
        const jobs: Promise<RichBlock | null>[] = [];
        // Verdict first — the category-defining trust block.
        if (looksLikeVerdictRequest(input.followUp)) {
          jobs.push(extractVerdict(input.followUp, richSources, richLlm));
        }
        if (looksLikeEntityRequest(input.followUp)) {
          jobs.push(extractEntityCard(input.followUp, richSources, richLlm));
        }
        if (looksLikeComparisonRequest(input.followUp)) {
          jobs.push(
            extractComparisonTable(input.followUp, richSources, richLlm),
          );
        }
        if (jobs.length > 0) {
          try {
            const blocks = await Promise.all(jobs);
            for (const block of blocks) {
              if (block) session.emit('data', { type: 'richBlock', block });
            }
          } catch (richErr) {
            console.warn('[Bokari] rich block extraction failed:', richErr);
          }
        }
      }
    }

    session.emit('analyzing', {
      step: 'writing',
      message: 'Rédaction de la réponse…',
    });

    const widgetContext = widgetOutputs
      .map((o) => `<result>${o.llmContext}</result>`)
      .join('\n-------------\n');

    const writerPrompt = getWriterPrompt(
      evidenceBundle,
      input.config.systemInstructions,
      input.config.mode,
      memory || undefined,
      widgetContext || undefined,
    );

    // Route the writer: the fast tier for simple queries, the default
    // (70B-class) for complex ones — model-tier routing. Safe fallback to the
    // default when no fast tier is configured.
    const writerLlm = pickWriterLlm(
      classification.complexity,
      input.config.llm,
      input.config.fastLlm,
    );
    const writerInput = {
      messages: [
        { role: 'system' as const, content: writerPrompt },
        ...input.chatHistory,
        { role: 'user' as const, content: input.followUp },
      ],
      options: ROLE_OPTIONS.writer,
    };
    // On the default tier, a primary-provider failure (e.g. a 429) switches
    // to BOKARI_CHAT_FALLBACK_* transparently — this is the fallback that
    // BUG-01 needed: the old client-chosen model had none. The fast tier is
    // a single explicit choice (BOKARI_FAST_CHAT_*), not a provider pair, so
    // it streams directly.
    const answerStream = withTimeout(
      writerLlm === input.config.llm
        ? streamTextWithFallback(writerInput)
        : writerLlm.streamText(writerInput),
      {
        firstChunkMs: LLM_FIRST_CHUNK_MS,
        idleMs: LLM_IDLE_MS,
        totalMs: LLM_TOTAL_MS,
        label: 'search-agent/writer',
      },
    );

    let responseBlockId = '';

    for await (const chunk of answerStream) {
      if (!responseBlockId) {
        const block: TextBlock = {
          id: crypto.randomUUID(),
          type: 'text',
          data: chunk.contentChunk,
        };
        session.emitBlock(block);
        responseBlockId = block.id;
      } else {
        const block = session.getBlock(responseBlockId) as TextBlock | null;
        if (!block) continue;
        block.data += chunk.contentChunk;
        session.updateBlock(block.id, [
          { op: 'replace', path: '/data', value: block.data },
        ]);
      }
    }

    // C7: reconcile what the model actually wrote against the sources it was
    // actually given. Drops any [Sn] the model invented (BUG-21), and the
    // 'source' block — emitted here, not before the stream — carries only
    // the sources that survived, in order of first citation ("une source non
    // lue n'est pas une source").
    let citedSources: Chunk[] = [];
    if (responseBlockId) {
      const fullAnswer =
        (session.getBlock(responseBlockId) as TextBlock | null)?.data ?? '';
      const audit = auditCitations(fullAnswer, evidenceBundle.sources);
      if (audit.invented.length > 0) {
        // Not user-facing: a prompt-quality signal for us (C7.6 acceptance:
        // this should stay empty in prod logs over time).
        console.warn('[Bokari] model invented citations', {
          chatId: input.chatId,
          invented: audit.invented,
          available: evidenceBundle.sources.length,
        });
      }
      session.updateBlock(responseBlockId, [
        { op: 'replace', path: '/data', value: audit.text },
      ]);
      citedSources = audit.cited.map(toChunk);
    }
    session.emitBlock({
      id: crypto.randomUUID(),
      type: 'source',
      data: citedSources,
    });

    // Citation faithfulness gate (NLI) — opt-in via BOKARI_FAITHFULNESS_ENABLED.
    // Runs *after* the answer has fully streamed (the user already sees the
    // text); it checks each cited claim against its source extract and emits a
    // verdict the UI can badge. Never alters or blocks the answer.
    if (isFaithfulnessEnabled() && responseBlockId) {
      const answerText =
        (session.getBlock(responseBlockId) as TextBlock | null)?.data ?? '';
      const sources = evidenceBundle.sources.map((s) => ({
        content: s.passages.join('\n'),
        title: s.title,
      }));
      if (answerText && sources.length > 0) {
        session.emit('analyzing', {
          step: 'verifying',
          message: 'Vérification des citations…',
        });
        try {
          const report = await checkFaithfulness(
            answerText,
            sources,
            input.config.fastLlm ?? input.config.llm,
          );
          if (report.total > 0) {
            session.emit('data', { type: 'faithfulness', faithfulness: report });
          }
        } catch (verifyErr) {
          console.warn('[Bokari] faithfulness gate failed:', verifyErr);
        }
      }
    }

    session.emit('end', {});

    try {
      await supabase
        .from('messages')
        .update({
          status: 'completed',
          response_blocks: session.getAllBlocks(),
        })
        .eq('chat_id', input.chatId)
        .eq('message_id', input.messageId);
    } catch (dbErr) {
      console.error('[Bokari] DB error on message completion:', dbErr);
    }
  }
}

export default SearchAgent;
