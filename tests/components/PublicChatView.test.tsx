/**
 * @module components/PublicChatView.test
 * @description SSR smoke test for the public chat view.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({ user: null, setShowAuthModal: vi.fn() }),
  useGuestSession: () => ({
    isGuest: true,
    id: '',
    queriesCount: 0,
    queriesRemaining: 3,
    isLimitReached: false,
    increment: vi.fn(),
    refresh: vi.fn(),
  }),
}));

import PublicChatView from '@/components/Public/PublicChatView';
import type { PublicChatView as Data } from '@/lib/types/shares';

const mockData: Data = {
  share: {
    id: 'shr_abc123',
    chatId: 'c1',
    userId: 'u1',
    slug: 'test123abc',
    isIndexed: true,
    anonymousAuthor: false,
    viewCount: 1247,
    createdAt: '2026-06-01T10:00:00Z',
    expiresAt: null,
    revokedAt: null,
  },
  chat: {
    id: 'c1',
    title: 'Comment fonctionne Bokari ?',
    createdAt: '2026-06-01T10:00:00Z',
  },
  author: { name: 'Amadou', isAnonymous: false },
  firstUserMessage: { content: 'Comment fonctionne Bokari ?' },
  answer:
    "Bokari est un moteur de recherche IA qui valide chaque source par NLI. Il combine recherche web, lecture de sources, et redaction assistee par LLM. Le resultat est une reponse structuree avec des sources numerotees.",
  sources: [
    { title: 'Documentation Bokari', url: 'https://bokari.dev/docs' },
    { title: 'NLI paper', url: 'https://arxiv.org/abs/2101.08215' },
  ],
};

describe('PublicChatView (SSR smoke)', () => {
  it('renders the question as a heading', () => {
    const html = renderToStaticMarkup(<PublicChatView data={mockData} />);
    expect(html).toMatch(/Comment fonctionne Bokari/);
  });

  it('renders the author and date', () => {
    const html = renderToStaticMarkup(<PublicChatView data={mockData} />);
    expect(html).toMatch(/Amadou/);
  });

  it('renders the source list', () => {
    const html = renderToStaticMarkup(<PublicChatView data={mockData} />);
    expect(html).toMatch(/Documentation Bokari/);
    expect(html).toMatch(/NLI paper/);
  });

  it('renders the view count', () => {
    const html = renderToStaticMarkup(<PublicChatView data={mockData} />);
    expect(html).toMatch(/1[\s\u00A0]?247/);
  });

  it('shows the blur CTA when user is not logged in', () => {
    const html = renderToStaticMarkup(<PublicChatView data={mockData} />);
    // CTA migrated from WhatsApp to email sign-up.
    expect(html).toMatch(/Créer mon compte gratuit/);
    expect(html).toMatch(/questions gratuites/);
    expect(html).not.toMatch(/WhatsApp/);
  });

  it('shows the noindex tag when share is not indexed', () => {
    const data: Data = {
      ...mockData,
      share: { ...mockData.share, isIndexed: false },
    };
    const html = renderToStaticMarkup(<PublicChatView data={data} />);
    expect(html).toMatch(/noindex|Noindex/i);
  });

  it('renders the CTA card at the bottom', () => {
    const html = renderToStaticMarkup(<PublicChatView data={mockData} />);
    expect(html).toMatch(/Ta propre réponse/);
    expect(html).toMatch(/Essayer Bokari/);
  });
});
