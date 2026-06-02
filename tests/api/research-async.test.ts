/**
 * @module api/research-async.test
 * @description Smoke tests for the /api/research-async endpoint.
 * @author Amadou — Dicken AI
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  }),
}));

vi.mock('@/lib/models/registry', () => ({
  default: class {
    async loadChatModel() {
      return { streamText: async function* () {} };
    }
    async loadEmbeddingModel() {
      return { embedText: async () => [[]] };
    }
  },
}));

vi.mock('@/lib/agents/search/async', () => ({
  runAsyncResearch: vi.fn(async () => {}),
}));

vi.mock('@/lib/db', () => ({
  default: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) },
}));

import { POST, GET } from '@/app/api/research-async/route';
import { _clearJobs, getJob, createJob } from '@/lib/jobs/research';

beforeEach(() => {
  _clearJobs();
});

const validBody = {
  message: {
    messageId: 'm1',
    chatId: 'c1',
    content: 'What is the capital of France?',
  },
  optimizationMode: 'balanced' as const,
  sources: ['web'],
  history: [],
  files: [],
  chatModel: { providerId: 'p1', key: 'k1' },
  embeddingModel: { providerId: 'p2', key: 'k2' },
  systemInstructions: '',
};

describe('POST /api/research-async', () => {
  it('rejects an empty message', async () => {
    const req = new Request('http://localhost/api/research-async', {
      method: 'POST',
      body: JSON.stringify({ ...validBody, message: { ...validBody.message, content: '' } }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('rejects an invalid body', async () => {
    const req = new Request('http://localhost/api/research-async', {
      method: 'POST',
      body: JSON.stringify({ message: { content: 'x' } }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 202 with a jobId for a valid body', async () => {
    const req = new Request('http://localhost/api/research-async', {
      method: 'POST',
      body: JSON.stringify(validBody),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.jobId).toBeTruthy();
    expect(body.status).toBe('pending');
  });
});

describe('GET /api/research-async', () => {
  it('400s when jobId is missing', async () => {
    const req = new Request('http://localhost/api/research-async');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('404s when jobId is unknown', async () => {
    const req = new Request('http://localhost/api/research-async?jobId=zzz');
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it('returns the current job state for a known id', async () => {
    const id = createJob({ test: 1 });
    const req = new Request(`http://localhost/api/research-async?jobId=${id}`);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jobId).toBe(id);
    expect(body.status).toBe('pending');
    expect(body.progress).toBeDefined();
  });

  it('returns the result when the job is complete', async () => {
    const id = createJob({});
    const { completeJob } = await import('@/lib/jobs/research');
    completeJob(id, { answer: 'paris', sources: [] });
    const req = new Request(`http://localhost/api/research-async?jobId=${id}`);
    const res = await GET(req);
    const body = await res.json();
    expect(body.status).toBe('completed');
    expect(body.result.answer).toBe('paris');
  });
});
