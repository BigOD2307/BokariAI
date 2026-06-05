import z from 'zod';
import BaseLLM from '../../models/base/llm';
import BaseEmbedding from '@/lib/models/base/embedding';
import SessionManager from '@/lib/session';
import { ChatTurnMessage, Chunk } from '@/lib/types';

export type SearchSources =
  | 'web'
  | 'discussions'
  | 'academic'
  | 'x'
  | 'reddit'
  | 'linkedin'
  | 'youtube';

export type SearchAgentConfig = {
  sources: SearchSources[];
  fileIds: string[];
  llm: BaseLLM<any>;
  /** Optional fast tier (e.g. Groq Llama 3.1 8B) for simple queries. */
  fastLlm?: BaseLLM<any>;
  embedding: BaseEmbedding<any>;
  mode: 'speed' | 'balanced' | 'quality' | 'learn';
  systemInstructions: string;
};

export type SearchAgentInput = {
  chatHistory: ChatTurnMessage[];
  followUp: string;
  config: SearchAgentConfig;
  chatId: string;
  messageId: string;
};

export type WidgetInput = {
  chatHistory: ChatTurnMessage[];
  followUp: string;
  classification: ClassifierOutput;
  llm: BaseLLM<any>;
};

export type Widget = {
  type: string;
  shouldExecute: (classification: ClassifierOutput) => boolean;
  execute: (input: WidgetInput) => Promise<WidgetOutput | void>;
};

export type WidgetOutput = {
  type: string;
  llmContext: string;
  data: any;
};

export type ClassifierInput = {
  llm: BaseLLM<any>;
  enabledSources: SearchSources[];
  query: string;
  chatHistory: ChatTurnMessage[];
};

export type ClassifierOutput = {
  classification: {
    skipSearch: boolean;
    personalSearch: boolean;
    academicSearch: boolean;
    discussionSearch: boolean;
    xSearch: boolean;
    redditSearch: boolean;
    linkedinSearch: boolean;
    youtubeSearch: boolean;
    showWeatherWidget: boolean;
    showStockWidget: boolean;
    showCalculationWidget: boolean;
  };
  standaloneFollowUp: string;
  complexity: 'simple' | 'complex';
};

export type AdditionalConfig = {
  llm: BaseLLM<any>;
  embedding: BaseEmbedding<any>;
  session: SessionManager;
  mode?: SearchAgentConfig['mode'];
  /** Enabled source toggles (for actions that fan out per source, e.g. social). */
  sources?: SearchSources[];
  /** Classifier output (for actions needing per-network booleans at execute time). */
  classification?: ClassifierOutput;
};

export type ResearcherInput = {
  chatHistory: ChatTurnMessage[];
  followUp: string;
  classification: ClassifierOutput;
  config: SearchAgentConfig;
};

export type ResearcherOutput = {
  findings: ActionOutput[];
  searchFindings: Chunk[];
};

export type SearchActionOutput = {
  type: 'search_results';
  results: Chunk[];
};

export type DoneActionOutput = {
  type: 'done';
};

export type ReasoningResearchAction = {
  type: 'reasoning';
  reasoning: string;
};

export type ActionOutput =
  | SearchActionOutput
  | DoneActionOutput
  | ReasoningResearchAction;

export interface ResearchAction<
  TSchema extends z.ZodObject<any> = z.ZodObject<any>,
> {
  name: string;
  schema: z.ZodObject<any>;
  getToolDescription: (config: { mode: SearchAgentConfig['mode'] }) => string;
  getDescription: (config: { mode: SearchAgentConfig['mode'] }) => string;
  enabled: (config: {
    classification: ClassifierOutput;
    fileIds: string[];
    mode: SearchAgentConfig['mode'];
    sources: SearchSources[];
  }) => boolean;
  execute: (
    params: z.infer<TSchema>,
    additionalConfig: AdditionalConfig & {
      researchBlockId: string;
      fileIds: string[];
    },
  ) => Promise<ActionOutput>;
}
