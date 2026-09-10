'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Power, RotateCcw } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';

type SourceRow = {
  id: number;
  domain: string;
  name: string;
  country: string | null;
  tier: number;
  isStateMedia: boolean;
  isCertified: boolean;
  enabled: boolean;
  lastFetchAt: string | null;
  lastFetchStatus: string | null;
  consecutiveFailures: number;
  articleCount: number;
};

const TIER_LABEL: Record<number, string> = {
  1: 'Agence / certifié',
  2: 'Presse privée',
  3: 'Agrégateur',
};

export default function AdminNewsSourcesPage() {
  const { accessToken } = useAuth();
  const [sources, setSources] = useState<SourceRow[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch('/api/admin/news-sources', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.status === 403 || res.status === 404) {
        setForbidden(true);
        return;
      }
      const data = await res.json();
      setSources(Array.isArray(data.sources) ? data.sources : []);
    } catch {
      setSources([]);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = async (id: number, body: Record<string, unknown>) => {
    setBusy(id);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/news-sources', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken ?? ''}`,
        },
        body: JSON.stringify({ id, ...body }),
      });
      if (!res.ok) {
        setNotice('La modification a échoué.');
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  };

  if (forbidden) {
    return (
      <p className="mt-20 text-center text-sm text-neutral-500">
        Accès réservé aux administrateurs.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-lg font-semibold tracking-tight">
        Sources d’actualité
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Les flux ingérés par le crawler horaire. Un flux qui échoue cinq fois
        est désactivé automatiquement ; tu peux le réarmer ici.
      </p>

      {notice && <p className="mt-4 text-sm text-rose-600">{notice}</p>}

      {!sources ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500">
                <th className="px-4 py-2.5 font-medium">Média</th>
                <th className="px-4 py-2.5 font-medium">Rang</th>
                <th className="px-4 py-2.5 font-medium">Articles</th>
                <th className="px-4 py-2.5 font-medium">Dernier fetch</th>
                <th className="px-4 py-2.5 font-medium">État</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {sources.map((s) => (
                <tr key={s.id} className={s.enabled ? '' : 'opacity-60'}>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-neutral-500">
                      {s.domain}
                      {s.country ? ` · ${s.country}` : ''}
                      {s.isStateMedia ? ' · média d’État' : ''}
                      {s.isCertified ? ' · certifié' : ''}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-neutral-600">
                    {TIER_LABEL[s.tier] ?? `tier ${s.tier}`}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{s.articleCount}</td>
                  <td className="px-4 py-2.5 text-xs text-neutral-500">
                    {s.lastFetchAt
                      ? new Date(s.lastFetchAt).toLocaleString('fr-FR')
                      : '—'}
                    {s.lastFetchStatus && s.lastFetchStatus !== 'ok' && (
                      <span
                        className="block truncate text-rose-600"
                        title={s.lastFetchStatus}
                      >
                        {s.lastFetchStatus}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {s.enabled ? (
                      <Badge variant="secondary" className="text-[10px]">
                        actif
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px]">
                        désactivé
                      </Badge>
                    )}
                    {s.enabled && s.consecutiveFailures >= 3 && (
                      <Badge variant="outline" className="ml-1 text-[10px]">
                        {s.consecutiveFailures} échecs
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {s.enabled ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy === s.id}
                        onClick={() => patch(s.id, { enabled: false })}
                      >
                        <Power size={13} /> Désactiver
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy === s.id}
                        onClick={() => patch(s.id, { rearm: true })}
                      >
                        <RotateCcw size={13} /> Réarmer
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
