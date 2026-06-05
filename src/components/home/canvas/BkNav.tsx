'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Newspaper, BarChart3, Menu, X, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import BokariAvatar from '@/components/BokariAvatar';

/**
 * BkNav — the shared Bokari Canvas top navigation (home, blog, article…).
 *
 * Self-contained: reads the current route (active highlight) and auth state
 * itself, so it can be dropped on any page with no props. The nav cell of the
 * page you're on gets a teal GRADIENT to show where you are. Right side keeps
 * only "Connexion" (or the avatar → history when signed in).
 */

type NavItem = { label: string; href: string; icon: LucideIcon };

const NAV_ITEMS: NavItem[] = [
  { label: 'Accueil', href: '/', icon: Home },
  { label: 'Data', href: '/data', icon: BarChart3 },
  { label: 'Blog', href: '/blog', icon: Newspaper },
];

const isActive = (href: string, pathname: string) =>
  href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

const ACTIVE_CELL =
  'border-[color:var(--bk-teal-700,#0f766e)] bg-gradient-to-br from-[#14b8a6] to-[#0d9488] text-white shadow-[0_3px_0_var(--bk-teal-700,#0f766e)]';
const IDLE_CELL =
  'border-transparent text-[color:var(--bk-ink-soft,#334155)] hover:border-[color:var(--bk-ink,#0f172a)] hover:text-[color:var(--bk-ink,#0f172a)]';

const BkNav = () => {
  const pathname = usePathname() || '/';
  const { user, loading: authLoading, setShowAuthModal } = useAuth();
  const [open, setOpen] = useState(false);

  // Lock body scroll while the mobile sheet is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close the mobile sheet on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-50 w-full border-b-2 border-[color:var(--bk-ink,#0f172a)] bg-[color:var(--bk-paper,#ffffff)]/80 backdrop-blur-md">
      <nav
        aria-label="Navigation principale"
        className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-3 px-4 md:px-8"
      >
        {/* Left: logo + menu */}
        <div className="flex min-w-0 items-center gap-3 lg:gap-5">
          <Link
            href="/"
            aria-label="Bokari — accueil"
            className="flex shrink-0 items-center gap-2 rounded-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--bk-teal,#14b8a6)] focus-visible:ring-offset-2"
          >
            <BokariAvatar size={40} />
            <span className="font-display hidden text-[19px] leading-none text-[color:var(--bk-ink,#0f172a)] sm:inline">
              Bokari
            </span>
          </Link>

          <ul className="hidden items-center gap-1.5 lg:flex">
            {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
              const active = isActive(href, pathname);
              return (
                <li key={label}>
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={`font-hand flex items-center gap-1.5 rounded-[10px] border-2 px-3 py-1.5 text-[15px] uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--bk-teal,#14b8a6)] ${
                      active ? ACTIVE_CELL : IDLE_CELL
                    }`}
                  >
                    <Icon size={15} strokeWidth={2.25} aria-hidden="true" className="shrink-0" />
                    <span>{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Right: Connexion / avatar + mobile toggle */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {!authLoading && !user && (
            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              className="font-hand rounded-[8px] border-2 border-[color:var(--bk-ink,#0f172a)] bg-white px-4 py-1.5 text-[15px] uppercase tracking-wide text-[color:var(--bk-ink,#0f172a)] shadow-[0_3px_0_rgba(15,23,42,0.08)] transition-transform hover:-translate-y-px active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--bk-teal,#14b8a6)] focus-visible:ring-offset-2"
            >
              Connexion
            </button>
          )}
          {!authLoading && user && (
            <Link
              href="/"
              aria-label="Mon historique"
              className="flex items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--bk-teal,#14b8a6)] focus-visible:ring-offset-2"
            >
              <BokariAvatar size={36} />
            </Link>
          )}

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={open}
            aria-controls="bk-nav-mobile"
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border-2 border-[color:var(--bk-ink,#0f172a)] bg-white text-[color:var(--bk-ink,#0f172a)] shadow-[0_3px_0_rgba(15,23,42,0.08)] transition-transform active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--bk-teal,#14b8a6)] focus-visible:ring-offset-2 lg:hidden"
          >
            {open ? (
              <X size={20} strokeWidth={2.25} aria-hidden="true" />
            ) : (
              <Menu size={20} strokeWidth={2.25} aria-hidden="true" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile sheet */}
      {open && (
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 top-16 z-40 cursor-default bg-[color:var(--bk-ink,#0f172a)]/20 backdrop-blur-[1px] lg:hidden"
          tabIndex={-1}
        />
      )}
      <div
        id="bk-nav-mobile"
        className={`absolute inset-x-0 top-16 z-50 origin-top border-b-2 border-[color:var(--bk-ink,#0f172a)] bg-white lg:hidden ${
          open ? '' : 'pointer-events-none hidden'
        }`}
      >
        <ul className="mx-auto flex max-w-[1200px] flex-col gap-2 px-4 py-4">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const active = isActive(href, pathname);
            return (
              <li key={label}>
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={`font-hand flex items-center gap-3 rounded-[10px] border-2 px-3.5 py-2.5 text-[16px] uppercase tracking-wide shadow-[0_3px_0_rgba(15,23,42,0.06)] transition-transform active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--bk-teal,#14b8a6)] ${
                    active
                      ? ACTIVE_CELL
                      : 'border-[color:var(--bk-ink,#0f172a)] bg-white text-[color:var(--bk-ink,#0f172a)]'
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${
                      active
                        ? 'border-white/40 bg-white/15 text-white'
                        : 'border-[color:var(--bk-ink,#0f172a)] bg-[color:var(--bk-mint,#c8f4e0)] text-[color:var(--bk-ink,#0f172a)]'
                    }`}
                    aria-hidden="true"
                  >
                    <Icon size={15} strokeWidth={2.25} />
                  </span>
                  {label}
                </Link>
              </li>
            );
          })}

          <li className="mt-2 border-t-2 border-dashed border-[color:var(--bk-ink,#0f172a)]/15 pt-3">
            {!user ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setShowAuthModal(true);
                }}
                className="font-hand w-full rounded-[8px] border-2 border-[color:var(--bk-ink,#0f172a)] bg-white px-4 py-2.5 text-[16px] uppercase tracking-wide text-[color:var(--bk-ink,#0f172a)] shadow-[0_3px_0_rgba(15,23,42,0.06)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--bk-teal,#14b8a6)]"
              >
                Connexion
              </button>
            ) : (
              <Link
                href="/"
                onClick={() => setOpen(false)}
                className="font-hand flex items-center justify-center gap-2 rounded-[8px] border-2 border-[color:var(--bk-ink,#0f172a)] bg-white px-4 py-2.5 text-[16px] uppercase tracking-wide text-[color:var(--bk-ink,#0f172a)] shadow-[0_3px_0_rgba(15,23,42,0.06)]"
              >
                Mon historique
              </Link>
            )}
          </li>
        </ul>
      </div>
    </header>
  );
};

export default BkNav;
