'use client';

/* eslint-disable @next/next/no-img-element */
import {
  Compass,
  Globe,
  Cpu,
  TrendingUp,
  Palette,
  Trophy,
  Landmark,
  HeartPulse,
  ArrowUpRight,
  Clock,
  Newspaper,
  RefreshCw,
} from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

export interface DiscoverItem {
  title: string;
  content: string;
  url: string;
  thumbnail: string;
}

interface TopicMeta {
  key: string;
  label: string;
  icon: string;
}

const iconMap: Record<string, React.ReactNode> = {
  globe: <Globe size={15} />,
  cpu: <Cpu size={15} />,
  'trending-up': <TrendingUp size={15} />,
  palette: <Palette size={15} />,
  trophy: <Trophy size={15} />,
  landmark: <Landmark size={15} />,
  'heart-pulse': <HeartPulse size={15} />,
};

const topicColors: Record<string, string> = {
  africa: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  tech: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  finance: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  art: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  sports: 'bg-red-500/10 text-red-600 dark:text-red-400',
  politics: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
  sante: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
};

function cleanThumbnail(thumbnail: string): string {
  try {
    const u = new URL(thumbnail);
    return u.origin + u.pathname + `?id=${u.searchParams.get('id')}`;
  } catch {
    return thumbnail;
  }
}

// --- Skeleton loading states ---

function HeroSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Skeleton className="h-72 rounded-2xl" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-[calc(50%-8px)] rounded-2xl" />
        <Skeleton className="h-[calc(50%-8px)] rounded-2xl" />
      </div>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <Card key={i} className="overflow-hidden border-0 ring-0 bg-transparent">
          <Skeleton className="aspect-[16/10] rounded-xl" />
          <div className="pt-3 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </Card>
      ))}
    </div>
  );
}

// --- Article cards ---

const heroGradients = [
  'from-bokari-700 via-bokari-600 to-emerald-800',
  'from-slate-800 via-slate-700 to-bokari-800',
  'from-amber-800 via-amber-700 to-orange-900',
];

function HeroCard({ item, className, index = 0 }: { item: DiscoverItem; className?: string; index?: number }) {
  const domain = (() => {
    try { return new URL(item.url).hostname.replace('www.', ''); } catch { return ''; }
  })();
  const hasThumbnail = !!item.thumbnail;
  const gradient = heroGradients[index % heroGradients.length];

  return (
    <Link
      href={`/?q=Summary: ${item.url}`}
      className={cn(
        'group relative rounded-2xl overflow-hidden',
        hasThumbnail ? 'bg-black/[0.03] dark:bg-white/[0.03]' : `bg-gradient-to-br ${gradient}`,
        className,
      )}
    >
      {hasThumbnail && (
        <img
          src={cleanThumbnail(item.thumbnail)}
          alt={item.title}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700"
        />
      )}
      <div className={cn(
        'absolute inset-0',
        hasThumbnail
          ? 'bg-gradient-to-t from-black/80 via-black/30 to-transparent'
          : 'bg-gradient-to-t from-black/20 to-transparent',
      )} />
      {/* Pattern overlay for no-thumbnail cards */}
      {!hasThumbnail && (
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }} />
      )}
      <div className="absolute bottom-0 left-0 right-0 p-5 lg:p-6">
        {domain && (
          <div className="flex items-center gap-1.5 mb-2">
            <img
              src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
              alt=""
              className="w-3.5 h-3.5 rounded-sm"
            />
            <span className="text-white/50 text-[10px]">{domain}</span>
          </div>
        )}
        <h2
          className="text-white text-lg lg:text-xl font-normal leading-snug line-clamp-2 mb-1.5"
          style={{ fontFamily: 'Instrument Serif, Georgia, serif' }}
        >
          {item.title}
        </h2>
        <p className="text-white/60 text-xs line-clamp-2 leading-relaxed">
          {item.content}
        </p>
      </div>
      <div className="absolute top-3 right-3 p-2 rounded-xl bg-white/10 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-300">
        <ArrowUpRight size={14} className="text-white" />
      </div>
    </Link>
  );
}

const cardAccents = [
  'bg-bokari-500/[0.06]',
  'bg-blue-500/[0.06]',
  'bg-amber-500/[0.06]',
  'bg-violet-500/[0.06]',
  'bg-emerald-500/[0.06]',
  'bg-rose-500/[0.06]',
];

function ArticleCard({ item, index = 0 }: { item: DiscoverItem; index?: number }) {
  const domain = (() => {
    try {
      return new URL(item.url).hostname.replace('www.', '');
    } catch {
      return '';
    }
  })();
  const hasThumbnail = !!item.thumbnail;

  return (
    <Link
      href={`/?q=Summary: ${item.url}`}
      className="group flex flex-col rounded-2xl overflow-hidden border border-black/[0.05] dark:border-white/[0.05] hover:border-black/[0.1] dark:hover:border-white/[0.1] bg-white dark:bg-white/[0.02] hover:shadow-md transition-all duration-300"
    >
      {hasThumbnail ? (
        <div className="relative aspect-[16/10] overflow-hidden bg-black/[0.03] dark:bg-white/[0.03]">
          <img
            src={cleanThumbnail(item.thumbnail)}
            alt={item.title}
            className="object-cover w-full h-full group-hover:scale-[1.03] transition-transform duration-500"
          />
          <div className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-white/80 dark:bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0">
            <ArrowUpRight size={11} className="text-black/70 dark:text-white/70" />
          </div>
        </div>
      ) : (
        <div className={cn(
          'relative aspect-[16/7] overflow-hidden flex items-center justify-center',
          cardAccents[index % cardAccents.length],
        )}>
          {domain && (
            <img
              src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
              alt=""
              className="w-10 h-10 rounded-lg opacity-30 dark:opacity-20"
            />
          )}
          <div className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-black/[0.04] dark:bg-white/[0.04] opacity-0 group-hover:opacity-100 transition-all duration-300">
            <ArrowUpRight size={11} className="text-black/50 dark:text-white/50" />
          </div>
        </div>
      )}
      <div className="p-3.5 flex flex-col flex-1">
        <h3 className="font-medium text-[13px] leading-snug line-clamp-2 text-black/85 dark:text-white/85 group-hover:text-bokari-600 dark:group-hover:text-bokari-400 transition-colors duration-300 mb-1.5">
          {item.title}
        </h3>
        <p className="text-black/40 dark:text-white/35 text-[11.5px] leading-relaxed line-clamp-2 mb-3">
          {item.content}
        </p>
        <div className="mt-auto flex items-center gap-2">
          {domain && (
            <div className="flex items-center gap-1.5">
              <img
                src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
                alt=""
                className="w-3.5 h-3.5 rounded-sm"
              />
              <span className="text-[10px] text-black/30 dark:text-white/25 truncate max-w-[120px]">
                {domain}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

function FeaturedRow({ items }: { items: DiscoverItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const domain = (() => {
          try {
            return new URL(item.url).hostname.replace('www.', '');
          } catch {
            return '';
          }
        })();

        return (
          <Link
            key={i}
            href={`/?q=Summary: ${item.url}`}
            className="group flex items-start gap-3.5 p-3 -mx-3 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors duration-200"
          >
            <span className="text-[11px] font-semibold text-black/20 dark:text-white/15 mt-0.5 w-5 text-center tabular-nums">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <h4 className="text-[13px] font-medium leading-snug line-clamp-2 text-black/80 dark:text-white/80 group-hover:text-bokari-600 dark:group-hover:text-bokari-400 transition-colors">
                {item.title}
              </h4>
              {domain && (
                <div className="flex items-center gap-1.5 mt-1">
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
                    alt=""
                    className="w-3 h-3 rounded-sm"
                  />
                  <span className="text-[10px] text-black/30 dark:text-white/25">
                    {domain}
                  </span>
                </div>
              )}
            </div>
            {item.thumbnail && (
              <div className="w-16 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-black/[0.03] dark:bg-white/[0.03]">
                <img
                  src={cleanThumbnail(item.thumbnail)}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}

// --- Stats bar ---

function StatsBar({ articles, cached, nextUpdate }: { articles: number; cached: boolean; nextUpdate?: string }) {
  const timeUntilUpdate = (() => {
    if (!nextUpdate) return null;
    const diff = new Date(nextUpdate).getTime() - Date.now();
    if (diff <= 0) return 'Mise a jour imminente';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `Prochaine maj dans ${hours}h${mins > 0 ? mins + 'min' : ''}`;
    return `Prochaine maj dans ${mins}min`;
  })();

  return (
    <div className="flex items-center gap-4 text-[11px] text-black/35 dark:text-white/25">
      <div className="flex items-center gap-1.5">
        <Newspaper size={12} />
        <span>{articles} articles</span>
      </div>
      {cached && timeUntilUpdate && (
        <div className="flex items-center gap-1.5">
          <Clock size={12} />
          <span>{timeUntilUpdate}</span>
        </div>
      )}
    </div>
  );
}

// --- Main page ---

const Page = () => {
  const [articles, setArticles] = useState<DiscoverItem[] | null>(null);
  const [topics, setTopics] = useState<TopicMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTopic, setActiveTopic] = useState('africa');
  const [cached, setCached] = useState(false);
  const [nextUpdate, setNextUpdate] = useState<string | undefined>();
  const [refreshing, setRefreshing] = useState(false);

  const fetchArticles = useCallback(async (topic: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/discover?topic=${topic}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.message);

      const filtered = (data.blogs || []).filter(
        (b: DiscoverItem) => b.title && b.url,
      );
      setArticles(filtered);
      if (data.topics) setTopics(data.topics);
      setCached(data.cached || false);
      setNextUpdate(data.nextUpdate);
    } catch (err: any) {
      console.error('Error fetching discover:', err.message);
      toast.error('Erreur lors du chargement des actualites');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchArticles(activeTopic);
  }, [activeTopic, fetchArticles]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchArticles(activeTopic);
  };

  const heroItems = articles?.slice(0, 3) || [];
  const gridItems = articles?.slice(3, 9) || [];
  const trendingItems = articles?.slice(9, 14) || [];
  const moreItems = articles?.slice(14) || [];

  return (
    <div className="pt-14 lg:pt-0 pb-28 lg:pb-8">
      {/* Header */}
      <div className="pt-8 lg:pt-10 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-bokari-500/8 dark:bg-bokari-500/10 flex items-center justify-center">
              <Compass size={20} className="text-bokari-500" />
            </div>
            <div>
              <h1
                className="text-2xl lg:text-3xl text-black/90 dark:text-white/90 tracking-tight"
                style={{ fontFamily: 'Instrument Serif, Georgia, serif' }}
              >
                Decouvrir
              </h1>
              <p className="text-[12px] text-black/40 dark:text-white/30 mt-0.5">
                L'actualite africaine analysee par Bokari
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 rounded-xl text-black/30 dark:text-white/20 hover:text-black/50 dark:hover:text-white/40 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-all duration-200 disabled:opacity-30"
          >
            <RefreshCw size={16} className={cn(refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Stats */}
        {articles && !loading && (
          <div className="mt-3">
            <StatsBar
              articles={articles.length}
              cached={cached}
              nextUpdate={nextUpdate}
            />
          </div>
        )}
      </div>

      <Separator className="bg-black/[0.05] dark:bg-white/[0.05]" />

      {/* Tabs navigation */}
      <div className="py-4 -mx-1">
        <Tabs value={activeTopic} onValueChange={(v) => setActiveTopic(v as string)}>
          <div className="overflow-x-auto scrollbar-hide px-1">
            <TabsList variant="line" className="h-auto gap-0.5 w-max">
              {(topics.length > 0
                ? topics
                : [
                    { key: 'africa', label: 'Afrique', icon: 'globe' },
                    { key: 'tech', label: 'Tech & IA', icon: 'cpu' },
                    { key: 'finance', label: 'Economie', icon: 'trending-up' },
                    { key: 'art', label: 'Culture', icon: 'palette' },
                    { key: 'sports', label: 'Sports', icon: 'trophy' },
                    { key: 'politics', label: 'Politique', icon: 'landmark' },
                    { key: 'sante', label: 'Sante', icon: 'heart-pulse' },
                  ]
              ).map((t) => (
                <TabsTrigger
                  key={t.key}
                  value={t.key}
                  className="px-3 py-2 text-[13px] gap-1.5 rounded-lg data-active:text-bokari-600 dark:data-active:text-bokari-400"
                >
                  <span className={cn(
                    'p-1 rounded-md transition-colors',
                    activeTopic === t.key
                      ? topicColors[t.key] || 'bg-bokari-500/10 text-bokari-500'
                      : 'text-black/40 dark:text-white/30',
                  )}>
                    {iconMap[t.icon] || <Globe size={15} />}
                  </span>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value={activeTopic} className="mt-0">
            {/* Content renders below regardless of active tab since we manage state manually */}
          </TabsContent>
        </Tabs>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-8 pt-2">
          <HeroSkeleton />
          <GridSkeleton />
        </div>
      ) : !articles || articles.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <div className="w-14 h-14 rounded-2xl bg-black/[0.04] dark:bg-white/[0.04] flex items-center justify-center mb-4">
            <Compass className="text-black/25 dark:text-white/20" size={24} />
          </div>
          <p className="text-sm text-black/40 dark:text-white/35 mb-1">
            Aucun article disponible pour le moment.
          </p>
          <p className="text-[11px] text-black/25 dark:text-white/20">
            Essayez une autre categorie ou rafraichissez la page.
          </p>
        </div>
      ) : (
        <div className="space-y-8 pt-2">
          {/* Hero section - A la une */}
          {heroItems.length >= 3 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-sm font-semibold text-black/70 dark:text-white/70">
                  A la une
                </h2>
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-bokari-500/10 text-bokari-600 dark:text-bokari-400 border-0 rounded-md">
                  Nouveau
                </Badge>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <HeroCard item={heroItems[0]} index={0} className="h-52 lg:h-72" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                  <HeroCard item={heroItems[1]} index={1} className="h-40 lg:h-[calc(50%-6px)]" />
                  <HeroCard item={heroItems[2]} index={2} className="h-40 lg:h-[calc(50%-6px)]" />
                </div>
              </div>
            </section>
          )}

          {/* Grid section */}
          {gridItems.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-black/70 dark:text-white/70">
                  Les dernieres infos
                </h2>
                <span className="text-[10px] text-black/25 dark:text-white/20">
                  {gridItems.length} articles
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {gridItems.map((item, i) => (
                  <ArticleCard key={`grid-${i}`} item={item} index={i} />
                ))}
              </div>
            </section>
          )}

          {/* Trending sidebar + more articles */}
          {(trendingItems.length > 0 || moreItems.length > 0) && (
            <section>
              <Separator className="bg-black/[0.05] dark:bg-white/[0.05] mb-8" />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Trending list */}
                {trendingItems.length > 0 && (
                  <div className="lg:col-span-1">
                    <Card className="border-0 ring-0 shadow-none bg-transparent">
                      <CardHeader className="px-0 pt-0">
                        <div className="flex items-center gap-2">
                          <TrendingUp size={14} className="text-bokari-500" />
                          <CardTitle className="text-sm font-semibold text-black/70 dark:text-white/70">
                            Tendances
                          </CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="px-0">
                        <FeaturedRow items={trendingItems} />
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* More articles */}
                {moreItems.length > 0 && (
                  <div className={cn(
                    trendingItems.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3',
                  )}>
                    <h2 className="text-sm font-semibold text-black/70 dark:text-white/70 mb-4">
                      A lire aussi
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {moreItems.slice(0, 6).map((item, i) => (
                        <ArticleCard key={`more-${i}`} item={item} index={i + 6} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default Page;
