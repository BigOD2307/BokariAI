/**
 * Discover refresh — the callable core (shared by the API route and the cron).
 *
 * Runs the hybrid-retrieval pipeline for every topic (or one), extracts full
 * content, embeds, and upserts into Supabase `discover_articles`, then prunes
 * rows older than a week. Pulled out of the route so the daily scheduler can
 * invoke it directly without an internal HTTP round-trip.
 *
 * The Supabase admin client is created lazily (not at import) and guarded so
 * `next build` page-data collection never throws on a missing service key.
 */
import { runDiscoverPipeline, TOPIC_LABELS } from '@/lib/discover';
import type { Topic } from '@/lib/discover/types';
import { extractArticlesInParallel } from '@/lib/discover/contentExtractor';
import { embed } from '@/lib/ai/gateway';
import { getAiConfig } from '@/lib/ai/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const ALL_TOPICS = Object.keys(TOPIC_LABELS) as Topic[];

export type DiscoverRefreshSummary = {
  success: boolean;
  totalInserted: number;
  batchId: string;
  errors?: string[];
};

function getAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!url || !key || key === 'build-time-placeholder') return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function ensureTable(admin: SupabaseClient): Promise<boolean> {
  try {
    const { error } = await admin.from('discover_articles').select('id').limit(1);
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

export async function runDiscoverRefresh(
  singleTopic?: string | null,
): Promise<DiscoverRefreshSummary> {
  const batchId = `batch-${Date.now()}`;
  const admin = getAdmin();
  if (!admin) {
    return {
      success: false,
      totalInserted: 0,
      batchId,
      errors: ['Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'],
    };
  }

  const ready = await ensureTable(admin);
  if (!ready) {
    return {
      success: false,
      totalInserted: 0,
      batchId,
      errors: ['discover_articles table missing'],
    };
  }

  const topic = (singleTopic as Topic | null) ?? null;
  const topicsToRefresh: Topic[] = topic
    ? ALL_TOPICS.includes(topic)
      ? [topic]
      : []
    : ALL_TOPICS;

  let totalInserted = 0;
  const errors: string[] = [];

  for (const t of topicsToRefresh) {
    try {
      const { articles } = await runDiscoverPipeline(t, { now: new Date() });
      if (articles.length === 0) {
        errors.push(`${t}: 0 articles`);
        continue;
      }

      const urls = articles.map((a) => a.url);
      const extractionResults = await extractArticlesInParallel(urls, {
        maxConcurrent: 5,
        timeoutMs: 8_000,
      });
      const extractedByUrl = new Map(extractionResults.map((r) => [r.url, r]));
      const nowIso = new Date().toISOString();

      const embedInputs = articles.map((a) => {
        const ex = extractedByUrl.get(a.url);
        const body = (ex?.fullContent ?? a.content ?? '').slice(0, 1500);
        return `${a.title}\n${a.title}\n${body}`;
      });
      let embeddings: number[][] = [];
      const embeddingModel = getAiConfig().embedding.model;
      try {
        embeddings = await embed(embedInputs);
      } catch (err) {
        console.error(`[Discover Refresh] Embedding batch failed for ${t}:`, err);
      }

      const rows = articles.map((a, idx) => {
        const ex = extractedByUrl.get(a.url);
        const vec = embeddings[idx];
        const hasVec = !!(vec && Array.isArray(vec) && vec.length > 0);
        const base = {
          topic: a.topic,
          title: a.title,
          content: a.content,
          url: a.url,
          thumbnail: a.thumbnail,
          domain: a.domain,
          language: a.language,
          quality_score: a.qualityScore,
          embedding: hasVec ? vec : null,
          embedding_model: hasVec ? embeddingModel : null,
          batch_id: batchId,
          updated_at: nowIso,
        };
        if (ex?.success) {
          return {
            ...base,
            author: ex.metadata.author ?? a.author,
            published_at:
              (ex.metadata.publishedAt ?? a.publishedAt)?.toISOString() ?? null,
            full_content: ex.fullContent,
            extracted_at: nowIso,
            content_hash: ex.contentHash,
          };
        }
        return {
          ...base,
          author: a.author,
          published_at: a.publishedAt?.toISOString() ?? null,
        };
      });

      const { error: upsertError, count } = await admin
        .from('discover_articles')
        .upsert(rows, { onConflict: 'url', ignoreDuplicates: false });

      if (upsertError) {
        errors.push(`${t}: ${upsertError.message}`);
      } else {
        totalInserted += count ?? rows.length;
      }
    } catch (err) {
      console.error(`[Discover Refresh] Error for topic ${t}:`, err);
      errors.push(`${t}: ${err}`);
    }
  }

  // Keep last 7 days.
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  await admin.from('discover_articles').delete().lt('created_at', weekAgo);

  return {
    success: errors.length === 0,
    totalInserted,
    batchId,
    errors: errors.length > 0 ? errors : undefined,
  };
}
