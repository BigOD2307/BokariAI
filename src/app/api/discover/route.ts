import { searchNews } from '@/lib/search';
import { TTLCache, InflightDedup } from '@/lib/utils/cache';

const topicQueries: Record<string, { label: string; queries: string[]; icon: string }> = {
  africa: {
    label: 'Afrique',
    icon: 'globe',
    queries: [
      "actualites Afrique aujourd'hui",
      'Africa news today',
      'nouvelles Afrique derniere heure',
      "Afrique de l'Ouest actualite",
    ],
  },
  tech: {
    label: 'Tech & IA',
    icon: 'cpu',
    queries: [
      'technology Africa startups',
      'innovation technologique Afrique',
      'artificial intelligence Africa 2026',
      'tech startups Africa funding',
    ],
  },
  finance: {
    label: 'Economie',
    icon: 'trending-up',
    queries: [
      'economie Afrique actualites',
      'Africa economy finance news',
      'bourse BRVM UEMOA',
      'investissement Afrique 2026',
    ],
  },
  art: {
    label: 'Culture',
    icon: 'palette',
    queries: [
      'culture africaine actualites',
      'musique africaine nouveautes',
      'cinema art africain 2026',
    ],
  },
  sports: {
    label: 'Sports',
    icon: 'trophy',
    queries: [
      'football africain actualites',
      'CAN football Afrique',
      'athletes africains 2026',
    ],
  },
  politics: {
    label: 'Politique',
    icon: 'landmark',
    queries: [
      'politique Afrique actualites',
      'elections Afrique 2026',
      'geopolitique union africaine',
    ],
  },
  sante: {
    label: 'Sante',
    icon: 'heart-pulse',
    queries: [
      'sante Afrique actualites',
      'OMS Afrique epidemie',
      'sante publique Afrique 2026',
    ],
  },
};

const CACHE_TTL = 8 * 60 * 60 * 1000; // 8 hours (3 updates/day)
const CACHE_MAX_ENTRIES = 32; // 7 topics x ~5 modes with headroom

const cache = new TTLCache<string, unknown[]>(CACHE_MAX_ENTRIES, CACHE_TTL);
const inflight = new InflightDedup<unknown[]>();

type Topic = keyof typeof topicQueries;

export const GET = async (req: Request) => {
  try {
    const params = new URL(req.url).searchParams;
    const topic: Topic = (params.get('topic') as Topic) || 'africa';
    const mode = params.get('mode') || 'normal';

    const selectedTopic = topicQueries[topic] || topicQueries.africa;
    const cacheKey = `${topic}-${mode}`;

    const cached = cache.get(cacheKey);
    if (cached) {
      return Response.json(
        {
          blogs: cached,
          topics: Object.entries(topicQueries).map(([key, val]) => ({
            key,
            label: val.label,
            icon: val.icon,
          })),
          cached: true,
          nextUpdate: new Date(Date.now() + CACHE_TTL).toISOString(),
        },
        { status: 200 },
      );
    }

    const data = await inflight.run(cacheKey, async () => {
      if (mode === 'preview') {
        const randomQuery =
          selectedTopic.queries[
            Math.floor(Math.random() * selectedTopic.queries.length)
          ];
        return await searchNews(randomQuery, 'fr');
      }

      const results = await Promise.all(
        selectedTopic.queries.map((query) => searchNews(query, 'fr')),
      );

      const seenUrls = new Set<string>();
      return results
        .flat()
        .filter((item) => {
          const url = item.url?.toLowerCase().trim();
          if (!url || seenUrls.has(url)) return false;
          seenUrls.add(url);
          return true;
        })
        .sort(() => Math.random() - 0.5);
    });

    cache.set(cacheKey, data);

    return Response.json(
      {
        blogs: data,
        topics: Object.entries(topicQueries).map(([key, val]) => ({
          key,
          label: val.label,
          icon: val.icon,
        })),
        cached: false,
        nextUpdate: new Date(Date.now() + CACHE_TTL).toISOString(),
      },
      { status: 200 },
    );
  } catch (err) {
    console.error(`An error occurred in discover route: ${err}`);
    return Response.json(
      { message: 'An error has occurred', blogs: [], topics: [] },
      { status: 500 },
    );
  }
};
