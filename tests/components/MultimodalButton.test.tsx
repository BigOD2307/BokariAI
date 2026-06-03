/**
 * @module components/MultimodalButton.test
 * @description SSR smoke test for the multimodal paperclip button.
 *   Verifies the button is rendered, has the right title/aria-label,
 *   and the hidden file input has the right accept types.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import MultimodalButton from '@/components/MessageInput/MultimodalButton';

describe('MultimodalButton (SSR smoke)', () => {
  it('renders a paperclip button', () => {
    const html = renderToStaticMarkup(
      <MultimodalButton onAttach={() => {}} />,
    );
    expect(html).toMatch(/<button/);
    expect(html).toMatch(/Joindre/);
  });

  it('renders a hidden file input with the right accept list', () => {
    const html = renderToStaticMarkup(
      <MultimodalButton onAttach={() => {}} />,
    );
    expect(html).toContain('type="file"');
    expect(html).toContain('image/jpeg');
    expect(html).toContain('image/png');
    expect(html).toContain('image/webp');
    expect(html).toContain('image/gif');
    expect(html).toContain('application/pdf');
  });

  it('applies disabled state when disabled prop is true', () => {
    const html = renderToStaticMarkup(
      <MultimodalButton onAttach={() => {}} disabled />,
    );
    expect(html).toContain('disabled');
  });
});
