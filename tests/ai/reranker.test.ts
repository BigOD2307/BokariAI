/**
 * @module ai/reranker.test
 * @description Unit tests for the cross-encoder rerank module.
 *   Covers the OfflineReranker (deterministic, used in tests + CI)
 *   and the OpenRouterReranker (live, with mocked fetch).
 * @author Amadou — Dicken AI
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  OfflineReranker,
  OpenRouterReranker,
  getRerankConfig,
  type RerankDocument,
  type RerankResult,
} from '@/lib/ai/reranker';

describe('OfflineReranker', () => {
  const r = new OfflineReranker();

  it('returns empty array on empty input', async () => {
    expect(await r.rank('anything', [])).toEqual([]);
  });

  it('returns at most topN results', async () => {
    const docs: RerankDocument[] = Array.from({ length: 5 }, (_, i) => ({
      id: `d${i}`,
      text: `document number ${i}`,
    }));
    const out = await r.rank('document', docs, 3);
    expect(out).toHaveLength(3);
  });

  it('returns all docs when topN is undefined and input is small', async () => {
    const docs: RerankDocument[] = [
      { id: 'a', text: 'apple banana cherry' },
      { id: 'b', text: 'apple banana' },
      { id: 'c', text: 'kiwi lemon' },
    ];
    const out = await r.rank('apple', docs);
    expect(out).toHaveLength(3);
  });

  it('ranks docs with more token overlap higher', async () => {
    const docs: RerankDocument[] = [
      { id: 'weak', text: 'totally unrelated content about something else' },
      { id: 'strong', text: 'apple apple apple banana banana' },
      { id: 'medium', text: 'apple and oranges mix' },
    ];
    const out = await r.rank('apple banana', docs);
    // "strong" has all query tokens, "medium" has one, "weak" has none.
    expect(out[0]?.id).toBe('strong');
    expect(out[out.length - 1]?.id).toBe('weak');
  });

  it('returns results in descending score order', async () => {
    const docs: RerankDocument[] = [
      { id: 'a', text: 'a' },
      { id: 'b', text: 'b' },
      { id: 'c', text: 'c' },
      { id: 'd', text: 'd' },
    ];
    const out = await r.rank('a', docs);
    for (let i = 1; i < out.length; i++) {
      expect(out[i - 1]!.score).toBeGreaterThanOrEqual(out[i]!.score);
    }
  });

  it('produces deterministic scores for the same input', async () => {
    const docs: RerankDocument[] = [
      { id: 'a', text: 'alpha beta gamma' },
      { id: 'b', text: 'alpha' },
    ];
    const out1 = await r.rank('alpha beta', docs);
    const out2 = await r.rank('alpha beta', docs);
    expect(out1).toEqual(out2);
  });

  it('returns score in [0, 1]', async () => {
    const docs: RerankDocument[] = [
      { id: 'a', text: 'foo bar baz qux' },
      { id: 'b', text: 'foo bar' },
    ];
    const out = await r.rank('foo bar', docs);
    for (const x of out) {
      expect(x.score).toBeGreaterThanOrEqual(0);
      expect(x.score).toBeLessThanOrEqual(1);
    }
  });

  it('preserves the original index in the result', async () => {
    const docs: RerankDocument[] = [
      { id: 'a', text: 'apple' },
      { id: 'b', text: 'banana' },
      { id: 'c', text: 'cherry' },
    ];
    const out = await r.rank('banana', docs);
    // The "banana" doc was at index 1; the reranker should keep that.
    const banana = out.find((x) => x.id === 'b');
    expect(banana?.index).toBe(1);
  });

  it('is multilingual-friendly (no language-specific tokenisation)', async () => {
    const docs: RerankDocument[] = [
      { id: 'bambara', text: 'Mali kɛntɛri sera kongo' },
      { id: 'fr', text: 'Le président malien a prêté serment' },
      { id: 'unrelated', text: 'something else entirely' },
    ];
    const out = await r.rank('président malien', docs);
    // The FR doc has both query tokens; the Bambara doc has one.
    // The mock grader is token-based, not embedding-based, so it
    // won't catch the Bambara-FR semantic match.  We only assert
    // that the FR doc scores above the unrelated one.
    const fr = out.find((x) => x.id === 'fr')!;
    const unrelated = out.find((x) => x.id === 'unrelated')!;
    expect(fr.score).toBeGreaterThan(unrelated.score);
  });
});

describe('OpenRouterReranker', () => {
  const ORIGINAL_FETCH = global.fetch;

  beforeEach(() => {
    // Mock global.fetch — we want to assert what the reranker sends.
    global.fetch = vi.fn() as any;
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    vi.restoreAllMocks();
    delete process.env.OPENROUTER_API_KEY;
  });

  it('POSTs to the right URL with the right headers', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-test';
    const fakeFetch = global.fetch as any;
    fakeFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'or-test',
        model: 'baai/bge-reranker-v2-m3',
        provider: 'test',
        results: [
          { index: 0, relevance_score: 0.9, document: { text: 'a' } },
          { index: 1, relevance_score: 0.1, document: { text: 'b' } },
        ],
      }),
    });
    const r = new OpenRouterReranker({
      apiKey: 'sk-or-test',
      model: 'baai/bge-reranker-v2-m3',
    });
    await r.rank('query', [
      { id: 'a', text: 'doc a' },
      { id: 'b', text: 'doc b' },
    ], 2);

    expect(fakeFetch).toHaveBeenCalledOnce();
    const [url, init] = fakeFetch.mock.calls[0]!;
    expect(url).toBe('https://openrouter.ai/api/v1/rerank');
    expect(init.method).toBe('POST');
    expect(init.headers['Authorization']).toBe('Bearer sk-or-test');
    expect(init.headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      query: 'query',
      documents: ['doc a', 'doc b'],
      model: 'baai/bge-reranker-v2-m3',
      top_n: 2,
    });
  });

  it('maps the response into RerankResult[] (id, score, index)', async () => {
    const fakeFetch = global.fetch as any;
    fakeFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'or-test',
        model: 'baai/bge-reranker-v2-m3',
        provider: 'test',
        results: [
          { index: 1, relevance_score: 0.7, document: { text: 'b' } },
          { index: 0, relevance_score: 0.3, document: { text: 'a' } },
        ],
      }),
    });
    const r = new OpenRouterReranker({
      apiKey: 'sk-or-test',
      model: 'baai/bge-reranker-v2-m3',
    });
    const out = await r.rank('q', [
      { id: 'a', text: 'doc a' },
      { id: 'b', text: 'doc b' },
    ], 2);
    expect(out).toEqual([
      { id: 'b', score: 0.7, index: 1 },
      { id: 'a', score: 0.3, index: 0 },
    ]);
  });

  it('passes top_n=undefined when topN is undefined (returns all)', async () => {
    const fakeFetch = global.fetch as any;
    fakeFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        model: 'baai/bge-reranker-v2-m3',
        results: [
          { index: 0, relevance_score: 0.5, document: { text: 'a' } },
        ],
      }),
    });
    const r = new OpenRouterReranker({
      apiKey: 'sk-or-test',
      model: 'baai/bge-reranker-v2-m3',
    });
    await r.rank('q', [{ id: 'a', text: 'a' }]);
    const body = JSON.parse(fakeFetch.mock.calls[0]![1].body);
    expect(body.top_n).toBeUndefined();
  });

  it('retries on 5xx then succeeds', async () => {
    const fakeFetch = global.fetch as any;
    fakeFetch
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ error: 'down' }) })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'oops' }) })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({
          model: 'baai/bge-reranker-v2-m3',
          results: [{ index: 0, relevance_score: 0.9, document: { text: 'a' } }],
        }),
      });
    const r = new OpenRouterReranker({
      apiKey: 'sk-or-test',
      model: 'baai/bge-reranker-v2-m3',
    });
    const out = await r.rank('q', [{ id: 'a', text: 'a' }]);
    expect(fakeFetch).toHaveBeenCalledTimes(3);
    expect(out).toEqual([{ id: 'a', score: 0.9, index: 0 }]);
  });

  it('retries on 429 then succeeds', async () => {
    const fakeFetch = global.fetch as any;
    fakeFetch
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({ error: 'rate limit' }) })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({
          model: 'baai/bge-reranker-v2-m3',
          results: [{ index: 0, relevance_score: 0.8, document: { text: 'a' } }],
        }),
      });
    const r = new OpenRouterReranker({
      apiKey: 'sk-or-test',
      model: 'baai/bge-reranker-v2-m3',
    });
    const out = await r.rank('q', [{ id: 'a', text: 'a' }]);
    expect(fakeFetch).toHaveBeenCalledTimes(2);
    expect(out[0]?.score).toBe(0.8);
  });

  it('does not retry on 4xx (auth, bad request) — hard error', async () => {
    const fakeFetch = global.fetch as any;
    fakeFetch.mockResolvedValueOnce({
      ok: false, status: 401,
      json: async () => ({ error: { message: 'unauthorized' } }),
    });
    const r = new OpenRouterReranker({
      apiKey: 'sk-or-test',
      model: 'baai/bge-reranker-v2-m3',
    });
    await expect(r.rank('q', [{ id: 'a', text: 'a' }])).rejects.toThrow(/401|unauthorized/i);
    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });

  it('throws after exhausting all retries on persistent 5xx', async () => {
    const fakeFetch = global.fetch as any;
    fakeFetch.mockResolvedValue({
      ok: false, status: 500,
      json: async () => ({ error: 'still down' }),
    });
    const r = new OpenRouterReranker({
      apiKey: 'sk-or-test',
      model: 'baai/bge-reranker-v2-m3',
    });
    await expect(r.rank('q', [{ id: 'a', text: 'a' }])).rejects.toThrow();
    expect(fakeFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('sends the same number of documents it received', async () => {
    const fakeFetch = global.fetch as any;
    fakeFetch.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ model: 'x', results: [] }),
    });
    const r = new OpenRouterReranker({
      apiKey: 'sk-or-test',
      model: 'baai/bge-reranker-v2-m3',
    });
    const docs: RerankDocument[] = Array.from({ length: 50 }, (_, i) => ({
      id: `d${i}`, text: `text ${i}`,
    }));
    await r.rank('q', docs);
    const body = JSON.parse(fakeFetch.mock.calls[0]![1].body);
    expect(body.documents).toHaveLength(50);
  });
});

describe('getRerankConfig', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore env to a known state.
    for (const k of Object.keys(process.env)) {
      if (!Object.prototype.hasOwnProperty.call(originalEnv, k)) {
        delete process.env[k];
      }
    }
    for (const [k, v] of Object.entries(originalEnv)) {
      process.env[k] = v;
    }
  });

  it('returns the curated defaults when no env vars are set', () => {
    delete process.env.BOKARI_RERANK_MODEL;
    delete process.env.BOKARI_RERANK_PROVIDER;
    const cfg = getRerankConfig();
    expect(cfg.provider).toBe('openrouter');
    expect(cfg.model).toBe('baai/bge-reranker-v2-m3');
    expect(cfg.enabled).toBe(false);
  });

  it('honours BOKARI_RERANK_MODEL env var', () => {
    process.env.BOKARI_RERANK_MODEL = 'cohere/rerank-v3.5';
    const cfg = getRerankConfig();
    expect(cfg.model).toBe('cohere/rerank-v3.5');
  });

  it('honours BOKARI_RERANK_ENABLED=true to flip the switch', () => {
    process.env.BOKARI_RERANK_ENABLED = 'true';
    const cfg = getRerankConfig();
    expect(cfg.enabled).toBe(true);
  });

  it('defaults enabled to false (opt-in)', () => {
    delete process.env.BOKARI_RERANK_ENABLED;
    const cfg = getRerankConfig();
    expect(cfg.enabled).toBe(false);
  });
});
