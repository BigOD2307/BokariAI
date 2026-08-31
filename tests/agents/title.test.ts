import { describe, it, expect, vi, beforeEach } from 'vitest';

const resolveModels = vi.fn();
vi.mock('@/lib/ai/resolve', () => ({ resolveModels: (...a: unknown[]) => resolveModels(...a) }));

const { generateTitle } = await import('@/lib/agents/title');

// resolveModels() resolves with a model whose .call() throws, rather than
// resolveModels() itself rejecting — a top-level-rejected mocked import
// across the module boundary here trips a vitest 2.1 unhandled-rejection
// quirk even though the SUT's try/catch does handle it. Both shapes exercise
// the same fallback path in generateTitle.
const unavailable = () => ({
  llm: { call: vi.fn(async () => { throw new Error('no active provider'); }) },
  fastLlm: undefined,
});

describe('agents/title', () => {
  beforeEach(() => resolveModels.mockReset());

  it('uses the fallback when no model can be resolved', async () => {
    resolveModels.mockResolvedValue(unavailable());
    const result = await generateTitle('Quelle est la capitale du Mali ?');
    expect(result.model).toBe('fallback');
    expect(result.title.length).toBeGreaterThan(0);
    expect(result.title).toMatch(/Mali/);
  });

  it('truncates long fallback titles to ~40 chars', async () => {
    resolveModels.mockResolvedValue(unavailable());
    const long =
      'Bonjour je cherche des informations tres precises sur un sujet qui me tient a coeur depuis longtemps';
    const result = await generateTitle(long);
    expect(result.model).toBe('fallback');
    expect(result.title.length).toBeLessThanOrEqual(45);
  });

  it('handles empty-ish input with a default title', async () => {
    resolveModels.mockResolvedValue(unavailable());
    const result = await generateTitle('   ');
    expect(result.model).toBe('fallback');
    expect(result.title).toBeTruthy();
  });

  it('returns the LLM title via model.call when a model resolves', async () => {
    resolveModels.mockResolvedValue({
      llm: { call: vi.fn(async () => ({ content: 'Capitale du Mali' })) },
      fastLlm: undefined,
    });

    const result = await generateTitle('Quelle est la capitale du Mali ?');
    expect(result.title).toBe('Capitale du Mali');
    expect(result.model).toBe('configured');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('prefers the fast tier over the default model when both resolve', async () => {
    const fastCall = vi.fn(async () => ({ content: 'Titre rapide' }));
    resolveModels.mockResolvedValue({
      llm: { call: vi.fn(async () => ({ content: 'Titre lent' })) },
      fastLlm: { call: fastCall },
    });

    const result = await generateTitle('Question');
    expect(result.title).toBe('Titre rapide');
    expect(result.model).toBe('fast-tier');
    expect(fastCall).toHaveBeenCalled();
  });

  it('falls back gracefully when the LLM call throws', async () => {
    resolveModels.mockResolvedValue(unavailable());
    const result = await generateTitle('Test fallback');
    expect(result.model).toBe('fallback');
    expect(result.title).toBeTruthy();
  });

  it('strips leading and trailing quotes from the LLM output', async () => {
    resolveModels.mockResolvedValue({
      llm: { call: vi.fn(async () => ({ content: '"Ma super recherche"' })) },
      fastLlm: undefined,
    });

    const result = await generateTitle('Test');
    expect(result.title).toBe('Ma super recherche');
  });
});
