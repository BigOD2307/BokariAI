'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, XCircle, AlertTriangle, Clock } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';

type JobRow = {
  name: string;
  cursor: number;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  runs: number;
};

type UsageSlice = {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
};

type Overview = {
  jobs: JobRow[];
  articlesByStatus: { draft: number; published: number; rejected: number };
  corpus: {
    articles: number;
    embedded: number;
    sourcesEnabled: number;
    sourcesDisabled: number;
    sourcesFailing: number;
  };
  usage?: {
    windowHours: number;
    events: number;
    total: UsageSlice;
    byModel: Record<string, UsageSlice>;
    byLabel: Record<string, UsageSlice>;
  };
};

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const JOB_LABEL: Record<string, string> = {
  'news-crawl': 'Crawl des flux news',
  'discover-daily': 'Fil Découvrir',
  'articles-rotate': 'Génération d’articles',
  'stats-weekly': 'Chiffres de l’Afrique',
};

function StatusIcon({ status }: { status: string | null }) {
  if (status === 'ok')
    return <CheckCircle2 size={15} className="text-emerald-600" />;
  if (status === 'running')
    return <Clock size={15} className="animate-pulse text-blue-600" />;
  if (status === 'error')
    return <XCircle size={15} className="text-rose-600" />;
  return <AlertTriangle size={15} className="text-amber-600" />;
}

export default function AdminOverviewPage() {
  const { accessToken } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError(false);
    try {
      const res = await fetch('/api/admin/overview', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.status === 403 || res.status === 404) {
        setForbidden(true);
        return;
      }
      setData(await res.json());
    } catch {
      setError(true);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  if (forbidden) {
    return (
      <p className="mt-20 text-center text-sm text-neutral-500">
        Accès réservé aux administrateurs.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-lg font-semibold tracking-tight">Vue d’ensemble</h1>
      <p className="mt-1 text-sm text-neutral-500">
        État des jobs autonomes, du corpus d’actualité et du blog.
      </p>

      {error && (
        <p className="mt-6 text-sm text-rose-600">
          Impossible de charger les données.{' '}
          <button onClick={load} className="underline">
            Réessayer
          </button>
        </p>
      )}

      {!data ? (
        <div className="mt-8 space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {/* Jobs */}
          <section>
            <h2 className="mb-3 text-sm font-medium text-neutral-700">
              Jobs autonomes
            </h2>
            <Card>
              <CardContent className="divide-y divide-neutral-100 p-0">
                {data.jobs.map((job) => (
                  <div
                    key={job.name}
                    className="flex items-start gap-3 px-5 py-3.5"
                  >
                    <div className="mt-0.5">
                      <StatusIcon status={job.lastStatus} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {JOB_LABEL[job.name] ?? job.name}
                        </span>
                        {job.lastStatus === 'error' && (
                          <Badge
                            variant="destructive"
                            className="h-5 text-[10px]"
                          >
                            erreur
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {job.lastRunAt
                          ? new Date(job.lastRunAt).toLocaleString('fr-FR')
                          : 'jamais exécuté'}{' '}
                        · {job.runs} exécution{job.runs > 1 ? 's' : ''}
                      </p>
                      {job.lastError && (
                        <p
                          className="mt-1 truncate text-xs text-rose-600"
                          title={job.lastError}
                        >
                          {job.lastError}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          {/* Usage (LLM cost, last 24h) */}
          {data.usage && (
            <section>
              <h2 className="mb-3 text-sm font-medium text-neutral-700">
                Coût LLM — dernières 24 h
              </h2>
              <Card>
                <CardContent className="space-y-3 px-5 py-4">
                  <div className="flex items-baseline gap-3">
                    <p className="text-2xl font-semibold">
                      ${data.usage.total.estimatedCostUsd.toFixed(3)}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {data.usage.total.calls} appels ·{' '}
                      {fmtTokens(data.usage.total.totalTokens)} tokens
                    </p>
                  </div>
                  {Object.keys(data.usage.byLabel).length > 0 && (
                    <div className="overflow-hidden rounded-lg border border-neutral-200">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-neutral-50 text-left text-neutral-500">
                            <th className="px-3 py-1.5 font-medium">Rôle</th>
                            <th className="px-3 py-1.5 text-right font-medium">
                              Appels
                            </th>
                            <th className="px-3 py-1.5 text-right font-medium">
                              Tokens
                            </th>
                            <th className="px-3 py-1.5 text-right font-medium">
                              Coût est.
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                          {Object.entries(data.usage.byLabel)
                            .sort((a, b) => b[1].totalTokens - a[1].totalTokens)
                            .map(([label, s]) => (
                              <tr key={label}>
                                <td className="px-3 py-1.5 font-medium">
                                  {label}
                                </td>
                                <td className="px-3 py-1.5 text-right tabular-nums">
                                  {s.calls}
                                </td>
                                <td className="px-3 py-1.5 text-right tabular-nums">
                                  {fmtTokens(s.totalTokens)}
                                </td>
                                <td className="px-3 py-1.5 text-right tabular-nums">
                                  ${s.estimatedCostUsd.toFixed(4)}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {Object.keys(data.usage.byModel).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(data.usage.byModel).map(([model, s]) => (
                        <Badge
                          key={model}
                          variant="secondary"
                          className="text-[10px]"
                        >
                          {model} · {fmtTokens(s.totalTokens)}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {data.usage.total.calls === 0 && (
                    <p className="text-xs text-neutral-500">
                      Aucun appel mesuré depuis le dernier redémarrage — les
                      compteurs sont en mémoire et repartent à zéro au
                      déploiement.
                    </p>
                  )}
                </CardContent>
              </Card>
            </section>
          )}

          {/* Corpus + articles */}
          <section className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-neutral-700">
                  Corpus d’actualité
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <p className="text-2xl font-semibold">{data.corpus.articles}</p>
                <p className="text-xs text-neutral-500">
                  articles · {data.corpus.embedded} vectorisés
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge variant="secondary" className="text-[10px]">
                    {data.corpus.sourcesEnabled} flux actifs
                  </Badge>
                  {data.corpus.sourcesDisabled > 0 && (
                    <Badge variant="outline" className="text-[10px]">
                      {data.corpus.sourcesDisabled} désactivés
                    </Badge>
                  )}
                  {data.corpus.sourcesFailing > 0 && (
                    <Badge variant="destructive" className="text-[10px]">
                      {data.corpus.sourcesFailing} en échec
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-neutral-700">
                  Blog
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <p className="text-2xl font-semibold">
                  {data.articlesByStatus.published}
                </p>
                <p className="text-xs text-neutral-500">articles publiés</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge variant="secondary" className="text-[10px]">
                    {data.articlesByStatus.draft} en relecture
                  </Badge>
                  {data.articlesByStatus.rejected > 0 && (
                    <Badge variant="outline" className="text-[10px]">
                      {data.articlesByStatus.rejected} rejetés
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      )}
    </div>
  );
}
