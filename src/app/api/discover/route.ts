import { runDiscoverPipeline, TOPIC_LABELS } from '@/lib/discover';
import { TTLCache, InflightDedup } from '@/lib/utils/cache';
import type { PipelineResult, Topic } from '@/lib/discover/types';

const CACHE_TTL = 8 * 60 * 60 * 1000; // 8 hours
const CACHE_MAX_ENTRIES = 32;

const cache = new TTLCache<string, PipelineResult>(CACHE_MAX_ENTRIES, CACHE_TTL);
const inflight = new InflightDedup<PipelineResult>();

const ALL_TOPICS = Object.keys(TOPIC_LABELS) as Topic[];

export const GET = async (req: Request) => {
  try {
    const params = new URL(req.url).searchParams;
    const topic = (params.get('topic') as Topic) || 'africa';
    const mode = params.get('mode') || 'normal';

    // Guard: unknown topic falls back to 'africa'
    const safeTopic: Topic = ALL_TOPICS.includes(topic) ? topic : 'africa';

    const cacheKey = `${safeTopic}-${mode}`;

    const cached = cache.get(cacheKey);
    if (cached) {
      return Response.json(
        {
          ...cached,
          // Backward-compat alias for the old API shape.
          blogs: cached.articles,
          nextUpdate: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
          topics: Object.entries(TOPIC_LABELS).map(([key, val]) => ({
            key,
            label: val.label,
            icon: val.icon,
          })),
          cached: true,
        },
        { status: 200 },
      );
    }

    const data = await inflight.run(cacheKey, async () => {
      return await runDiscoverPipeline(safeTopic, { mode: mode === 'preview' ? 'normal' : 'normal' });
    });

    cache.set(cacheKey, data);

    return Response.json(
      {
        ...data,
        // Backward-compat alias for the old API shape.
        blogs: data.articles,
        nextUpdate: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
        topics: Object.entries(TOPIC_LABELS).map(([key, val]) => ({
          key,
          label: val.label,
          icon: val.icon,
        })),
        cached: false,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('[Bokari Discover] route error:', err);
    return Response.json(
      {
        articles: [],
        meta: null,
        topics: Object.entries(TOPIC_LABELS).map(([key, val]) => ({
          key,
          label: val.label,
          icon: val.icon,
        })),
        cached: false,
        error: 'discover_failed',
      },
      { status: 500 },
    );
  }
};
