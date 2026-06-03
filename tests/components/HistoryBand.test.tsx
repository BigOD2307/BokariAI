/**
 * @module components/HistoryBand.test
 * @description SSR smoke test for the sidebar history band.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({ user: null, setShowAuthModal: vi.fn() }),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/hooks/useChatHistory', () => ({
  useChatHistory: () => ({
    chats: [],
    loading: false,
    error: null,
    hasMore: false,
    loadMore: vi.fn(),
    refresh: vi.fn(),
    search: vi.fn(),
    query: '',
  }),
}));

import HistoryBand from '@/components/Sidebar/HistoryBand';

describe('HistoryBand (SSR smoke)', () => {
  it('renders the search input', () => {
    const html = renderToStaticMarkup(<HistoryBand />);
    expect(html).toMatch(/Rechercher/);
  });

  it('shows the empty state when no chats', () => {
    const html = renderToStaticMarkup(<HistoryBand />);
    expect(html).toMatch(/Aucune conversation/);
  });
});
