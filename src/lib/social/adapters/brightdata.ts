/**
 * @module social/adapters/brightdata
 * @description PRIMARY high-quality social provider, backed by Bright Data's
 * Web Scraper API (the pre-built per-platform "datasets"). One uniform REST
 * surface (`api.brightdata.com/datasets/v3/...`), one Bearer key, parameterized
 * by `dataset_id` + `discover_by`. We use *discover* mode (keyword → recent
 * public posts) which maps onto Bokari's "query → results" contract.
 *
 * Flow: trigger (POST /datasets/v3/trigger) → poll progress
 * (GET /datasets/v3/progress/<snapshot_id>) → download (GET
 * /datasets/v3/snapshot/<snapshot_id>). Records are normalized to the shared
 * `SearchResult` shape.
 *
 * Graceful by construction: if no key/dataset is configured, or anything
 * throws/times out, we fall back to the site adapter and NEVER throw — a
 * degraded primary must not break a research turn. Bright Data latency is
 * seconds-to-minutes, so this belongs on the async-research path, not the SSE
 * chat hot path (see docs note in the implementation brief).
 */
import type { SearchResult } from '@/lib/search';
import type {
  SocialNetwork,
  SocialProvider,
  SocialSearchOptions,
  SocialSearchResult,
} from '../types';
import { createSiteProvider } from './site';

const API_BASE = 'https://api.brightdata.com';

/** Per-network env var holding the Bright Data `gd_…` dataset id. */
const DATASET_ENV: Record<SocialNetwork, string> = {
  x: 'BRIGHTDATA_DS_X_POSTS',
  reddit: 'BRIGHTDATA_DS_REDDIT_POSTS',
  linkedin: 'BRIGHTDATA_DS_LINKEDIN_POSTS',
};

const apiKey = (): string | null => process.env.BRIGHTDATA_API_KEY?.trim() || null;
const datasetId = (network: SocialNetwork): string | null =>
  process.env[DATASET_ENV[network]]?.trim() || null;

/**
 * True when Bright Data can serve this network (key + dataset id present).
 * The router consults this to fall back to `site` BEFORE constructing the
 * adapter, but the adapter re-checks so it is safe to call directly.
 */
export const isBrightDataConfigured = (network: SocialNetwork): boolean =>
  Boolean(apiKey() && datasetId(network));

/** Poll cadence and overall budget. Kept short to respect the agent timeouts
 *  (the snapshot is small — we cap inputs to a handful of posts). Tunable via
 *  env so ops can widen it for the async path without a deploy. */
const POLL_INTERVAL_MS = Number(process.env.BRIGHTDATA_POLL_INTERVAL_MS) || 4000;
const POLL_TIMEOUT_MS = Number(process.env.BRIGHTDATA_POLL_TIMEOUT_MS) || 45000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const authHeaders = (key: string) => ({
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
});

/** Pick the first non-empty string field from a record. */
const pick = (rec: Record<string, unknown>, keys: string[]): string => {
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
};

/**
 * Normalize one Bright Data record to a `SearchResult`. The social datasets
 * share enough field naming (url/title/text/description) that a tolerant
 * field-picker covers X, Reddit, and LinkedIn posts without per-network code.
 */
const normalizeRecord = (rec: Record<string, unknown>): SearchResult | null => {
  const url = pick(rec, ['url', 'post_url', 'link', 'permalink']);
  if (!url) return null;
  const content = pick(rec, [
    'description',
    'text',
    'post_text',
    'content',
    'body',
    'snippet',
    'caption',
  ]);
  const title =
    pick(rec, ['title', 'headline', 'name', 'user_posted', 'author']) ||
    content.slice(0, 120) ||
    url;
  const author = pick(rec, ['user_posted', 'author', 'profile_name', 'name']);
  const thumbnail = pick(rec, ['photo', 'image', 'thumbnail', 'avatar']);
  const out: SearchResult = { title, url };
  if (content) out.content = content;
  if (author) out.author = author;
  if (thumbnail) {
    out.thumbnail = thumbnail;
    out.img_src = thumbnail;
  }
  return out;
};

/** Trigger a discover-by-keyword snapshot. Returns the snapshot id or null. */
const trigger = async (
  key: string,
  dataset: string,
  query: string,
  limit: number,
): Promise<string | null> => {
  const params = new URLSearchParams({
    dataset_id: dataset,
    type: 'discover_new',
    discover_by: 'keyword',
    limit_per_input: String(limit),
    format: 'json',
    include_errors: 'true',
  });
  const res = await fetch(`${API_BASE}/datasets/v3/trigger?${params}`, {
    method: 'POST',
    headers: authHeaders(key),
    body: JSON.stringify([{ keyword: query, num_of_posts: limit }]),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { snapshot_id?: string };
  return json.snapshot_id ?? null;
};

/** Poll progress until ready/failed or the budget elapses. */
const waitReady = async (key: string, snapshotId: string): Promise<boolean> => {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await fetch(`${API_BASE}/datasets/v3/progress/${snapshotId}`, {
      headers: authHeaders(key),
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const json = (await res.json()) as { status?: string };
      if (json.status === 'ready') return true;
      if (json.status === 'failed') return false;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  return false;
};

/** Download a ready snapshot as a JSON array of records. */
const download = async (
  key: string,
  snapshotId: string,
): Promise<Record<string, unknown>[]> => {
  const res = await fetch(
    `${API_BASE}/datasets/v3/snapshot/${snapshotId}?format=json`,
    { headers: authHeaders(key), signal: AbortSignal.timeout(20000) },
  );
  // 202 = still processing despite "ready"; treat as empty rather than retry-storm.
  if (res.status !== 200) return [];
  const json = await res.json();
  return Array.isArray(json) ? (json as Record<string, unknown>[]) : [];
};

/**
 * Create a Bright Data-backed provider for one network. On missing config or
 * any failure it delegates to the site provider for the same network, so the
 * caller always gets results.
 */
export const createBrightDataProvider = (
  network: SocialNetwork,
): SocialProvider => {
  const fallback = createSiteProvider(network);

  return {
    network,
    kind: 'brightdata',
    async search(
      query: string,
      opts?: SocialSearchOptions,
    ): Promise<SocialSearchResult> {
      const key = apiKey();
      const dataset = datasetId(network);
      if (!key || !dataset) {
        return fallback.search(query, opts);
      }

      const limit = Math.max(1, Math.min(opts?.maxResults ?? 20, 50));
      try {
        const snapshotId = await trigger(key, dataset, query, limit);
        if (!snapshotId) return fallback.search(query, opts);

        const ready = await waitReady(key, snapshotId);
        if (!ready) return fallback.search(query, opts);

        const records = await download(key, snapshotId);
        const results = records
          .map(normalizeRecord)
          .filter((r): r is SearchResult => r !== null)
          .slice(0, limit);

        // If Bright Data came back empty, the site path is better than nothing.
        if (results.length === 0) return fallback.search(query, opts);
        return { results, suggestions: [] };
      } catch (err) {
        console.warn(
          `[Bokari Social] Bright Data adapter (${network}) failed, falling back to site:`,
          err,
        );
        return fallback.search(query, opts);
      }
    },
  };
};
