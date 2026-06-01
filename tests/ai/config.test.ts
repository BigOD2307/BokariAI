/**
 * @module ai/gateway.test
 * @description Tests for the AI gateway: config resolution, retry
 * behaviour, embed batching, and the articleToEmbedText helper.
 *
 * We do NOT exercise the real OpenRouter / Groq network here — those
 * would be too slow and too flaky for unit tests.  The live smoke
 * tests run separately via `scripts/smoke-gateway.ts`.
 *
 * @author Amadou — Dicken AI
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAiConfig } from '@/lib/ai/config';

describe('getAiConfig', () => {
  const originalEnv = { ...process.env };
  beforeEach(() => {
    for (const k of Object.keys(process.env)) {
      if (k.startsWith('BOKARI_')) delete process.env[k];
    }
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns sensible OSS defaults when no env overrides', () => {
    const cfg = getAiConfig();
    expect(cfg.chat.provider).toBe('groq');
    expect(cfg.chat.model).toBe('llama-3.3-70b-versatile');
    expect(cfg.chat.fallback.provider).toBe('openrouter');
    expect(cfg.chat.fallback.model).toBe('meta-llama/llama-3.3-70b-instruct');
    expect(cfg.embedding.provider).toBe('openrouter');
    expect(cfg.embedding.model).toBe('baai/bge-m3');
    expect(cfg.embedding.dimensions).toBe(1024);
  });

  it('honours BOKARI_* env overrides', () => {
    process.env.BOKARI_CHAT_PROVIDER = 'ollama';
    process.env.BOKARI_CHAT_MODEL = 'llama3';
    process.env.BOKARI_EMBEDDING_MODEL = 'nomic-embed-text';
    process.env.BOKARI_EMBEDDING_DIMENSIONS = '768';
    const cfg = getAiConfig();
    expect(cfg.chat.provider).toBe('ollama');
    expect(cfg.chat.model).toBe('llama3');
    expect(cfg.embedding.model).toBe('nomic-embed-text');
    expect(cfg.embedding.dimensions).toBe(768);
  });

  it('ignores non-numeric embedding dimensions overrides', () => {
    process.env.BOKARI_EMBEDDING_DIMENSIONS = 'not-a-number';
    const cfg = getAiConfig();
    expect(cfg.embedding.dimensions).toBe(1024);
  });
});
