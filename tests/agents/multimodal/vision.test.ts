import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  analyseImage,
  VisionRouterError,
  DEFAULT_VISION_CONFIG,
} from '@/lib/agents/multimodal/router';
import type { Attachment } from '@/lib/types/multimodal';

const ATT: Attachment = {
  id: 'a1',
  kind: 'image',
  filename: 'cat.png',
  mimeType: 'image/png',
  sizeBytes: 1024,
  dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
  uploadedAt: 0,
};

interface MockResponseInit {
  ok: boolean;
  status: number;
  body: object;
}

function jsonResponse({ ok, status, body }: MockResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }) as Response;
}

describe('vision.ts low-level', () => {
  const ORIGINAL_FETCH = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
  });

  it('POSTs to OpenRouter with image_url + text content', async () => {
    const fake = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fake.mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        status: 200,
        body: {
          choices: [{ message: { content: 'A cat' } }],
          usage: { cost: 0.0001 },
        },
      }),
    );
    const { callOpenRouterVision } = await import(
      '@/lib/agents/multimodal/vision'
    );
    const out = await callOpenRouterVision({
      model: 'google/gemini-2.5-flash',
      prompt: 'What is in this image?',
      imageDataUrl: ATT.dataUrl,
      apiKey: 'sk-or-test',
    });
    expect(out.text).toBe('A cat');
    expect(out.costUsd).toBeCloseTo(0.0001);
    expect(fake).toHaveBeenCalledOnce();
    const [url, init] = fake.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('openrouter.ai/api/v1/chat/completions');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('google/gemini-2.5-flash');
    expect(body.messages[0].content).toHaveLength(2);
    expect(body.messages[0].content[0].type).toBe('text');
    expect(body.messages[0].content[1].type).toBe('image_url');
    expect(body.messages[0].content[1].image_url.url).toBe(ATT.dataUrl);
  });

  it('throws on non-OK response', async () => {
    const fake = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fake.mockResolvedValueOnce(
      new Response('upstream down', { status: 502 }) as Response,
    );
    const { callOpenRouterVision } = await import(
      '@/lib/agents/multimodal/vision'
    );
    await expect(
      callOpenRouterVision({
        model: 'm',
        prompt: 'p',
        imageDataUrl: ATT.dataUrl,
        apiKey: 'k',
      }),
    ).rejects.toThrow(/502/);
  });
});

describe('analyseImage (router)', () => {
  const ORIGINAL_FETCH = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
  });

  it('calls primary model first and returns its text', async () => {
    const fake = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fake.mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        status: 200,
        body: {
          choices: [{ message: { content: 'A cat on a chair' } }],
          usage: { cost: 0.0002 },
        },
      }),
    );
    const result = await analyseImage(ATT, 'Describe', 'sk-or-test');
    expect(result.description).toBe('A cat on a chair');
    expect(result.model).toBe(DEFAULT_VISION_CONFIG.primaryModel);
    expect(result.costUsd).toBeCloseTo(0.0002);
    expect(result.attachmentId).toBe('a1');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(fake).toHaveBeenCalledOnce();
  });

  it('falls back to secondary model on primary failure', async () => {
    const fake = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fake.mockResolvedValueOnce(
      new Response('boom', { status: 500 }) as Response,
    );
    fake.mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        status: 200,
        body: {
          choices: [{ message: { content: 'Fallback description' } }],
          usage: { cost: 0.005 },
        },
      }),
    );
    const result = await analyseImage(ATT, 'Describe', 'sk-or-test');
    expect(result.model).toBe(DEFAULT_VISION_CONFIG.fallbackModel);
    expect(result.description).toBe('Fallback description');
    expect(fake).toHaveBeenCalledTimes(2);
  });

  it('throws VisionRouterError when both models fail', async () => {
    const fake = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fake.mockResolvedValue(new Response('nope', { status: 500 }) as Response);
    await expect(analyseImage(ATT, 'Describe', 'k')).rejects.toBeInstanceOf(
      VisionRouterError,
    );
    expect(fake).toHaveBeenCalledTimes(2);
  });
});
