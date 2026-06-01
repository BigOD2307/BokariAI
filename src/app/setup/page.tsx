'use client';

import { useEffect, useState } from 'react';
import { Copy, ExternalLink, Check, Database, CircleAlert, CircleCheck, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SetupStatus {
  ok: boolean;
  projectRef?: string;
  dashboardSqlEditor?: string;
  tableStatus: Record<
    string,
    { exists: boolean; columns?: string[]; missingColumns?: string[] }
  >;
  migration: { filename: string; sql: string };
}

export default function SetupPage() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/setup');
      const data = await r.json();
      setStatus(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const copy = async () => {
    if (!status) return;
    await navigator.clipboard.writeText(status.migration.sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="pt-14 lg:pt-6 pb-28 lg:pb-8 max-w-4xl mx-auto px-5">
      <div className="flex items-center gap-3 mb-6 pt-8">
        <div className="w-10 h-10 rounded-xl bg-bokari-500/10 flex items-center justify-center">
          <Database size={20} className="text-bokari-500" />
        </div>
        <div>
          <h1
            className="text-2xl lg:text-3xl text-black/90 dark:text-white/90 tracking-tight"
            style={{ fontFamily: 'Instrument Serif, Georgia, serif' }}
          >
            Configuration de la base
          </h1>
          <p className="text-[12px] text-black/40 dark:text-white/30 mt-0.5">
            Diagnostic et installation du schema Supabase
          </p>
        </div>
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="ml-auto p-2 rounded-xl text-black/30 dark:text-white/20 hover:text-black/50 dark:hover:text-white/40 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-all duration-200 disabled:opacity-30"
          title="Reverifier"
        >
          <Loader2 size={16} className={cn(loading && 'animate-spin')} />
        </button>
      </div>

      {loading && !status && (
        <div className="space-y-3">
          <div className="h-12 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] animate-pulse" />
          <div className="h-64 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] animate-pulse" />
        </div>
      )}

      {status && (
        <>
          <div
            className={cn(
              'rounded-2xl p-4 mb-6 flex items-start gap-3',
              status.ok
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
            )}
          >
            {status.ok ? <CircleCheck size={18} className="mt-0.5" /> : <CircleAlert size={18} className="mt-0.5" />}
            <div className="text-[13px] leading-relaxed">
              {status.ok ? (
                <>
                  Toutes les tables sont en place. Vous pouvez retourner a{' '}
                  <a href="/" className="underline font-medium">
                    l'accueil
                  </a>
                  .
                </>
              ) : (
                <>
                  Certaines tables manquent. Ouvrez le{' '}
                  <a
                    href={status.dashboardSqlEditor}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-medium inline-flex items-center gap-1"
                  >
                    SQL Editor Supabase
                    <ExternalLink size={11} />
                  </a>
                  , collez le script ci-dessous, puis cliquez sur <strong>Run</strong>.
                </>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-white/[0.02] overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.06] text-[12px] font-semibold text-black/70 dark:text-white/70">
              Etat des tables
            </div>
            <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
              {Object.entries(status.tableStatus).map(([t, s]) => (
                <div key={t} className="px-4 py-3 flex items-center gap-3 text-[13px]">
                  {s.exists ? (
                    <CircleCheck size={14} className="text-emerald-500" />
                  ) : (
                    <CircleAlert size={14} className="text-amber-500" />
                  )}
                  <span className="font-mono text-[12.5px]">{t}</span>
                  <span className="ml-auto text-[11px] text-black/40 dark:text-white/30">
                    {s.exists
                      ? s.missingColumns && s.missingColumns.length > 0
                        ? `manque: ${s.missingColumns.join(', ')}`
                        : `${s.columns?.length ?? 0} colonnes`
                      : 'absente'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {!status.ok && (
            <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-white/[0.02] overflow-hidden">
              <div className="px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
                <div className="text-[12px] font-semibold text-black/70 dark:text-white/70">
                  {status.migration.filename}
                </div>
                <button
                  onClick={copy}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] text-black/70 dark:text-white/70 inline-flex items-center gap-1.5"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copie' : 'Copier'}
                </button>
              </div>
              <pre className="p-4 text-[11.5px] leading-relaxed overflow-x-auto max-h-[480px] overflow-y-auto text-black/75 dark:text-white/75 font-mono">
                {status.migration.sql}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
