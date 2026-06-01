import { runDiscoverPipeline, TOPIC_LABELS } from '@/lib/discover';
import type { Topic } from '@/lib/discover/types';
import { extractArticlesInParallel } from '@/lib/discover/contentExtractor';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    '[Discover Refresh] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.',
  );
}
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ALL_TOPICS = Object.keys(TOPIC_LABELS) as Topic[];

async function ensureTable(): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('discover_articles')
      .select('id')
      .limit(1);
    if (error && /does not exist/i.test(error.message)) {
      console.error(
        '[Discover Refresh] discover_articles table missing. Apply supabase/migrations/20260601_initial.sql first.',
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Discover Refresh] ensureTable failed:', err);
    return false;
  }
}

/**
 * POST /api/discover/refresh
 *
 * Runs the new hybrid-retrieval pipeline for every topic (or one topic
 * if ?topic= is passed), then upserts the results into Supabase.  Each
 * row now carries the language, quality score, and other metadata the
 * ranker needs.
 *
 * GET is exposed too as a convenience (e.g. for cron / curl checks).
 */
const handler = async (req: Request) => {
  try {
    const ready = await ensureTable();
    if (!ready) {
      return Response.json(
        {
          error:
            'discover_articles table missing. Apply supabase/migrations/20260601_initial.sql first.',
        },
        { status: 500 },
      );
    }

    const params = new URL(req.url).searchParams;
    const singleTopic = params.get('topic') as Topic | null;
    const batchId = `batch-${Date.now()}`;

    const topicsToRefresh: Topic[] = singleTopic
      ? (ALL_TOPICS.includes(singleTopic) ? [singleTopic] : [])
      : ALL_TOPICS;

    let totalInserted = 0;
    const errors: string[] = [];

    for (const topic of topicsToRefresh) {
      console.log(`[Discover Refresh] Running pipeline for topic: ${topic}`);

      try {
        const { articles } = await runDiscoverPipeline(topic, { now: new Date() });

        if (articles.length === 0) {
          console.warn(`[Discover Refresh] No articles for topic: ${topic}`);
          errors.push(`${topic}: 0 articles`);
          continue;
        }

        // Phase 2: extract full content for every article, in parallel,
        // before upserting.  This is the one-time, expensive step.
        // Future search-time lookups (via /api/agents/search/webSearch)
        // will hit the cache instead of re-fetching.
        const urls = articles.map((a) => a.url);
        const extractionResults = await extractArticlesInParallel(urls, {
          maxConcurrent: 5,
          timeoutMs: 8_000,
        });
        const extractedByUrl = new Map(extractionResults.map((r) => [r.url, r]));
        const extractionStats = { ok: 0, fail: 0 };
        const nowIso = new Date().toISOString();

        // Map ScoredArticle → DB row.  Strips the scoreBreakdown (debug
        // only) and keeps everything the UI needs.
        const rows = articles.map((a) => {
          const ex = extractedByUrl.get(a.url);
          if (ex?.success) {
            extractionStats.ok++;
            return {
              topic: a.topic,
              title: a.title,
              content: a.content,
              url: a.url,
              thumbnail: a.thumbnail,
              domain: a.domain,
              language: a.language,
              author: ex.metadata.author ?? a.author,
              published_at:
                (ex.metadata.publishedAt ?? a.publishedAt)?.toISOString() ?? null,
              quality_score: a.qualityScore,
              full_content: ex.fullContent,
              extracted_at: nowIso,
              content_hash: ex.contentHash,
              batch_id: batchId,
              updated_at: nowIso,
            };
          }
          extractionStats.fail++;
          return {
            topic: a.topic,
            title: a.title,
            content: a.content,
            url: a.url,
            thumbnail: a.thumbnail,
            domain: a.domain,
            language: a.language,
            author: a.author,
            published_at: a.publishedAt?.toISOString() ?? null,
            quality_score: a.qualityScore,
            batch_id: batchId,
            updated_at: nowIso,
          };
        });

        const { error: upsertError, count } = await supabaseAdmin
          .from('discover_articles')
          .upsert(rows, { onConflict: 'url', ignoreDuplicates: false });

        if (upsertError) {
          console.error(
            `[Discover Refresh] Upsert error for ${topic}:`,
            upsertError,
          );
          errors.push(`${topic}: ${upsertError.message}`);
        } else {
          totalInserted += count ?? rows.length;
          console.log(
            `[Discover Refresh] ${topic}: ${rows.length} articles upserted ` +
              `(extraction: ${extractionStats.ok} ok / ${extractionStats.fail} fail)`,
          );
        }
      } catch (err) {
        console.error(`[Discover Refresh] Error for topic ${topic}:`, err);
        errors.push(`${topic}: ${err}`);
      }
    }

    // Clean old articles (keep last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from('discover_articles')
      .delete()
      .lt('created_at', weekAgo);

    return Response.json({
      success: true,
      totalInserted,
      batchId,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Discover Refresh] Fatal error:', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
};

export const POST = handler;
export const GET = handler;
