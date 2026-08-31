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
  // chatId/userId are internal ids that must never reach a public,
  // unauthenticated page — they let a visitor probe other private routes
  // (BUG-15). The owner-facing share management UI uses `Share` directly.
  share: Omit<Share, 'chatId' | 'userId'>;
  chat: {
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
