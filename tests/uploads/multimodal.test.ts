import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectKind,
  fileToAttachment,
  MultipartUploadError,
  pasteHandler,
  dragOverHandler,
  dropHandler,
} from '@/lib/uploads/multimodal';

function fakeFile(name: string, type: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe('detectKind', () => {
  it('detects image kind', () => {
    expect(detectKind('image/png')).toBe('image');
    expect(detectKind('image/jpeg')).toBe('image');
  });

  it('detects pdf kind', () => {
    expect(detectKind('application/pdf')).toBe('pdf');
  });

  it('returns null for unknown', () => {
    expect(detectKind('text/plain')).toBeNull();
    expect(detectKind('application/zip')).toBeNull();
    expect(detectKind('')).toBeNull();
  });
});

describe('fileToAttachment', () => {
  it('accepts small png and produces base64 dataUrl', async () => {
    const small = fakeFile('s.png', 'image/png', 1024);
    const att = await fileToAttachment(small);
    expect(att.kind).toBe('image');
    expect(att.mimeType).toBe('image/png');
    expect(att.sizeBytes).toBe(1024);
    expect(att.dataUrl.startsWith('data:image/png;base64,')).toBe(true);
    expect(att.id).toBeTruthy();
    expect(att.uploadedAt).toBeGreaterThan(0);
  });

  it('rejects too large image with TOO_LARGE code', async () => {
    const big = fakeFile('big.png', 'image/png', 11 * 1024 * 1024);
    await expect(fileToAttachment(big)).rejects.toThrow(MultipartUploadError);
    try {
      await fileToAttachment(big);
    } catch (e) {
      expect((e as MultipartUploadError).code).toBe('TOO_LARGE');
    }
  });

  it('rejects empty file with EMPTY code', async () => {
    const empty = fakeFile('e.png', 'image/png', 0);
    try {
      await fileToAttachment(empty);
      expect.fail('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(MultipartUploadError);
      expect((e as MultipartUploadError).code).toBe('EMPTY');
    }
  });

  it('rejects unsupported mime with UNSUPPORTED code', async () => {
    const txt = fakeFile('a.txt', 'text/plain', 100);
    try {
      await fileToAttachment(txt);
      expect.fail('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(MultipartUploadError);
      expect((e as MultipartUploadError).code).toBe('UNSUPPORTED');
    }
  });

  it('accepts pdf and does not probe dimensions', async () => {
    const pdf = fakeFile('doc.pdf', 'application/pdf', 4096);
    const att = await fileToAttachment(pdf);
    expect(att.kind).toBe('pdf');
    expect(att.mimeType).toBe('application/pdf');
    expect(att.width).toBeUndefined();
    expect(att.height).toBeUndefined();
  });
});

describe('pasteHandler', () => {
  it('returns null when no file in clipboard', async () => {
    const e = { clipboardData: { items: [] } } as unknown as ClipboardEvent;
    expect(await pasteHandler(e)).toBeNull();
  });

  it('extracts first file from clipboard', async () => {
    const file = fakeFile('p.png', 'image/png', 100);
    const item = { kind: 'file', getAsFile: () => file };
    const e = { clipboardData: { items: [item] } } as unknown as ClipboardEvent;
    const att = await pasteHandler(e);
    expect(att).not.toBeNull();
    expect(att?.filename).toBe('p.png');
  });
});

describe('dragOverHandler', () => {
  it('preventDefault when files present', () => {
    const e = { preventDefault: vi.fn(), dataTransfer: { types: ['Files'] } } as unknown as DragEvent;
    dragOverHandler(e);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('does not preventDefault for non-file drag', () => {
    const e = { preventDefault: vi.fn(), dataTransfer: { types: ['text/plain'] } } as unknown as DragEvent;
    dragOverHandler(e);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });
});

describe('dropHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('preventDefault and returns array of attachments', async () => {
    const a = fakeFile('a.png', 'image/png', 100);
    const b = fakeFile('b.png', 'image/png', 200);
    const e = {
      preventDefault: vi.fn(),
      dataTransfer: { files: [a, b] },
    } as unknown as DragEvent;
    const out = await dropHandler(e);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(out).toHaveLength(2);
    expect(out[0]?.filename).toBe('a.png');
    expect(out[1]?.filename).toBe('b.png');
  });

  it('skips unsupported files but still returns valid ones', async () => {
    const ok = fakeFile('ok.png', 'image/png', 100);
    const bad = fakeFile('bad.txt', 'text/plain', 100);
    const e = {
      preventDefault: vi.fn(),
      dataTransfer: { files: [ok, bad] },
    } as unknown as DragEvent;
    const out = await dropHandler(e);
    expect(out).toHaveLength(1);
    expect(out[0]?.filename).toBe('ok.png');
  });

  it('returns empty array when no files are dropped', async () => {
    const e = {
      preventDefault: vi.fn(),
      dataTransfer: { files: [] },
    } as unknown as DragEvent;
    const out = await dropHandler(e);
    expect(out).toEqual([]);
  });

  it('handles drop without dataTransfer gracefully', async () => {
    const e = { preventDefault: vi.fn() } as unknown as DragEvent;
    const out = await dropHandler(e);
    expect(out).toEqual([]);
  });
});
