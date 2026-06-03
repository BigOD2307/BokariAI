import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateTitle } from '@/lib/agents/title';

describe('agents/title', () => {
  const originalEnv = process.env.OPENAI_API_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    if (originalEnv) process.env.OPENAI_API_KEY = originalEnv;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('uses the fallback when OPENAI_API_KEY is not set', async () => {
    const result = await generateTitle('Quelle est la capitale du Mali ?');
    expect(result.model).toBe('fallback');
    expect(result.title.length).toBeGreaterThan(0);
    expect(result.title).toMatch(/Mali/);
  });

  it('truncates long fallback titles to ~40 chars', async () => {
    const long = 'Bonjour je cherche des informations tres precises sur un sujet qui me tient a coeur depuis longtemps';
    const result = await generateTitle(long);
    expect(result.model).toBe('fallback');
    expect(result.title.length).toBeLessThanOrEqual(45);
  });

  it('handles empty-ish input with a default title', async () => {
    const result = await generateTitle('   ');
    expect(result.model).toBe('fallback');
    expect(result.title).toBeTruthy();
  });

  it('returns the LLM title when fetch returns a completion', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'Capitale du Mali' } }],
      }),
    })) as unknown as typeof fetch;

    const result = await generateTitle('Quelle est la capitale du Mali ?');
    expect(result.model).toBe('gpt-4o-mini');
    expect(result.title).toBe('Capitale du Mali');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('falls back gracefully when the LLM call throws', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    global.fetch = vi.fn(async () => {
      throw new Error('OpenAI down');
    }) as unknown as typeof fetch;

    const result = await generateTitle('Test fallback');
    expect(result.model).toBe('fallback');
    expect(result.title).toBeTruthy();
  });

  it('strips leading and trailing quotes from the LLM output', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '"Ma super recherche"' } }],
      }),
    })) as unknown as typeof fetch;

    const result = await generateTitle('Test');
    expect(result.title).toBe('Ma super recherche');
  });
});
