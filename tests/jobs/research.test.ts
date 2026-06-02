/**
 * @module jobs/research.test
 * @description Unit tests for the in-memory research-job store.
 * @author Amadou — Dicken AI
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createJob,
  getJob,
  setProgress,
  completeJob,
  failJob,
  _clearJobs,
  _jobCount,
} from '@/lib/jobs/research';

beforeEach(() => {
  _clearJobs();
});

describe('createJob', () => {
  it('mints a new id and stores a pending job', () => {
    const id = createJob({ chatId: 'c1' });
    expect(id).toBeTruthy();
    const job = getJob(id);
    expect(job).not.toBeNull();
    expect(job!.status).toBe('pending');
    expect(job!.input).toEqual({ chatId: 'c1' });
  });

  it('returns distinct ids', () => {
    const a = createJob({});
    const b = createJob({});
    expect(a).not.toBe(b);
  });
});

describe('setProgress', () => {
  it('flips a pending job to running on first progress', () => {
    const id = createJob({});
    setProgress(id, { stage: 'classifier', percent: 5 });
    const job = getJob(id)!;
    expect(job.status).toBe('running');
    expect(job.progress.stage).toBe('classifier');
    expect(job.progress.percent).toBe(5);
  });

  it('keeps an already-running job running', () => {
    const id = createJob({});
    setProgress(id, { stage: 'a', percent: 1 });
    setProgress(id, { stage: 'b', percent: 2 });
    expect(getJob(id)!.status).toBe('running');
    expect(getJob(id)!.progress.stage).toBe('b');
  });

  it('is a no-op on an unknown id', () => {
    setProgress('does-not-exist', { stage: 'x', percent: 0 });
    expect(getJob('does-not-exist')).toBeNull();
  });

  it('is a no-op on a completed job', () => {
    const id = createJob({});
    completeJob(id, { answer: 'done', sources: [] });
    setProgress(id, { stage: 'late', percent: 99 });
    const job = getJob(id)!;
    expect(job.status).toBe('completed');
    expect(job.progress.stage).toBe('done');
  });
});

describe('completeJob', () => {
  it('stores the result and marks completed', () => {
    const id = createJob({});
    completeJob(id, { answer: 'paris', sources: [{ title: 't', url: 'u', snippet: 's' }] });
    const job = getJob(id)!;
    expect(job.status).toBe('completed');
    expect(job.result?.answer).toBe('paris');
    expect(job.progress.percent).toBe(100);
  });
});

describe('failJob', () => {
  it('stores the error and marks failed', () => {
    const id = createJob({});
    failJob(id, 'oh no');
    const job = getJob(id)!;
    expect(job.status).toBe('failed');
    expect(job.error).toBe('oh no');
  });
});

describe('getJob', () => {
  it('returns null for an unknown id', () => {
    expect(getJob('nope')).toBeNull();
  });
});

describe('store hygiene', () => {
  it('caps the store at MAX_JOBS', () => {
    for (let i = 0; i < 150; i++) {
      const id = createJob({ i });
      completeJob(id, { answer: 'a', sources: [] });
    }
    // MAX_JOBS is 100 — we should drop ~50 oldest.
    expect(_jobCount()).toBeLessThanOrEqual(100);
  });
});
