import { ResearcherOutput, SearchAgentInput } from './types';
import SessionManager from '@/lib/session';
import { classify } from './classifier';
import Researcher from './researcher';
import { getWriterPrompt } from '@/lib/prompts/search/writer';
import { WidgetExecutor } from './widgets';
import supabase from '@/lib/db';
import { TextBlock } from '@/lib/types';
import { withTimeout } from '@/lib/utils/streamTimeout';

/** Per-call LLM stream budgets.  These are the caps that prevent a
 *  stalled upstream (Groq / OpenRouter / Ollama) from pinning a
 *  Bokari request forever.  See `src/lib/utils/streamTimeout.ts`. */
const LLM_FIRST_CHUNK_MS = 60_000;
const LLM_IDLE_MS = 30_000;
const LLM_TOTAL_MS = 5 * 60_000;

/** Cap on the number of search results injected into the writer
 *  prompt.  Without this, a deep-search with 100+ sources produces a
 *  200k+ token prompt that the LLM rejects or truncates, causing
 *  the writer to loop or hang. */
const MAX_WRITER_RESULTS = 8;

/**
 * Fetch conversation memory for the current user/chat.
 * Returns recent chat topics to give Bokari context about past interactions.
 */
async function fetchMemory(chatId: string): Promise<string> {
  try {
    const { data: chat } = await supabase
      .from('chats')
      .select('user_id')
      .eq('id', chatId)
      .maybeSingle();

    if (!chat?.user_id) return '';

    const { data: recentChats } = await supabase
      .from('chats')
      .select('id, title, created_at')
      .eq('user_id', chat.user_id)
      .neq('id', chatId)
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

    for (const c of recentChats) {
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

    const classification = await classify({
      chatHistory: input.chatHistory,
      enabledSources: input.config.sources,
      query: input.followUp,
      llm: input.config.llm,
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
      const researcher = new Researcher();
      searchPromise = researcher.research(session, {
        chatHistory: input.chatHistory,
        followUp: input.followUp,
        classification,
        config: input.config,
      });
    }

    const memoryPromise = fetchMemory(input.chatId);

    const [widgetOutputs, searchResults, memory] = await Promise.all([
      widgetPromise,
      searchPromise,
      memoryPromise,
    ]);

    session.emit('data', { type: 'researchComplete' });

    const finalContext =
      searchResults?.searchFindings
        .slice(0, MAX_WRITER_RESULTS)
        .map(
          (f, index) =>
            `<result index=${index + 1} title=${f.metadata.title}>${f.content}</result>`,
        )
        .join('\n') || '';

    const widgetContext = widgetOutputs
      .map((o) => `<result>${o.llmContext}</result>`)
      .join('\n-------------\n');

    const finalContextWithWidgets = `<search_results note="These are the search results and assistant can cite these">\n${finalContext}\n</search_results>\n<widgets_result noteForAssistant="Its output is already showed to the user, assistant can use this information to answer the query but do not CITE this as a souce">\n${widgetContext}\n</widgets_result>`;

    const writerPrompt = getWriterPrompt(
      finalContextWithWidgets,
      input.config.systemInstructions,
      input.config.mode,
      memory || undefined,
    );

    const answerStream = withTimeout(
      input.config.llm.streamText({
        messages: [
          { role: 'system', content: writerPrompt },
          ...input.chatHistory,
          { role: 'user', content: input.followUp },
        ],
      }),
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
