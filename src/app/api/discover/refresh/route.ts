import { searchNews } from '@/lib/search';
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

const topicQueries: Record<string, { label: string; queries: string[] }> = {
  africa: {
    label: 'Afrique',
    queries: [
      "actualites Afrique aujourd'hui",
      'Africa news today',
      'nouvelles Afrique derniere heure',
      "Afrique de l'Ouest actualite",
    ],
  },
  tech: {
    label: 'Tech & IA',
    queries: [
      'technology Africa startups',
      'innovation technologique Afrique',
      'artificial intelligence Africa 2026',
      'tech startups Africa funding',
    ],
  },
  finance: {
    label: 'Economie',
    queries: [
      'economie Afrique actualites',
      'Africa economy finance news',
      'bourse BRVM UEMOA',
      'investissement Afrique 2026',
    ],
  },
  art: {
    label: 'Culture',
    queries: [
      'culture africaine actualites',
      'musique africaine nouveautes',
      'cinema art africain 2026',
    ],
  },
  sports: {
    label: 'Sports',
    queries: [
      'football africain actualites',
      'CAN football Afrique',
      'athletes africains 2026',
    ],
  },
  politics: {
    label: 'Politique',
    queries: [
      'politique Afrique actualites',
      'elections Afrique 2026',
      'geopolitique union africaine',
    ],
  },
  sante: {
    label: 'Sante',
    queries: [
      'sante Afrique actualites',
      'OMS Afrique epidemie',
      'sante publique Afrique 2026',
    ],
  },
};

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return '';
  }
}

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
 * Fetches fresh news for all topics and stores them in Supabase.
 * Can also be called with ?topic=xxx to refresh a single topic.
 */
export const POST = async (req: Request) => {
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
    const singleTopic = params.get('topic');
    const batchId = `batch-${Date.now()}`;

    const topicsToRefresh = singleTopic
      ? { [singleTopic]: topicQueries[singleTopic] }
      : topicQueries;

    let totalInserted = 0;
    const errors: string[] = [];

    for (const [topic, config] of Object.entries(topicsToRefresh)) {
      if (!config) continue;

      console.log(
        `[Discover Refresh] Fetching topic: ${topic} (${config.queries.length} queries)`,
      );

      try {
        const results = await Promise.all(
          config.queries.map((query) => searchNews(query, 'fr')),
        );

        const seenUrls = new Set<string>();
        const articles = results
          .flat()
          .filter((item) => {
            if (!item.title || !item.url) return false;
            const url = item.url.toLowerCase().trim();
            if (seenUrls.has(url)) return false;
            seenUrls.add(url);
            return true;
          })
          .map((item) => ({
            topic,
            title: item.title.slice(0, 500),
            content: (item.content || '').slice(0, 2000),
            url: item.url,
            thumbnail: item.thumbnail || item.img_src || item.thumbnail_src || null,
            domain: extractDomain(item.url),
            batch_id: batchId,
            updated_at: new Date().toISOString(),
          }));

        if (articles.length === 0) {
          console.warn(`[Discover Refresh] No articles for topic: ${topic}`);
          errors.push(`${topic}: 0 articles`);
          continue;
        }

        const { error: upsertError, count } = await supabaseAdmin
          .from('discover_articles')
          .upsert(articles, { onConflict: 'url', ignoreDuplicates: false });

        if (upsertError) {
          console.error(
            `[Discover Refresh] Upsert error for ${topic}:`,
            upsertError,
          );
          errors.push(`${topic}: ${upsertError.message}`);
        } else {
          totalInserted += count ?? articles.length;
          console.log(
            `[Discover Refresh] ${topic}: ${articles.length} articles upserted`,
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

export const GET = POST;
