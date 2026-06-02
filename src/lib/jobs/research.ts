/**
 * @module jobs/research
 * @description In-memory background-job queue for long-running
 * research tasks.  Used by the `/api/research-async` endpoint to
 * decouple the user's request from the slow search → read → write
 * chain — a researcher-heavy query can take 30-60s and we don't
 * want to hold the SSE stream open that long.
 *
 * Job lifecycle:
 *   1. `createJob(input)` — mint a new job id, status = 'pending'.
 *   2. Caller kicks off the actual work; once it starts, calls
 *      `setProgress(id, { stage, percent })` to update the UI.
 *   3. On success: `completeJob(id, result)`.  On error:
 *      `failJob(id, error)`.
 *
 * Storage:
 *   - Plain `Map` keyed by job id, capped at `MAX_JOBS` entries.
 *   - Auto-pruned by `MAX_AGE_MS` (1h) on insert.
 *
 * The map is module-scoped (per Node process) and HMR-friendly via
 * `globalThis` indirection.  In serverless deploys the warm
 * container shares the map; a cold start starts empty and the
 * pending jobs are simply lost — fine because the user can re-poll
 * or restart.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export type ResearchJobInput = Record<string, unknown>;

export type ResearchJob = {
  id: string;
  status: JobStatus;
  input: ResearchJobInput;
  progress: {
    stage: string;
    percent: number;
    message?: string;
  };
  result?: {
    answer: string;
    sources: Array<{ title: string; url: string; snippet: string }>;
  };
  error?: string;
  createdAt: number;
  updatedAt: number;
};

/** Cap on stored jobs.  When we exceed this, the oldest completed
 *  job is dropped.  100 is generous — the typical "burst" is a
 *  single user doing a deep search. */
const MAX_JOBS = 100;

/** Auto-prune age.  Jobs older than this are dropped on the next
 *  insert, regardless of status.  1h. */
const MAX_AGE_MS = 60 * 60 * 1000;

const jobStore: Map<string, ResearchJob> = (() => {
  const g = globalThis as unknown as { _bokariResearchJobs?: Map<string, ResearchJob> };
  if (!g._bokariResearchJobs) g._bokariResearchJobs = new Map();
  return g._bokariResearchJobs;
})();

function nowMs(): number {
  return Date.now();
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `job-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function touch(job: ResearchJob): ResearchJob {
  job.updatedAt = nowMs();
  return job;
}

function prune(): void {
  const cutoff = nowMs() - MAX_AGE_MS;
  for (const [id, job] of jobStore) {
    if (job.updatedAt < cutoff) jobStore.delete(id);
  }
  // Cap total entries — drop oldest completed/failed first.
  if (jobStore.size > MAX_JOBS) {
    const ordered = Array.from(jobStore.values()).sort(
      (a, b) => a.updatedAt - b.updatedAt,
    );
    while (jobStore.size > MAX_JOBS) {
      const oldest = ordered.shift();
      if (!oldest) break;
      jobStore.delete(oldest.id);
    }
  }
}

/** Create a new job.  Returns the new id. */
export function createJob(input: ResearchJobInput): string {
  prune();
  const id = newId();
  const job: ResearchJob = {
    id,
    status: 'pending',
    input,
    progress: { stage: 'queued', percent: 0 },
    createdAt: nowMs(),
    updatedAt: nowMs(),
  };
  jobStore.set(id, job);
  return id;
}

/** Look up a job by id.  Returns null if unknown / pruned. */
export function getJob(id: string): ResearchJob | null {
  return jobStore.get(id) ?? null;
}

/** Update the progress of a running job.  Sets status to 'running'
 *  if it was 'pending'.  No-op if the job is already in a terminal
 *  state ('completed' / 'failed'). */
export function setProgress(
  id: string,
  progress: { stage: string; percent: number; message?: string },
): void {
  const job = jobStore.get(id);
  if (!job) return;
  if (job.status === 'completed' || job.status === 'failed') return;
  if (job.status === 'pending') job.status = 'running';
  job.progress = progress;
  touch(job);
}

/** Mark a job as completed and stash the result. */
export function completeJob(
  id: string,
  result: ResearchJob['result'],
): void {
  const job = jobStore.get(id);
  if (!job) return;
  job.status = 'completed';
  job.result = result;
  job.progress = { stage: 'done', percent: 100 };
  touch(job);
  prune();
}

/** Mark a job as failed and stash the error message. */
export function failJob(id: string, error: string): void {
  const job = jobStore.get(id);
  if (!job) return;
  job.status = 'failed';
  job.error = error;
  job.progress = { stage: 'error', percent: 0 };
  touch(job);
  prune();
}

/** Test-only: clear the entire store.  Never call from prod. */
export function _clearJobs(): void {
  jobStore.clear();
}

/** Test-only: number of stored jobs. */
export function _jobCount(): number {
  return jobStore.size;
}
