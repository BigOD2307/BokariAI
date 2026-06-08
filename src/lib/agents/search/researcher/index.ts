import { ActionOutput, ResearcherInput, ResearcherOutput } from '../types';
import { ActionRegistry } from './actions';
import { getResearcherPrompt } from '@/lib/prompts/search/researcher';
import SessionManager from '@/lib/session';
import { Message, ReasoningResearchBlock } from '@/lib/types';
import formatChatHistoryAsString from '@/lib/utils/formatHistory';
import { ToolCall } from '@/lib/models/types';
import { withTimeout } from '@/lib/utils/streamTimeout';

/** Per-call LLM stream budgets for the researcher's reasoning loop.
 *  Mirrors the search-agent writer budgets.  Each iteration gets a
 *  fresh deadline — the total wall clock of a deep-search (up to 35
 *  iterations × these caps) is bounded by `maxIteration` upstream. */
const RESEARCHER_FIRST_CHUNK_MS = 45_000;
const RESEARCHER_IDLE_MS = 30_000;
const RESEARCHER_TOTAL_MS = 90_000;

class Researcher {
  async research(
    session: SessionManager,
    input: ResearcherInput,
  ): Promise<ResearcherOutput> {
    let actionOutput: ActionOutput[] = [];
    let maxIteration =
      input.config.mode === 'speed'
        ? 3
        : input.config.mode === 'balanced'
          ? 6
          : 35; // deep search: up to 35 iterations x 3 queries = ~100 sources

    const availableTools = ActionRegistry.getAvailableActionTools({
      classification: input.classification,
      fileIds: input.config.fileIds,
      mode: input.config.mode,
      sources: input.config.sources,
    });

    const availableActionsDescription =
      ActionRegistry.getAvailableActionsDescriptions({
        classification: input.classification,
        fileIds: input.config.fileIds,
        mode: input.config.mode,
        sources: input.config.sources,
      });

    const researchBlockId = crypto.randomUUID();

    session.emitBlock({
      id: researchBlockId,
      type: 'research',
      data: {
        subSteps: [],
      },
    });

    const agentMessageHistory: Message[] = [
      {
        role: 'user',
        content: `
          <conversation>
          ${formatChatHistoryAsString(input.chatHistory.slice(-10))}
           User: ${input.followUp} (Standalone question: ${input.classification.standaloneFollowUp})
           </conversation>
        `,
      },
    ];

    for (let i = 0; i < maxIteration; i++) {
      const researcherPrompt = getResearcherPrompt(
        availableActionsDescription,
        input.config.mode,
        i,
        maxIteration,
        input.config.fileIds,
      );

      const actionStream = withTimeout(
        input.config.llm.streamText({
          messages: [
            {
              role: 'system',
              content: researcherPrompt,
            },
            ...agentMessageHistory,
          ],
          tools: availableTools,
        }),
        {
          firstChunkMs: RESEARCHER_FIRST_CHUNK_MS,
          idleMs: RESEARCHER_IDLE_MS,
          totalMs: RESEARCHER_TOTAL_MS,
          label: `researcher/iter-${i}`,
        },
      );

      const block = session.getBlock(researchBlockId);

      let reasoningEmitted = false;
      let reasoningId = crypto.randomUUID();
      let nativeReasoning = '';

      let finalToolCalls: ToolCall[] = [];

      for await (const partialRes of actionStream) {
        // Native reasoning stream (DeepSeek V4 etc.) -> one streaming
        // "Reflexion" sub-step. This is the model's actual thinking, shown
        // independently of whether it also calls the plan tool.
        if (partialRes.reasoningChunk && block && block.type === 'research') {
          nativeReasoning += partialRes.reasoningChunk;
          if (!reasoningEmitted) {
            reasoningEmitted = true;
            block.data.subSteps.push({
              id: reasoningId,
              type: 'reasoning',
              reasoning: nativeReasoning,
            });
          } else {
            const idx = block.data.subSteps.findIndex(
              (step: any) => step.id === reasoningId,
            );
            if (idx !== -1) {
              (block.data.subSteps[idx] as ReasoningResearchBlock).reasoning =
                nativeReasoning;
            }
          }
          session.updateBlock(researchBlockId, [
            {
              op: 'replace',
              path: '/data/subSteps',
              value: block.data.subSteps,
            },
          ]);
        }

        if (partialRes.toolCallChunk.length > 0) {
          partialRes.toolCallChunk.forEach((tc) => {
            if (
              tc.name === '__reasoning_preamble' &&
              tc.arguments['plan'] &&
              !reasoningEmitted &&
              !nativeReasoning &&
              block &&
              block.type === 'research'
            ) {
              reasoningEmitted = true;

              block.data.subSteps.push({
                id: reasoningId,
                type: 'reasoning',
                reasoning: tc.arguments['plan'],
              });

              session.updateBlock(researchBlockId, [
                {
                  op: 'replace',
                  path: '/data/subSteps',
                  value: block.data.subSteps,
                },
              ]);
            } else if (
              tc.name === '__reasoning_preamble' &&
              tc.arguments['plan'] &&
              reasoningEmitted &&
              !nativeReasoning &&
              block &&
              block.type === 'research'
            ) {
              const subStepIndex = block.data.subSteps.findIndex(
                (step: any) => step.id === reasoningId,
              );

              if (subStepIndex !== -1) {
                const subStep = block.data.subSteps[
                  subStepIndex
                ] as ReasoningResearchBlock;
                subStep.reasoning = tc.arguments['plan'];
                session.updateBlock(researchBlockId, [
                  {
                    op: 'replace',
                    path: '/data/subSteps',
                    value: block.data.subSteps,
                  },
                ]);
              }
            }

            const existingIndex = finalToolCalls.findIndex(
              (ftc) => ftc.id === tc.id,
            );

            if (existingIndex !== -1) {
              finalToolCalls[existingIndex].arguments = tc.arguments;
            } else {
              finalToolCalls.push(tc);
            }
          });
        }
      }

      if (finalToolCalls.length === 0) {
        break;
      }

      if (finalToolCalls[finalToolCalls.length - 1].name === 'done') {
        break;
      }

      agentMessageHistory.push({
        role: 'assistant',
        content: '',
        tool_calls: finalToolCalls,
      });

      const actionResults = await ActionRegistry.executeAll(finalToolCalls, {
        llm: input.config.llm,
        embedding: input.config.embedding,
        session: session,
        researchBlockId: researchBlockId,
        fileIds: input.config.fileIds,
        mode: input.config.mode,
        sources: input.config.sources,
        classification: input.classification,
      });

      actionOutput.push(...actionResults);

      actionResults.forEach((action, i) => {
        agentMessageHistory.push({
          role: 'tool',
          id: finalToolCalls[i].id,
          name: finalToolCalls[i].name,
          content: JSON.stringify(action),
        });
      });
    }

    const searchResults = actionOutput
      .filter((a) => a.type === 'search_results')
      .flatMap((a) => a.results);

    const seenUrls = new Map<string, number>();

    const filteredSearchResults = searchResults
      .map((result, index) => {
        if (result.metadata.url && !seenUrls.has(result.metadata.url)) {
          seenUrls.set(result.metadata.url, index);
          return result;
        } else if (result.metadata.url && seenUrls.has(result.metadata.url)) {
          const existingIndex = seenUrls.get(result.metadata.url)!;

          const existingResult = searchResults[existingIndex];

          existingResult.content += `\n\n${result.content}`;

          return undefined;
        }

        return result;
      })
      .filter((r) => r !== undefined);

    session.emitBlock({
      id: crypto.randomUUID(),
      type: 'source',
      data: filteredSearchResults,
    });

    return {
      findings: actionOutput,
      searchFindings: filteredSearchResults,
    };
  }
}

export default Researcher;
