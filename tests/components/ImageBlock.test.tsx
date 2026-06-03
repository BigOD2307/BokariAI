/**
 * @module components/ImageBlock.test
 * @description Smoke test for the inline image block.  Uses SSR
 *   (react-dom/server) so the test does not require a DOM environment
 *   or @testing-library/react.  Asserts the rendered HTML contains the
 *   image, filename, and the correct data URL.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ImageBlock from '@/components/MessageRenderer/ImageBlock';
import type { Attachment, VisionResult } from '@/lib/types/multimodal';

const ATT: Attachment = {
  id: 'a1',
  kind: 'image',
  filename: 'cat.png',
  mimeType: 'image/png',
  sizeBytes: 1024,
  dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
  width: 100,
  height: 100,
  uploadedAt: 0,
};

describe('ImageBlock (SSR smoke)', () => {
  it('renders an <img> with the attachment dataUrl and alt text', () => {
    const html = renderToStaticMarkup(<ImageBlock attachment={ATT} />);
    expect(html).toContain('cat.png');
    expect(html).toContain('data:image/png;base64,iVBORw0KGgo=');
    expect(html).toMatch(/<img[^>]+cursor-zoom-in/);
  });

  it('does not include zoom modal in the initial render', () => {
    const html = renderToStaticMarkup(<ImageBlock attachment={ATT} />);
    expect(html).not.toContain('role="dialog"');
  });

  it('renders vision description when provided', () => {
    const vision: VisionResult = {
      attachmentId: 'a1',
      description: 'A small dog on a couch',
      model: 'google/gemini-2.5-flash',
      costUsd: 0.0001,
      durationMs: 350,
    };
    const html = renderToStaticMarkup(
      <ImageBlock attachment={ATT} vision={vision} />,
    );
    expect(html).toContain('gemini-2.5-flash');
    expect(html).toContain('A small dog on a couch');
  });

  it('escapes the filename to prevent HTML injection', () => {
    const evil: Attachment = { ...ATT, filename: '<script>alert(1)</script>' };
    const html = renderToStaticMarkup(<ImageBlock attachment={evil} />);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('renders cost + duration when vision has them', () => {
    const vision: VisionResult = {
      attachmentId: 'a1',
      description: 'A dog',
      model: 'anthropic/claude-sonnet-4.6',
      costUsd: 0.0123,
      durationMs: 1000,
    };
    const html = renderToStaticMarkup(
      <ImageBlock attachment={ATT} vision={vision} />,
    );
    expect(html).toContain('0.0123');
    expect(html).toContain('1000ms');
  });

  it('omits vision block when not provided', () => {
    const html = renderToStaticMarkup(<ImageBlock attachment={ATT} />);
    expect(html).not.toContain('gemini');
    expect(html).not.toContain('claude');
  });
});
