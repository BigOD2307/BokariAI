export interface Share {
  id: string;
  chatId: string;
  userId: string;
  slug: string;
  isIndexed: boolean;
  anonymousAuthor: boolean;
  viewCount: number;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
}

export interface CreateShareInput {
  chatId: string;
  isIndexed?: boolean;
  anonymousAuthor?: boolean;
  expiresInDays?: number;
}

export interface PublicChatView {
  share: Share;
  chat: {
    id: string;
    title: string;
    createdAt: string;
  };
  author: {
    name: string;
    isAnonymous: boolean;
  };
  firstUserMessage: {
    content: string;
  } | null;
  answer: string;
  sources: Array<{
    title: string;
    url: string;
    snippet?: string;
  }>;
}
