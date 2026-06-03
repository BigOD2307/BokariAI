/**
 * @module components/WhatsAppAuthModal.test
 * @description SSR smoke test for the WhatsApp auth modal.
 *   Verifies the two-step flow renders the static text correctly.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import WhatsAppAuthModal from '@/components/Auth/WhatsAppAuthModal';

describe('WhatsAppAuthModal (SSR smoke)', () => {
  it('renders the modal heading', () => {
    const html = renderToStaticMarkup(<WhatsAppAuthModal />);
    expect(html).toMatch(/Continuer avec WhatsApp/);
  });

  it('renders the Bokari green icon container', () => {
    const html = renderToStaticMarkup(<WhatsAppAuthModal />);
    expect(html).toContain('from-green-400');
  });

  it('renders a modal with a phone form', () => {
    const html = renderToStaticMarkup(<WhatsAppAuthModal />);
    expect(html).toContain('w-full');
    expect(html).toMatch(/Recevoir le code/);
  });
});
