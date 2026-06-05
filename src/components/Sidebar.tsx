'use client';

import { cn } from '@/lib/utils';
import {
  Search,
  Compass,
  BookOpenText,
  Plus,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Menu,
} from 'lucide-react';
import Link from 'next/link';
import { useSelectedLayoutSegments } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import Layout from './Layout';
import SettingsDialogue from './Settings/SettingsDialogue';
import { useAuth } from '@/lib/hooks/useAuth';
import { useToggleSidebarShortcut, useNewThreadShortcut } from '@/lib/hooks/useShortcuts';
import HistoryBand from './Sidebar/HistoryBand';
import BokariAvatar from '@/components/BokariAvatar';

const COLLAPSE_KEY = 'bokari.sidebar.collapsed';

// Bokari Canvas recipes (light "paper" world — shared with the marketing site).
const NAV_ACTIVE =
  'border-2 border-[color:var(--bk-teal-700,#0f766e)] bg-gradient-to-br from-[#14b8a6] to-[#0d9488] text-white shadow-[0_2px_0_var(--bk-teal-700,#0f766e)]';
const NAV_IDLE =
  'border-2 border-transparent text-[color:var(--bk-ink-soft,#334155)] hover:border-[color:var(--bk-ink,#0f172a)] hover:bg-[color:var(--bk-mint,#c8f4e0)]/40 hover:text-[color:var(--bk-ink,#0f172a)]';

const Sidebar = ({ children }: { children: React.ReactNode }) => {
  const segments = useSelectedLayoutSegments();
  const { user, loading: authLoading } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(COLLAPSE_KEY);
    if (stored === 'true') setCollapsed(true);
  }, []);

  const updateCollapsed = (next: boolean) => {
    setCollapsed(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(COLLAPSE_KEY, String(next));
    }
  };

  useToggleSidebarShortcut(() => updateCollapsed(!collapsed));
  useNewThreadShortcut();

  const openSettings = () => {
    setSettingsOpen(true);
    setMobileOpen(false);
  };

  const navLinks = [
    { icon: Search, href: '/', active: segments.length === 0 || segments.includes('c'), label: 'Recherche' },
    { icon: Compass, href: '/discover', active: segments.includes('discover'), label: 'Découvrir' },
    { icon: BookOpenText, href: '/library', active: segments.includes('library'), label: 'Bibliothèque' },
  ];

  const sidebarBody = (
    <>
      {/* Slim top row — collapse control only (no logo header). */}
      {!collapsed && (
        <div className="flex h-10 items-center justify-end px-2 pt-1">
          <button
            onClick={() => updateCollapsed(true)}
            className="rounded-[8px] p-1.5 text-[color:var(--bk-ink,#0f172a)]/35 transition-colors hover:bg-[color:var(--bk-mint,#c8f4e0)]/50 hover:text-[color:var(--bk-ink,#0f172a)]"
            title={`Replier (${typeof navigator !== 'undefined' && /Mac/.test(navigator.platform) ? 'Cmd' : 'Ctrl'}+B)`}
            aria-label="Replier la barre laterale"
          >
            <PanelLeftClose size={16} strokeWidth={2} />
          </button>
        </div>
      )}

      {/* Nouveau fil */}
      <div className={cn('pb-2', collapsed ? 'px-3 pt-3' : 'px-3')}>
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
            <span className="font-hand text-[15px] uppercase tracking-wide text-[color:var(--bk-ink,#0f172a)]">
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
            {!collapsed && <span className="font-hand text-[15px]">{link.label}</span>}
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

      {/* Paramètres entry */}
      <div className="px-2 pt-1">
        <button
          onClick={openSettings}
          className={cn(
            'flex w-full items-center gap-3 rounded-[10px] transition-colors',
            collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5',
            NAV_IDLE,
          )}
          title={collapsed ? 'Paramètres' : undefined}
        >
          <Settings size={18} strokeWidth={2} className="flex-shrink-0" />
          {!collapsed && <span className="font-hand text-[15px]">Paramètres</span>}
        </button>
      </div>

      {/* Bottom: Bokari avatar → opens settings (account / login live there). */}
      <div className="space-y-1 border-t-2 border-dashed border-[color:var(--bk-ink,#0f172a)]/12 px-2 pb-3 pt-2">
        {collapsed && (
          <button
            onClick={() => updateCollapsed(false)}
            className="flex w-full items-center justify-center rounded-[10px] p-2.5 text-[color:var(--bk-ink,#0f172a)]/40 transition-colors hover:bg-[color:var(--bk-mint,#c8f4e0)]/40 hover:text-[color:var(--bk-ink,#0f172a)]"
            aria-label="Deployer la barre laterale"
          >
            <PanelLeft size={18} strokeWidth={2} />
          </button>
        )}

        {!authLoading && (
          <button
            onClick={openSettings}
            className={cn(
              'flex w-full items-center rounded-[10px] transition-colors hover:bg-[color:var(--bk-mint,#c8f4e0)]/40',
              collapsed ? 'justify-center p-1.5' : 'gap-2.5 p-2',
            )}
            title="Paramètres & compte"
          >
            <BokariAvatar size={32} />
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
      <aside
        className={cn(
          'hidden h-full flex-shrink-0 flex-col border-r-2 border-[color:var(--bk-ink,#0f172a)] bg-[color:var(--bk-paper,#ffffff)] transition-all duration-300 lg:flex',
          collapsed ? 'w-[68px]' : 'w-[260px]',
        )}
        aria-label="Barre laterale"
      >
        {sidebarBody}
      </aside>

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
        {sidebarBody}
      </aside>

      {/* Mobile top bar */}
      <div className="fixed top-0 z-30 flex h-14 w-full items-center justify-between border-b-2 border-[color:var(--bk-ink,#0f172a)] bg-[color:var(--bk-paper,#ffffff)]/90 px-4 backdrop-blur-md lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-[10px] p-2 text-[color:var(--bk-ink,#0f172a)]/45 transition-colors hover:bg-[color:var(--bk-mint,#c8f4e0)]/50 hover:text-[color:var(--bk-ink,#0f172a)]"
          aria-label="Ouvrir le menu"
        >
          <Menu size={20} strokeWidth={2} />
        </button>
        <Link href="/" className="flex items-center gap-2">
          <BokariAvatar size={30} />
          <span className="font-display text-[18px] leading-none text-[color:var(--bk-ink,#0f172a)]">
            Bokari
          </span>
        </Link>
        <div className="flex items-center gap-1.5">
          <button
            onClick={openSettings}
            className="rounded-full"
            aria-label="Paramètres & compte"
          >
            <BokariAvatar size={30} />
          </button>
          <Link
            href="/"
            className="rounded-[10px] p-2 text-[color:var(--bk-ink,#0f172a)]/45 transition-colors hover:bg-[color:var(--bk-mint,#c8f4e0)]/50 hover:text-[color:var(--bk-ink,#0f172a)]"
            aria-label="Nouveau fil"
          >
            <Plus size={20} strokeWidth={2.25} />
          </Link>
        </div>
      </div>

      {/* Mobile bottom bar */}
      <div className="safe-area-bottom fixed bottom-0 z-30 flex w-full items-center justify-around border-t-2 border-[color:var(--bk-ink,#0f172a)] bg-[color:var(--bk-paper,#ffffff)]/90 px-2 py-2 backdrop-blur-md lg:hidden">
        {navLinks.map((link, i) => (
          <Link
            href={link.href}
            key={i}
            aria-current={link.active ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center gap-0.5 rounded-[10px] px-4 py-1.5 transition-colors',
              link.active
                ? 'text-[color:var(--bk-teal-600,#0d9488)]'
                : 'text-[color:var(--bk-ink,#0f172a)]/40',
            )}
          >
            <link.icon size={20} strokeWidth={link.active ? 2.25 : 2} />
            <span className="font-hand text-[11px]">{link.label}</span>
          </Link>
        ))}
      </div>

      <Layout>{children}</Layout>

      <AnimatePresence>
        {settingsOpen && <SettingsDialogue isOpen={settingsOpen} setIsOpen={setSettingsOpen} />}
      </AnimatePresence>
    </div>
  );
};

export default Sidebar;
