/**
 * @module components/ShareButton.test
 * @description SSR smoke test for the share button.
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

import ShareButton from '@/components/MessageActions/ShareButton';

describe('ShareButton (SSR smoke)', () => {
  it('renders the share icon button', () => {
    const html = renderToStaticMarkup(<ShareButton chatId="c1" />);
    expect(html).toMatch(/<button/);
    expect(html).toMatch(/Partager cette conversation/);
  });
});
