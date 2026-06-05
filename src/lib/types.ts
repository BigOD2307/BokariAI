import { ToolCall } from './models/types';

export type SystemMessage = {
  role: 'system';
  content: string;
};

export type AssistantMessage = {
  role: 'assistant';
  content: string;
  tool_calls?: ToolCall[];
};

export type UserMessage = {
  role: 'user';
  content: string;
};

export type ToolMessage = {
  role: 'tool';
  id: string;
  name: string;
  content: string;
};

export type ChatTurnMessage = UserMessage | AssistantMessage;

export type Message =
  | UserMessage
  | AssistantMessage
  | SystemMessage
  | ToolMessage;

export type Chunk = {
  content: string;
  metadata: Record<string, any>;
};

export type TextBlock = {
  id: string;
  type: 'text';
  data: string;
};

export type SourceBlock = {
  id: string;
  type: 'source';
  data: Chunk[];
};

export type SuggestionBlock = {
  id: string;
  type: 'suggestion';
  data: string[];
};

export type WidgetBlock = {
  id: string;
  type: 'widget';
  data: {
    widgetType: string;
    params: Record<string, any>;
  };
};

export type ReasoningResearchBlock = {
  id: string;
  type: 'reasoning';
  reasoning: string;
};

export type SearchingResearchBlock = {
  id: string;
  type: 'searching';
  searching: string[];
};

export type SearchResultsResearchBlock = {
  id: string;
  type: 'search_results';
  reading: Chunk[];
};

export type ReadingResearchBlock = {
  id: string;
  type: 'reading';
  reading: Chunk[];
};

export type UploadSearchingResearchBlock = {
  id: string;
  type: 'upload_searching';
  queries: string[];
};

export type UploadSearchResultsResearchBlock = {
  id: string;
  type: 'upload_search_results';
  results: Chunk[];
};

export type ResearchBlockSubStep =
  | ReasoningResearchBlock
  | SearchingResearchBlock
  | SearchResultsResearchBlock
  | ReadingResearchBlock
  | UploadSearchingResearchBlock
  | UploadSearchResultsResearchBlock;

export type ResearchBlock = {
  id: string;
  type: 'research';
  data: {
    subSteps: ResearchBlockSubStep[];
  };
};

export interface Flashcard {
  id?: string;
  front: string;
  back: string;
  bloomLevel?: string;
  easeFactor?: number;
  interval?: number;
  repetitions?: number;
  dueAt?: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  bloomLevel?: string;
}

export type FlashcardBlock = {
  id: string;
  type: 'flashcard';
  data: {
    flashcards: Flashcard[];
    deckId?: string;
  };
};

export type QuizBlock = {
  id: string;
  type: 'quiz';
  data: {
    questions: QuizQuestion[];
  };
};

export type Block =
  | TextBlock
  | SourceBlock
  | SuggestionBlock
  | WidgetBlock
  | ResearchBlock
  | FlashcardBlock
  | QuizBlock;
