'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Markdown from 'markdown-to-jsx';
import { Check, X, Eye, RotateCcw, Sparkles, Loader2, ExternalLink } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { CATEGORIES, getCategory } from '@/lib/blog/categories';

type AdminSource = { id: number; title: string; outlet: string; url: string };
type AdminArticle = {
  id: string;
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  body: string;
  status: 'draft' | 'published' | 'rejected';
  readingMinutes: number;
  origin: string;
  sources: AdminSource[];
  generatedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
};

type Tab = 'draft' | 'published' | 'rejected';

const TABS: { key: Tab; label: string }[] = [
  { key: 'draft', label: 'Brouillons' },
  { key: 'published', label: 'Publiés' },
  { key: 'rejected', label: 'Rejetés' },
];

export default function AdminArticlesPage() {
  const { user, accessToken } = useAuth();
  const [tab, setTab] = useState<Tab>('draft');
  const [articles, setArticles] = useState<AdminArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [genCategory, setGenCategory] = useState(CATEGORIES[0]?.slug ?? '');
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const authHeaders = useCallback((): HeadersInit => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) h.Authorization = `Bearer ${accessToken}`;
    return h;
  }, [accessToken]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setForbidden(false);
    try {
      const res = await fetch(`/api/admin/articles?status=${tab}`, {
        headers: authHeaders(),
      });
      if (res.status === 403) {
        setForbidden(true);
        setArticles([]);
        return;
      }
      const data = await res.json();
      setArticles(Array.isArray(data.articles) ? data.articles : []);
    } catch {
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, tab, authHeaders]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id: string, action: 'publish' | 'reject' | 'unpublish') => {
    setBusy(id);
    try {
      await fetch(`/api/admin/articles/${id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ action }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const generate = async () => {
    setGenerating(true);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/articles', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ category: genCategory }),
      });
      const data = await res.json();
      const s = data?.summary;
      setNotice(
        s?.generated
          ? `Brouillon créé : « ${s.title} »`
          : `Aucun article généré (${s?.reason ?? 'raison inconnue'})`,
      );
      if (tab === 'draft') await load();
    } catch {
      setNotice('Échec de la génération.');
    } finally {
      setGenerating(false);
    }
  };

  if (!user) {
    return (
      <Shell>
        <p className="text-[15px] text-[color:var(--bk-ink-soft,#334155)]">
          Connecte-toi avec un compte administrateur pour accéder à la file de relecture.
        </p>
      </Shell>
    );
  }

  if (forbidden) {
    return (
      <Shell>
        <p className="text-[15px] text-[color:var(--bk-ink-soft,#334155)]">
          Accès réservé. Le compte <strong>{user.email}</strong> n&apos;est pas administrateur.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Generate on demand */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-[color:var(--bk-ink,#0f172a)]/12 bg-white p-4">
        <Sparkles size={18} className="text-[color:var(--bk-teal-700,#0f766e)]" />
        <span className="text-[14px] font-medium">Générer un brouillon</span>
        <select
          value={genCategory}
          onChange={(e) => setGenCategory(e.target.value)}
          className="rounded-lg border-2 border-[color:var(--bk-ink,#0f172a)]/15 bg-white px-3 py-1.5 text-[14px]"
        >
          {CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
        <button
          onClick={generate}
          disabled={generating}
          className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[color:var(--bk-teal-700,#0f766e)] bg-[color:var(--bk-teal,#14b8a6)] px-3.5 py-1.5 text-[14px] font-medium text-white disabled:opacity-60"
        >
          {generating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          Générer
        </button>
        {notice && <span className="text-[13px] text-[color:var(--bk-ink-soft,#334155)]">{notice}</span>}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full border-2 px-4 py-1.5 text-[14px] font-medium transition-colors ${
              tab === t.key
                ? 'border-[color:var(--bk-ink,#0f172a)] bg-[color:var(--bk-ink,#0f172a)] text-white'
                : 'border-[color:var(--bk-ink,#0f172a)]/15 bg-white text-[color:var(--bk-ink,#0f172a)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-[color:var(--bk-ink-soft,#334155)]">
          <Loader2 size={18} className="animate-spin" /> Chargement…
        </div>
      ) : articles.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-[color:var(--bk-ink,#0f172a)]/15 px-5 py-12 text-center text-[15px] text-[color:var(--bk-ink-soft,#334155)]">
          Rien ici pour le moment.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {articles.map((a) => {
            const cat = getCategory(a.category);
            const isOpen = expanded === a.id;
            return (
              <article
                key={a.id}
                className="rounded-[16px] border-2 border-[color:var(--bk-ink,#0f172a)] bg-white p-5 shadow-[0_4px_0_rgba(15,23,42,0.06)]"
              >
                <div className="flex flex-wrap items-center gap-2 text-[12px]">
                  {cat && (
                    <span
                      className="rounded-full px-2.5 py-0.5 font-semibold"
                      style={{ backgroundColor: cat.tint, color: cat.ink }}
                    >
                      {cat.label}
                    </span>
                  )}
                  <span className="text-[color:var(--bk-ink,#0f172a)]/45">
                    {a.origin === 'auto' ? 'IA' : a.origin} · {a.readingMinutes} min ·{' '}
                    {a.sources.length} sources
                  </span>
                </div>

                <h3 className="mt-3 text-[19px] font-semibold leading-snug">{a.title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-[color:var(--bk-ink-soft,#334155)]">
                  {a.excerpt}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => setExpanded(isOpen ? null : a.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[color:var(--bk-ink,#0f172a)]/15 bg-white px-3 py-1.5 text-[13px] font-medium"
                  >
                    <Eye size={14} /> {isOpen ? 'Masquer' : 'Aperçu'}
                  </button>

                  {a.status !== 'published' && (
                    <button
                      onClick={() => act(a.id, 'publish')}
                      disabled={busy === a.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[color:var(--bk-teal-700,#0f766e)] bg-[color:var(--bk-teal,#14b8a6)] px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-60"
                    >
                      <Check size={14} /> Publier
                    </button>
                  )}
                  {a.status === 'draft' && (
                    <button
                      onClick={() => act(a.id, 'reject')}
                      disabled={busy === a.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[color:var(--bk-ink,#0f172a)]/15 bg-white px-3 py-1.5 text-[13px] font-medium text-[color:var(--bk-ink,#0f172a)] disabled:opacity-60"
                    >
                      <X size={14} /> Rejeter
                    </button>
                  )}
                  {a.status === 'published' && (
                    <>
                      <Link
                        href={`/blog/${a.slug}`}
                        target="_blank"
                        className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[color:var(--bk-ink,#0f172a)]/15 bg-white px-3 py-1.5 text-[13px] font-medium"
                      >
                        <ExternalLink size={14} /> Voir
                      </Link>
                      <button
                        onClick={() => act(a.id, 'unpublish')}
                        disabled={busy === a.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[color:var(--bk-ink,#0f172a)]/15 bg-white px-3 py-1.5 text-[13px] font-medium disabled:opacity-60"
                      >
                        <RotateCcw size={14} /> Dépublier
                      </button>
                    </>
                  )}
                  {a.status === 'rejected' && (
                    <button
                      onClick={() => act(a.id, 'publish')}
                      disabled={busy === a.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[color:var(--bk-ink,#0f172a)]/15 bg-white px-3 py-1.5 text-[13px] font-medium disabled:opacity-60"
                    >
                      <RotateCcw size={14} /> Restaurer
                    </button>
                  )}
                </div>

                {isOpen && (
                  <div className="mt-5 border-t border-[color:var(--bk-ink,#0f172a)]/10 pt-5">
                    <div className="prose prose-slate max-w-none prose-headings:text-[color:var(--bk-ink,#0f172a)] prose-p:text-[color:var(--bk-ink-soft,#334155)]">
                      <Markdown options={{ forceBlock: true }}>{a.body}</Markdown>
                    </div>
                    {a.sources.length > 0 && (
                      <ol className="mt-4 flex flex-col gap-1.5 text-[13px]">
                        {a.sources.map((s) => (
                          <li key={s.id} className="flex gap-2">
                            <span className="font-bold text-[color:var(--bk-teal-700,#0f766e)]">[{s.id}]</span>
                            <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">
                              {s.title} · {s.outlet}
                            </a>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bk-grid bk-grid-fade min-h-screen bg-white text-[color:var(--bk-ink,#0f172a)]">
      <main className="mx-auto w-full max-w-[820px] px-4 pb-24 pt-10 md:px-6">
        <p className="bk-eyebrow text-base">Admin</p>
        <h1 className="bk-display mt-2 text-3xl leading-tight sm:text-4xl">
          File de relecture
        </h1>
        <p className="mt-3 text-[15px] text-[color:var(--bk-ink-soft,#334155)]">
          Les articles générés par Bokari toutes les 5h arrivent ici en brouillon. Relis, puis
          publie ou rejette.
        </p>
        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}
