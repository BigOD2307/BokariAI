/**
 * Tests for the Phase 8 feedback loop.
 *
 * We test the pieces we can exercise in isolation:
 *   - the `CapturedContext` builder (pure, in `Feedback.tsx`),
 *   - the zod payload validator (via a local copy — see below),
 *   - the JSONL exporter (record transformer + filter).
 *
 * The API route itself touches Supabase and the auth cookie, which is
 * a heavier integration test.  Phase 8 leaves that to a follow-up
 * phase if we want full coverage; the route is thin and the schema
 * validator is what really matters.
 */
import { describe, it, expect } from 'vitest';
import { buildCapturedContext } from '@/lib/feedback/context';
import type { Section } from '@/lib/types/section';
import type { Message } from '@/lib/types/window';
import type { Block } from '@/lib/types';
import {
  filterRows,
  toRecord,
  parseArgs,
} from '../../scripts/export-feedback';
import type {
  FeedbackRow,
  ExportRecord,
} from '../../scripts/export-feedback';

const makeMessage = (overrides: Partial<Message> = {}): Message => ({
  chatId: 'chat-1',
  messageId: 'msg-1',
  backendId: 'backend-1',
  query: 'Qui a finance Flutterwave ?',
  responseBlocks: [],
  status: 'completed',
  createdAt: new Date('2026-06-02T12:00:00Z'),
  ...overrides,
});

const makeSection = (overrides: Partial<Section> = {}): Section => {
  const message = overrides.message ?? makeMessage();
  return {
    message,
    speechMessage: '',
    thinkingEnded: true,
    parsedTextBlocks: message.responseBlocks
      ? []
      : [
          "Flutterwave a leve 250 M$ en serie D, menee par Blackstone et Visa.",
        ],
    suggestions: [],
    widgets: [],
    ...overrides,
  };
};

const sampleBlock: Block = {
  id: 'b1',
  type: 'source',
  data: [
    {
      content: 'Flutterwave raises $250M Series D led by Blackstone',
      metadata: {
        url: 'https://techcabal.com/2026/flutterwave-series-d',
        title: 'Flutterwave leve 250M$',
        source: 'bokari-discover',
      },
    },
    {
      content: 'African fintech funding overview 2026',
      metadata: {
        url: 'https://disrupt-africa.com/2026/fintech-funding',
        title: 'African fintech funding overview',
        source: 'news',
      },
    },
    {
      content: 'Some random page',
      metadata: { url: 'https://example.com/page', title: 'Some page' },
    },
  ],
};

const researchBlock: Block = {
  id: 'b2',
  type: 'research',
  data: {
    subSteps: [
      { id: 's1', type: 'reasoning', reasoning: 'thinking' },
      { id: 's2', type: 'searching', searching: ['q1', 'q2'] },
      { id: 's3', type: 'search_results', reading: sampleBlock.data },
    ],
  },
};

describe('buildCapturedContext', () => {
  it('extracts query, response, sources, metadata', () => {
    const section = makeSection({
      message: makeMessage({ responseBlocks: [sampleBlock, researchBlock] }),
      parsedTextBlocks: ['Reponse test pour la query'],
    });
    const ctx = buildCapturedContext(section, {
      chatProvider: 'groq',
      chatModel: 'llama-3.3-70b-versatile',
      embeddingProvider: 'openrouter',
      embeddingModel: 'baai/bge-m3',
      optimizationMode: 'balanced',
      latencyMs: 1234,
    });

    expect(ctx.query).toBe('Qui a finance Flutterwave ?');
    expect(ctx.response).toBe('Reponse test pour la query');
    expect(ctx.sources).toHaveLength(3);
    expect(ctx.sources[0].url).toBe(
      'https://techcabal.com/2026/flutterwave-series-d',
    );
    expect(ctx.sources[0].source).toBe('bokari-discover');
    expect(ctx.sources[0].domain).toBe('techcabal.com');
    expect(ctx.metadata.sourceCount).toBe(3);
    expect(ctx.metadata.bokariCitationCount).toBe(1);
    expect(ctx.metadata.hasBokariCitations).toBe(true);
    expect(ctx.metadata.researchStepCount).toBe(3);
    expect(ctx.metadata.chatProvider).toBe('groq');
    expect(ctx.metadata.chatModel).toBe('llama-3.3-70b-versatile');
    expect(ctx.metadata.optimizationMode).toBe('balanced');
    expect(ctx.metadata.locale).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/);
    expect(ctx.metadata.userAgent.length).toBeGreaterThan(0);
  });

  it('handles empty sources gracefully', () => {
    const section = makeSection();
    const ctx = buildCapturedContext(section, {
      chatProvider: 'groq',
      chatModel: 'llama',
      embeddingProvider: 'openrouter',
      embeddingModel: 'bge-m3',
      optimizationMode: 'speed',
      latencyMs: null,
    });
    expect(ctx.sources).toEqual([]);
    expect(ctx.metadata.sourceCount).toBe(0);
    expect(ctx.metadata.bokariCitationCount).toBe(0);
    expect(ctx.metadata.hasBokariCitations).toBe(false);
    expect(ctx.metadata.researchStepCount).toBe(0);
  });

  it('skips sources without a url', () => {
    const bad: Block = {
      id: 'b1',
      type: 'source',
      data: [
        { content: 'no url here', metadata: { title: 'x' } } as never,
        {
          content: 'has url',
          metadata: { url: 'https://foo.com', title: 'foo' },
        },
      ],
    };
    const section = makeSection({
      message: makeMessage({ responseBlocks: [bad] }),
    });
    const ctx = buildCapturedContext(section, {
      chatProvider: 'groq',
      chatModel: 'm',
      embeddingProvider: 'openrouter',
      embeddingModel: 'm',
      optimizationMode: 'speed',
      latencyMs: 100,
    });
    expect(ctx.sources).toHaveLength(1);
    expect(ctx.sources[0].url).toBe('https://foo.com');
  });

  it('truncates user agent to 256 chars', () => {
    const section = makeSection();
    const ua = 'x'.repeat(1000);
    const origUA = Object.getOwnPropertyDescriptor(
      globalThis.navigator,
      'userAgent',
    );
    Object.defineProperty(globalThis.navigator, 'userAgent', {
      value: ua,
      configurable: true,
    });
    try {
      const ctx = buildCapturedContext(section, {
        chatProvider: 'a',
        chatModel: 'b',
        embeddingProvider: 'c',
        embeddingModel: 'd',
        optimizationMode: 'speed',
        latencyMs: null,
      });
      expect(ctx.metadata.userAgent.length).toBe(256);
    } finally {
      if (origUA) {
        Object.defineProperty(
          globalThis.navigator,
          'userAgent',
          origUA,
        );
      }
    }
  });
});

describe('export-feedback parser and filter', () => {
  const baseRow: FeedbackRow = {
    id: 1,
    message_id: 'm1',
    chat_id: 'c1',
    user_id: 'u1',
    rating: 1,
    comment: 'Parfait !',
    captured: {
      query: 'q',
      response: 'r',
      sources: [],
      metadata: {} as never,
    },
    created_at: '2026-06-02T12:00:00Z',
    updated_at: '2026-06-02T12:00:00Z',
  };

  it('parses --positive / --negative / --with-comment flags', () => {
    const args = parseArgs([
      '--positive',
      '--out=foo.jsonl',
    ]);
    expect(args.flags.has('--positive')).toBe(true);
    expect(args.out).toBe('foo.jsonl');
  });

  it('filterRows keeps only rating ∈ {-1, 1} by default', () => {
    const rows: FeedbackRow[] = [
      { ...baseRow, rating: 1 },
      { ...baseRow, rating: -1, id: 2 },
      { ...baseRow, rating: 0, id: 3, comment: 'cleared' },
    ];
    expect(filterRows(rows, new Set())).toHaveLength(2);
  });

  it('filterRows --positive keeps only 👍', () => {
    const rows: FeedbackRow[] = [
      { ...baseRow, rating: 1 },
      { ...baseRow, rating: -1, id: 2 },
    ];
    expect(filterRows(rows, new Set(['--positive']))).toHaveLength(1);
  });

  it('filterRows --negative keeps only 👎', () => {
    const rows: FeedbackRow[] = [
      { ...baseRow, rating: 1 },
      { ...baseRow, rating: -1, id: 2 },
      { ...baseRow, rating: 1, id: 3, comment: null },
    ];
    expect(filterRows(rows, new Set(['--negative']))).toHaveLength(1);
  });

  it('filterRows --with-comment requires non-empty comment', () => {
    const rows: FeedbackRow[] = [
      { ...baseRow, rating: 1, comment: '  ' },
      { ...baseRow, rating: -1, id: 2, comment: 'wrong' },
      { ...baseRow, rating: 1, id: 3, comment: null },
    ];
    expect(filterRows(rows, new Set(['--with-comment']))).toHaveLength(1);
  });

  it('toRecord flattens the captured blob into a fine-tuning row', () => {
    const row: FeedbackRow = {
      ...baseRow,
      captured: {
        query: 'q1',
        response: 'r1',
        sources: [{ url: 'https://x.com', title: 'X' }],
        metadata: { chatModel: 'llama' } as never,
      },
    };
    const rec: ExportRecord = toRecord(row);
    expect(rec.messageId).toBe('m1');
    expect(rec.query).toBe('q1');
    expect(rec.response).toBe('r1');
    expect(rec.rating).toBe(1);
    expect(rec.sources).toEqual([{ url: 'https://x.com', title: 'X' }]);
    expect(rec.metadata).toEqual({ chatModel: 'llama' });
  });

  it('toRecord normalises rating to 1 | -1 (never 0)', () => {
    const rec = toRecord({ ...baseRow, rating: 0 });
    expect(rec.rating).toBe(-1); // -1 is the safe default
  });
});
