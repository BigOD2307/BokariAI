/**
 * @module components/AttachmentPreview.test
 * @description SSR smoke test for the attachment thumbnail.  Verifies
 *   that image kind renders an <img> tag with the dataUrl, pdf kind
 *   renders a file icon, and the filename is shown in both cases.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AttachmentPreview from '@/components/MessageInput/AttachmentPreview';
import type { Attachment } from '@/lib/types/multimodal';

const IMG: Attachment = {
  id: '1',
  kind: 'image',
  filename: 'photo.png',
  mimeType: 'image/png',
  sizeBytes: 4096,
  dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
  uploadedAt: 0,
};

const PDF: Attachment = {
  id: '2',
  kind: 'pdf',
  filename: 'cv.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 12_000,
  dataUrl: 'data:application/pdf;base64,JVBERi0xLjQK',
  uploadedAt: 0,
};

describe('AttachmentPreview (SSR smoke)', () => {
  it('renders image with dataUrl and alt text', () => {
    const html = renderToStaticMarkup(
      <AttachmentPreview attachment={IMG} onRemove={() => {}} />,
    );
    expect(html).toContain('photo.png');
    expect(html).toContain('data:image/png;base64,iVBORw0KGgo=');
    expect(html).toContain('<img');
  });

  it('renders file icon (no <img>) for PDF', () => {
    const html = renderToStaticMarkup(
      <AttachmentPreview attachment={PDF} onRemove={() => {}} />,
    );
    expect(html).toContain('cv.pdf');
    expect(html).not.toContain('<img');
  });

  it('formats sizes in KB for small files', () => {
    const html = renderToStaticMarkup(
      <AttachmentPreview attachment={IMG} onRemove={() => {}} />,
    );
    expect(html).toContain('4 KB');
  });

  it('formats sizes in MB for larger files', () => {
    const big: Attachment = { ...PDF, sizeBytes: 2 * 1024 * 1024 };
    const html = renderToStaticMarkup(
      <AttachmentPreview attachment={big} onRemove={() => {}} />,
    );
    expect(html).toContain('MB');
  });

  it('renders a remove button with the right label', () => {
    const html = renderToStaticMarkup(
      <AttachmentPreview attachment={IMG} onRemove={() => {}} />,
    );
    expect(html).toMatch(/Retirer/);
  });

  it('escapes the filename to prevent HTML injection', () => {
    const evil: Attachment = { ...IMG, filename: '"><img src=x>' };
    const html = renderToStaticMarkup(
      <AttachmentPreview attachment={evil} onRemove={() => {}} />,
    );
    expect(html).not.toContain('"><img src=x>');
  });
});
