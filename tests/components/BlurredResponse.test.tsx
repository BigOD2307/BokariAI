/**
 * @module components/BlurredResponse.test
 * @description SSR smoke test for the blurred response CTA.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    setShowAuthModal: vi.fn(),
  }),
}));

vi.mock('next/headers', () => ({
  cookies: () => ({ get: () => null, set: () => {} }),
}));

import BlurredResponse from '@/components/Message/BlurredResponse';

describe('BlurredResponse (SSR smoke)', () => {
  it('renders the limit_reached variant copy', () => {
    const html = renderToStaticMarkup(
      <BlurredResponse variant="limit_reached">
        <p>some hidden text</p>
      </BlurredResponse>,
    );
    expect(html).toMatch(/3 questions gratuites/);
  });

  it('renders the default variant copy', () => {
    const html = renderToStaticMarkup(
      <BlurredResponse>
        <p>some hidden text</p>
      </BlurredResponse>,
    );
    expect(html).toMatch(/Crée ton compte gratuit/);
  });

  it('renders the WhatsApp CTA', () => {
    const html = renderToStaticMarkup(
      <BlurredResponse>
        <p>x</p>
      </BlurredResponse>,
    );
    expect(html).toMatch(/Continuer avec WhatsApp/);
  });

  it('applies blur to children', () => {
    const html = renderToStaticMarkup(
      <BlurredResponse>
        <p>some hidden text</p>
      </BlurredResponse>,
    );
    expect(html).toContain('blur(8px)');
  });
});
