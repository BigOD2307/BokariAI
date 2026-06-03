import OpenAILLM from '../openai/openaiLLM';
import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';

/**
 * Anthropic prompt-caching uses a different shape than OpenAI:
 *
 *   system: [
 *     { type: 'text', text: '...', cache_control: { type: 'ephemeral' } },
 *     ...,
 *   ]
 *
 * Anthropic's API does NOT use the OpenAI messages array — it
 * has a top-level `system` field.  But this provider talks to
 * Anthropic via the OpenAI SDK pointed at Anthropic's base URL,
 * so the request shape that actually goes on the wire is the
 * OpenAI one.  We therefore keep the messages-array shape and
 * attach `cache_control` to the *content parts* of the system
 * and last context messages, same as the OpenAI provider.
 *
 * The override is here (rather than inheriting from OpenAILLM)
 * so we can swap to Anthropic's native message format later
 * without touching OpenAILLM.
 */
class AnthropicLLM extends OpenAILLM {
  override applyPromptCaching(
    messages: ChatCompletionMessageParam[],
  ): ChatCompletionMessageParam[] {
    // Same as OpenAI for now — both go through the OpenAI SDK.
    return super.applyPromptCaching(messages);
  }
}

export default AnthropicLLM;
