'use client';

import { cn } from '@/lib/utils';
import { Search, Compass, Plus, Menu, User } from 'lucide-react';
import Link from 'next/link';
import { useSelectedLayoutSegments } from 'next/navigation';
import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import Layout from './Layout';
import SettingsDialogue from './Settings/SettingsDialogue';
import { useAuth } from '@/lib/hooks/useAuth';
import { useNewThreadShortcut } from '@/lib/hooks/useShortcuts';
import HistoryBand from './Sidebar/HistoryBand';
import BokariAvatar from '@/components/BokariAvatar';
import MobileActionsMenu from './Sidebar/MobileActionsMenu';

// Bokari Canvas recipes (light "paper" world — shared with the marketing site).
const NAV_ACTIVE =
  'border-2 border-[color:var(--bk-teal-700,#0f766e)] bg-gradient-to-br from-[#14b8a6] to-[#0d9488] text-white shadow-[0_2px_0_var(--bk-teal-700,#0f766e)]';
const NAV_IDLE =
  'border-2 border-transparent text-[color:var(--bk-ink-soft,#334155)] hover:border-[color:var(--bk-ink,#0f172a)] hover:bg-[color:var(--bk-mint,#c8f4e0)]/40 hover:text-[color:var(--bk-ink,#0f172a)]';

const Sidebar = ({ children }: { children: React.ReactNode }) => {
  const segments = useSelectedLayoutSegments();
  const { user, loading: authLoading } = useAuth();
  // Desktop sidebar is collapsed by default and slides open ON HOVER — no toggle.
  const [hovered, setHovered] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useNewThreadShortcut();

  const openSettings = () => {
    setSettingsOpen(true);
    setMobileOpen(false);
  };

  const navLinks = [
    { icon: Search, href: '/', active: segments.length === 0 || segments.includes('c'), label: 'Recherche' },
    { icon: Compass, href: '/discover', active: segments.includes('discover'), label: 'Découvrir' },
  ];

  const renderSidebar = (collapsed: boolean) => (
    <>
      {/* Nouveau fil (first element — no top toggle row) */}
      <div className="px-3 pb-2 pt-3">
        <Link
          href="/"
          onClick={() => setMobileOpen(false)}
          className={cn(
            'group flex items-center gap-2.5 rounded-[10px] border-2 border-[color:var(--bk-ink,#0f172a)] bg-white shadow-[0_3px_0_rgba(15,23,42,0.10)] transition-transform hover:-translate-y-px active:translate-y-px',
            collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5',
          )}
        >
          <Plus size={16} strokeWidth={2.5} className="flex-shrink-0 text-[color:var(--bk-teal-600,#0d9488)]" />
          {!collapsed && (
            <span className="font-hand whitespace-nowrap text-[15px] uppercase tracking-wide text-[color:var(--bk-ink,#0f172a)]">
              Nouveau fil
            </span>
          )}
        </Link>
      </div>

      {/* Nav */}
      <nav aria-label="Navigation principale" className="space-y-1 px-2">
        {navLinks.map((link, i) => (
          <Link
            key={i}
            href={link.href}
            onClick={() => setMobileOpen(false)}
            aria-current={link.active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-[10px] transition-colors',
              collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5',
              link.active ? NAV_ACTIVE : NAV_IDLE,
            )}
            title={collapsed ? link.label : undefined}
          >
            <link.icon size={18} strokeWidth={2} className="flex-shrink-0" />
            {!collapsed && <span className="font-hand whitespace-nowrap text-[15px]">{link.label}</span>}
          </Link>
        ))}
      </nav>

      {/* Historique — the chat list, directly in the sidebar (ChatGPT-style). */}
      {!collapsed && user ? (
        <div className="mt-3 flex min-h-0 flex-1 flex-col border-t-2 border-dashed border-[color:var(--bk-ink,#0f172a)]/12 pt-3">
          <p className="font-hand px-3 pb-1 text-[12px] uppercase tracking-wide text-[color:var(--bk-teal-700,#0f766e)]">
            Historique
          </p>
          <HistoryBand onItemClick={() => setMobileOpen(false)} />
        </div>
      ) : (
        <div className="flex-1" />
      )}

      {/* Bottom: profile avatar → opens settings (account / login live there). */}
      <div className="border-t-2 border-dashed border-[color:var(--bk-ink,#0f172a)]/12 px-2 pb-3 pt-2">
        {!authLoading && (
          <button
            onClick={openSettings}
            className={cn(
              'flex w-full items-center rounded-[10px] transition-colors hover:bg-[color:var(--bk-mint,#c8f4e0)]/40',
              collapsed ? 'justify-center p-1.5' : 'gap-2.5 p-2',
            )}
            title="Profil & paramètres"
          >
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-[color:var(--bk-ink,#0f172a)] bg-[color:var(--bk-mint,#c8f4e0)]/40 text-[color:var(--bk-ink,#0f172a)]">
              <User size={16} strokeWidth={2.2} />
            </span>
            {!collapsed && (
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-[13px] font-medium text-[color:var(--bk-ink,#0f172a)]">
                  {user ? user.name : 'Mon compte'}
                </p>
                <p className="font-hand truncate text-[11px] text-[color:var(--bk-teal-700,#0f766e)]">
                  {user
                    ? user.plan === 'free'
                      ? 'Plan Gratuit'
                      : user.plan === 'pro'
                        ? 'Plan Pro'
                        : 'Enterprise'
                    : 'Se connecter'}
                </p>
              </div>
            )}
          </button>
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop: a 68px rail that expands over the content on hover. */}
      <div className="relative hidden w-[68px] flex-shrink-0 lg:block">
        <aside
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className={cn(
            'fixed left-0 top-0 z-40 flex h-screen flex-col overflow-hidden border-r-2 border-[color:var(--bk-ink,#0f172a)] bg-[color:var(--bk-paper,#ffffff)] transition-[width] duration-200',
            hovered ? 'w-[260px] shadow-[10px_0_30px_-12px_rgba(15,23,42,0.30)]' : 'w-[68px]',
          )}
          aria-label="Barre laterale"
        >
          {renderSidebar(!hovered)}
        </aside>
      </div>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-[color:var(--bk-ink,#0f172a)]/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={cn(
          'fixed bottom-0 left-0 top-0 z-50 flex w-[300px] max-w-[85vw] flex-col border-r-2 border-[color:var(--bk-ink,#0f172a)] bg-[color:var(--bk-paper,#ffffff)] transition-transform duration-300 lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Menu mobile"
      >
        {renderSidebar(false)}
      </aside>

      {/* Mobile top bar — single Bokari avatar (brand), burger (nav + settings
          live in the drawer), and a "+" actions menu (new chat / share /
          download). No bottom nav: Recherche & Découvrir are in the drawer. */}
      <div className="fixed top-0 z-30 flex h-14 w-full items-center justify-between border-b-2 border-[color:var(--bk-ink,#0f172a)] bg-[color:var(--bk-paper,#ffffff)]/90 px-3 backdrop-blur-md lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-[10px] p-2 text-[color:var(--bk-ink,#0f172a)]/55 transition-colors hover:bg-[color:var(--bk-mint,#c8f4e0)]/50 hover:text-[color:var(--bk-ink,#0f172a)]"
          aria-label="Ouvrir le menu"
        >
          <Menu size={20} strokeWidth={2} />
        </button>
        <Link href="/" className="flex items-center gap-2" aria-label="Accueil Bokari">
          <BokariAvatar size={38} />
          <span className="font-display text-[19px] leading-none text-[color:var(--bk-ink,#0f172a)]">
            Bokari
          </span>
        </Link>
        <MobileActionsMenu />
      </div>

      <Layout>{children}</Layout>

      <AnimatePresence>
        {settingsOpen && <SettingsDialogue isOpen={settingsOpen} setIsOpen={setSettingsOpen} />}
      </AnimatePresence>
    </div>
  );
};

export default Sidebar;
