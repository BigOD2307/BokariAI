/**
 * Discover refresh — the callable core (shared by the API route and the cron).
 *
 * Runs the hybrid-retrieval pipeline for every topic (or one), extracts full
 * content, embeds, and upserts into Neon `discover_articles`, then prunes
 * rows older than a week. Pulled out of the route so the daily scheduler can
 * invoke it directly without an internal HTTP round-trip.
 *
 * discover_articles was always a public-read, service-role-write table on
 * Supabase — no RLS/ownership logic to replicate here, this is a mechanical
 * translation to Drizzle/Neon.
 */
import { lt, sql } from 'drizzle-orm';
import { runDiscoverPipeline, TOPIC_LABELS } from '@/lib/discover';
import type { Topic } from '@/lib/discover/types';
import { extractArticlesInParallel } from '@/lib/discover/contentExtractor';
import { embed } from '@/lib/ai/gateway';
import { getAiConfig } from '@/lib/ai/config';
import { pgDb, schema } from '@/lib/db/postgres/client';

const ALL_TOPICS = Object.keys(TOPIC_LABELS) as Topic[];

export type DiscoverRefreshSummary = {
  success: boolean;
  totalInserted: number;
  batchId: string;
  errors?: string[];
};

export async function runDiscoverRefresh(
  singleTopic?: string | null,
): Promise<DiscoverRefreshSummary> {
  const batchId = `batch-${Date.now()}`;

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
      const now = new Date();

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
          qualityScore: a.qualityScore,
          embedding: hasVec ? vec : null,
          embeddingModel: hasVec ? embeddingModel : null,
          batchId,
          updatedAt: now,
        };
        if (ex?.success) {
          return {
            ...base,
            author: ex.metadata.author ?? a.author,
            publishedAt: ex.metadata.publishedAt ?? a.publishedAt ?? null,
            fullContent: ex.fullContent,
            extractedAt: now,
            contentHash: ex.contentHash,
          };
        }
        return {
          ...base,
          author: a.author,
          publishedAt: a.publishedAt ?? null,
        };
      });

      try {
        const { discoverArticles: d } = schema;
        // Ties the ON CONFLICT SET clause to the real schema instead of
        // hand-typed snake_case strings that could typo-drift from it.
        // NOTE: interpolating the column object itself (`sql`excluded.${col}``)
        // renders a fully-qualified "table"."column" reference — producing
        // invalid SQL like `excluded."discover_articles"."topic"` (Postgres:
        // "invalid reference to FROM-clause entry for table
        // 'discover_articles'"). Use `.name` for the bare column identifier.
        const excluded = (col: { name: string }) => sql.raw(`excluded."${col.name}"`);
        await pgDb
          .insert(d)
          .values(rows)
          .onConflictDoUpdate({
            target: d.url,
            set: {
              topic: excluded(d.topic),
              title: excluded(d.title),
              content: excluded(d.content),
              thumbnail: excluded(d.thumbnail),
              domain: excluded(d.domain),
              language: excluded(d.language),
              qualityScore: excluded(d.qualityScore),
              embedding: excluded(d.embedding),
              embeddingModel: excluded(d.embeddingModel),
              batchId: excluded(d.batchId),
              updatedAt: excluded(d.updatedAt),
              author: excluded(d.author),
              publishedAt: excluded(d.publishedAt),
              fullContent: excluded(d.fullContent),
              extractedAt: excluded(d.extractedAt),
              contentHash: excluded(d.contentHash),
            },
          });
        totalInserted += rows.length;
      } catch (upsertErr) {
        errors.push(`${t}: ${(upsertErr as Error).message}`);
      }
    } catch (err) {
      console.error(`[Discover Refresh] Error for topic ${t}:`, err);
      errors.push(`${t}: ${err}`);
    }
  }

  // Keep last 7 days.
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await pgDb.delete(schema.discoverArticles).where(lt(schema.discoverArticles.createdAt, weekAgo));

  return {
    success: errors.length === 0,
    totalInserted,
    batchId,
    errors: errors.length > 0 ? errors : undefined,
  };
}
