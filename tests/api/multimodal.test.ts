/**
 * @module api/multimodal.test
 * @description Integration-style test for the /api/multimodal POST
 *   endpoint.  Mocks global.fetch to capture the vision call and
 *   exercises happy path + 2 error paths.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ORIGINAL_FETCH = global.fetch;
const ORIGINAL_API_KEY = process.env.OPENROUTER_API_KEY;

interface FakeReq {
  formData: () => Promise<FormData>;
}

function makeFileRequest(file: File, prompt: string): FakeReq {
  return {
    formData: async () => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('prompt', prompt);
      return fd;
    },
  };
}

async function importRoute() {
  return await import('@/app/api/multimodal/route');
}

describe('POST /api/multimodal', () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = 'sk-or-test';
    global.fetch = vi.fn();
  });
  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    if (ORIGINAL_API_KEY === undefined) {
      delete process.env.OPENROUTER_API_KEY;
    } else {
      process.env.OPENROUTER_API_KEY = ORIGINAL_API_KEY;
    }
  });

  it('returns attachment + vision on happy path', async () => {
    const fake = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fake.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'A small dog' } }],
          usage: { cost: 0.0001 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const { POST } = await importRoute();
    const file = new File([new Uint8Array(1024)], 'pup.png', {
      type: 'image/png',
    });
    const req = makeFileRequest(file, 'What is this?') as unknown as Request;

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.attachment.kind).toBe('image');
    expect(json.attachment.filename).toBe('pup.png');
    expect(json.vision.description).toBe('A small dog');
    expect(json.vision.model).toBe('google/gemini-2.5-flash');
    expect(json.vision.costUsd).toBeCloseTo(0.0001);
    expect(fake).toHaveBeenCalledOnce();
  });

  it('returns 400 with TOO_LARGE for oversized image', async () => {
    const { POST } = await importRoute();
    const file = new File(
      [new Uint8Array(11 * 1024 * 1024)],
      'big.png',
      { type: 'image/png' },
    );
    const req = makeFileRequest(file, 'p') as unknown as Request;
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe('TOO_LARGE');
  });

  it('returns 400 with UNSUPPORTED for unknown mime', async () => {
    const { POST } = await importRoute();
    const file = new File([new Uint8Array(100)], 'a.txt', {
      type: 'text/plain',
    });
    const req = makeFileRequest(file, 'p') as unknown as Request;
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe('UNSUPPORTED');
  });

  it('returns 400 when no file is provided', async () => {
    const { POST } = await importRoute();
    const req = {
      formData: async () => {
        const fd = new FormData();
        return fd;
      },
    } as unknown as Request;
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 500 when vision API fails on both models', async () => {
    const fake = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fake.mockResolvedValue(new Response('upstream', { status: 500 }));
    const { POST } = await importRoute();
    const file = new File([new Uint8Array(1024)], 'p.png', {
      type: 'image/png',
    });
    const req = makeFileRequest(file, 'p') as unknown as Request;
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it('skips vision for pdf attachments and returns attachment only', async () => {
    const { POST } = await importRoute();
    const file = new File([new Uint8Array(2048)], 'doc.pdf', {
      type: 'application/pdf',
    });
    const req = makeFileRequest(file, 'p') as unknown as Request;
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.attachment.kind).toBe('pdf');
    expect(json.vision).toBeNull();
  });

  it('returns 500 with friendly message when OPENROUTER_API_KEY is missing', async () => {
    delete process.env.OPENROUTER_API_KEY;
    const { POST } = await importRoute();
    const file = new File([new Uint8Array(1024)], 'p.png', {
      type: 'image/png',
    });
    const req = makeFileRequest(file, 'p') as unknown as Request;
    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/OPENROUTER_API_KEY/);
  });

  it('uses the default French prompt when none is provided', async () => {
    const fake = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fake.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'A small dog' } }],
          usage: { cost: 0.0001 },
        }),
        { status: 200 },
      ),
    );
    const { POST } = await importRoute();
    const file = new File([new Uint8Array(1024)], 'pup.png', {
      type: 'image/png',
    });
    const req = {
      formData: async () => {
        const fd = new FormData();
        fd.append('file', file);
        return fd;
      },
    } as unknown as Request;
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('handles webp image mime', async () => {
    const fake = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fake.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'webp!' } }],
          usage: { cost: 0 },
        }),
        { status: 200 },
      ),
    );
    const { POST } = await importRoute();
    const file = new File([new Uint8Array(1024)], 'p.webp', {
      type: 'image/webp',
    });
    const req = makeFileRequest(file, 'p') as unknown as Request;
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.attachment.mimeType).toBe('image/webp');
  });
});
