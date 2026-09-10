/**
 * RSS crawler for the African news corpus (C9).
 *
 * Ingests each outlet's own feed, reads the article pages with Readability
 * (the same `readPage` the chat retrieval uses), embeds them (BGE-M3 via the
 * gateway) and stores everything in `news_articles` with a true pgvector
 * column. Cost model per pass: parse every feed (cheap), then only fetch +
 * embed the URLs we do not already have (expensive) — a feed of 25 items
 * where 24 are known costs one page read.
 *
 * Scheduling: the `news-crawl` scheduler job runs this every hour, processing
 * sources in batches so one pass always fits in the job's time budget.
 */
import { XMLParser } from 'fast-xml-parser';
import { createHash } from 'crypto';
import { and, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import { pgDb } from '@/lib/db/postgres/client';
import { newsArticles, newsSources } from '@/lib/db/postgres/schema';
import { readPage } from '@/lib/retrieval/read';
import { canonicalizeUrl } from '@/lib/retrieval/url';
import { embed, articleToEmbedText } from '@/lib/ai/gateway';
import { SOURCE_SEEDS } from './registry';

const MAX_ITEMS_PER_FEED = 25;
/** On each pass we only chase what is new — the feed itself is the recency bound. */
const MAX_AGE_DAYS = 3;
/** A feed that fails five times in a row is auto-disabled; the admin sees it. */
const FAILURE_LIMIT = 5;
/** Articles below this many extracted characters are app shells, not stories. */
const MIN_BODY_CHARS = 400;
/** Page reads are the slow, rate-limit-sensitive part — keep the batch small. */
const MAX_FETCHES_PER_PASS = 40;
/** Bodies older than this are dropped (metadata rows stay — see schema note). */
const RETENTION_DAYS = 90;
/** Max articles re-embedded per pass once the embedding provider recovers. */
const BACKFILL_LIMIT = 64;

type FeedItem = { title: string; link: string; publishedAt: Date | null };

export type CrawlSummary = {
  sources: number;
  inserted: number;
  skipped: number;
  /** Articles that had no embedding and got one on this pass. */
  backfilled: number;
  /** Bodies dropped past the retention window. */
  purged: number;
  errors: string[];
};

/**
 * Give articles stored without an embedding (provider outage / no credits)
 * their vector once the provider works again. Runs inside every crawl pass,
 * bounded, so a week of outage costs a few minutes of backfill, not a manual
 * SQL migration.
 */
async function backfillEmbeddings(): Promise<number> {
  const missing = await pgDb
    .select({
      id: newsArticles.id,
      title: newsArticles.title,
      body: newsArticles.body,
    })
    .from(newsArticles)
    .where(
      and(
        isNull(newsArticles.embedding),
        sql`${newsArticles.body} IS NOT NULL`,
      ),
    )
    .limit(BACKFILL_LIMIT);
  if (missing.length === 0) return 0;

  let done = 0;
  const inputs = missing.map((a) => articleToEmbedText(a.title, a.body));
  try {
    const vectors = await embed(inputs);
    for (let i = 0; i < missing.length; i++) {
      const v = vectors[i];
      if (!v) continue;
      await pgDb
        .update(newsArticles)
        .set({ embedding: v })
        .where(eq(newsArticles.id, missing[i].id));
      done += 1;
    }
  } catch (err) {
    // Provider still down — not an error of the crawl itself.
    console.warn(
      '[Bokari news] embedding backfill unavailable:',
      (err as Error).message,
    );
  }
  return done;
}

/**
 * Retention: drop bodies past RETENTION_DAYS. The row stays (URL, title,
 * source, date) — the corpus remembers that an article existed without
 * keeping its full text forever.
 */
async function purgeExpiredBodies(): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
  const rows = await pgDb
    .update(newsArticles)
    .set({ body: null, embedding: null })
    .where(
      and(
        lt(newsArticles.publishedAt, cutoff),
        sql`${newsArticles.body} IS NOT NULL`,
      ),
    )
    .returning({ id: newsArticles.id });
  return rows.length;
}

/**
 * Ensure `news_sources` mirrors the versioned registry. Insert new seeds,
 * never overwrite operator edits (enabled flag, tier tweaks) on existing rows.
 */
export async function ensureSourcesSeeded(): Promise<number> {
  const existing = await pgDb
    .select({ domain: newsSources.domain })
    .from(newsSources);
  const known = new Set(existing.map((r) => r.domain));
  const fresh = SOURCE_SEEDS.filter((s) => !known.has(s.domain));
  if (fresh.length === 0) return 0;
  await pgDb.insert(newsSources).values(
    fresh.map((s) => ({
      domain: s.domain,
      name: s.name,
      country: s.country,
      feedUrl: s.feedUrl,
      tier: s.tier,
      isStateMedia: s.isStateMedia ?? false,
      isCertified: s.isCertified ?? false,
      suspendedIn: s.suspendedIn ?? [],
    })),
  );
  return fresh.length;
}

/**
 * Crawl a batch of enabled sources. Bounded: at most MAX_FETCHES_PER_PASS page
 * reads across the whole pass, so the hourly job cannot run away even if a
 * dozen feeds all surface new items at once.
 */
export async function crawlBatch(limit = 6): Promise<CrawlSummary> {
  await ensureSourcesSeeded();

  const due = await pgDb
    .select({
      id: newsSources.id,
      domain: newsSources.domain,
      name: newsSources.name,
      feedUrl: newsSources.feedUrl,
    })
    .from(newsSources)
    .where(eq(newsSources.enabled, true))
    .orderBy(newsSources.lastFetchAt)
    .limit(limit);

  const summary: CrawlSummary = {
    sources: due.length,
    inserted: 0,
    skipped: 0,
    backfilled: 0,
    purged: 0,
    errors: [],
  };
  let fetchBudget = MAX_FETCHES_PER_PASS;

  for (const source of due) {
    if (!source.feedUrl) continue;
    if (fetchBudget <= 0) break;
    try {
      const res = await crawlSource(
        { ...source, feedUrl: source.feedUrl },
        fetchBudget,
      );
      fetchBudget -= res.fetched;
      summary.inserted += res.inserted;
      summary.skipped += res.skipped;
      await recordSuccess(source.id);
    } catch (err) {
      const message = (err as Error)?.message ?? String(err);
      summary.errors.push(`${source.domain}: ${message}`);
      await recordFailure(source.id, message);
    }
  }

  summary.backfilled = await backfillEmbeddings();
  summary.purged = await purgeExpiredBodies();
  return summary;
}

/** Ingest one feed. Throws only on feed-level failure (fetch/parse). */
async function crawlSource(
  source: { id: number; domain: string; name: string; feedUrl: string },
  fetchBudget: number,
): Promise<{ inserted: number; skipped: number; fetched: number }> {
  const items = await fetchFeed(source.feedUrl);

  const cutoff = Date.now() - MAX_AGE_DAYS * 86_400_000;
  const fresh = items
    .filter((i) => !i.publishedAt || i.publishedAt.getTime() > cutoff)
    .slice(0, MAX_ITEMS_PER_FEED);

  const canonical = fresh
    .map((item) => ({ item, canonicalUrl: canonicalizeUrl(item.link) }))
    .filter((entry): entry is { item: FeedItem; canonicalUrl: string } =>
      Boolean(entry.canonicalUrl),
    );

  if (canonical.length === 0) return { inserted: 0, skipped: 0, fetched: 0 };

  // Cheap dedup first: drop URLs already in the corpus before any page fetch.
  const known = await pgDb
    .select({ canonicalUrl: newsArticles.canonicalUrl })
    .from(newsArticles)
    .where(
      inArray(
        newsArticles.canonicalUrl,
        canonical.map((c) => c.canonicalUrl),
      ),
    );
  const knownSet = new Set(known.map((r) => r.canonicalUrl));
  const todo = canonical
    .filter((c) => !knownSet.has(c.canonicalUrl))
    .slice(0, fetchBudget);

  let inserted = 0;
  let fetched = 0;

  // Sequential on purpose: one page at a time keeps us far below any outlet's
  // rate limit, and the hourly cadence means there is no rush.
  for (const { item, canonicalUrl } of todo) {
    const page = await readPage(item.link);
    if (!page || page.text.length < MIN_BODY_CHARS) continue;
    fetched += 1;

    const contentHash = createHash('sha256')
      .update(page.text.slice(0, 5_000))
      .digest('hex');

    // Aggregators republish wire copy verbatim. Same hash, different domain =
    // the same article; keep the first (usually the primary source) and skip.
    const duplicate = await pgDb
      .select({ id: newsArticles.id })
      .from(newsArticles)
      .where(eq(newsArticles.contentHash, contentHash))
      .limit(1);
    if (duplicate.length > 0) continue;

    const title = page.title ?? item.title;
    let embedding: number[] | null = null;
    try {
      [embedding] = await embed([articleToEmbedText(title, page.text)]);
    } catch (err) {
      // An article without an embedding is still searchable lexically.
      console.warn('[Bokari news] embedding failed', {
        url: item.link,
        error: (err as Error).message,
      });
    }

    const publishedAt = page.publishedAt ?? item.publishedAt ?? new Date();
    const rows = await pgDb
      .insert(newsArticles)
      .values({
        sourceId: source.id,
        canonicalUrl,
        url: item.link,
        title,
        body: page.text,
        author: page.author,
        publishedAt,
        language: 'fr',
        embedding: embedding ?? null,
        contentHash,
      })
      .onConflictDoNothing({ target: newsArticles.canonicalUrl })
      .returning({ id: newsArticles.id });
    inserted += rows.length;
  }

  return { inserted, skipped: canonical.length - todo.length, fetched };
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
});

async function fetchFeed(url: string): Promise<FeedItem[]> {
  const res = await fetch(url, {
    // Several West African sites 403 non-browser agents behind Cloudflare;
    // identify honestly with a contact URL instead of faking a browser.
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; BokariBot/1.0; +https://bokari.space/bot)',
      Accept:
        'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8',
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`feed ${res.status}`);

  const xml = parser.parse(await res.text());
  return parseFeedXml(xml);
}

/**
 * Pure feed parsing — RSS 2.0, Atom, and RDF all normalized to {title, link,
 * publishedAt}. Exported for tests: this is where flaky feeds break first.
 */
export function parseFeedXml(xml: unknown): FeedItem[] {
  const x = xml as Record<string, any>;
  // Namespace prefixes survive into fast-xml-parser keys ("rdf:RDF").
  // In RDF feeds, <item> is a SIBLING of <channel>, not a child — and the
  // channel may be attribute-only, so items must be looked up on the RDF
  // root FIRST (falling back to the channel would find none).
  const rdf = x?.['rdf:RDF'] ?? x?.RDF;
  const root = x?.rss?.channel ?? x?.feed ?? rdf;
  const raw = root?.item ?? root?.entry ?? rdf?.channel?.item ?? [];
  const list = Array.isArray(raw) ? raw : [raw];

  return list.flatMap((e) => {
    const link =
      typeof e?.link === 'string'
        ? e.link
        : e?.link?.['@_href'] ??
          (typeof e?.guid === 'string' ? e.guid : e?.guid?.['#text']);
    const titleRaw =
      typeof e?.title === 'string' ? e.title : e?.title?.['#text'];
    if (!link || !titleRaw) return [];
    const dateRaw = e?.pubDate ?? e?.published ?? e?.updated ?? e?.['dc:date'];
    const parsedDate = dateRaw ? new Date(dateRaw) : null;
    return [
      {
        title: String(titleRaw).trim(),
        link: String(link).trim(),
        publishedAt:
          parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null,
      },
    ];
  });
}

type FeedEntry = {
  link?: string | { '@_href'?: string };
  guid?: string | { '#text'?: string };
  title?: string | { '#text'?: string };
  pubDate?: string;
  published?: string;
  updated?: string;
  'dc:date'?: string;
};

async function recordSuccess(id: number) {
  await pgDb
    .update(newsSources)
    .set({
      lastFetchAt: new Date(),
      lastFetchStatus: 'ok',
      consecutiveFailures: 0,
    })
    .where(eq(newsSources.id, id));
}

async function recordFailure(id: number, reason: string) {
  const [row] = await pgDb
    .select({ consecutiveFailures: newsSources.consecutiveFailures })
    .from(newsSources)
    .where(eq(newsSources.id, id));
  const failures = (row?.consecutiveFailures ?? 0) + 1;
  await pgDb
    .update(newsSources)
    .set({
      lastFetchAt: new Date(),
      lastFetchStatus: reason.slice(0, 200),
      consecutiveFailures: failures,
      // Auto-disable rather than retrying a dead feed forever; the admin sees it.
      enabled: failures < FAILURE_LIMIT,
    })
    .where(eq(newsSources.id, id));
}
