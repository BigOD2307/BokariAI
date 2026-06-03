'use client';

import { cn } from '@/lib/utils';
import {
  Search,
  Compass,
  BookOpenText,
  Plus,
  LogIn,
  LogOut,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Menu,
} from 'lucide-react';
import Link from 'next/link';
import { useSelectedLayoutSegments } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import Layout from './Layout';
import SettingsButton from './Settings/SettingsButton';
import { useAuth } from '@/lib/hooks/useAuth';
import { useToggleSidebarShortcut, useNewThreadShortcut } from '@/lib/hooks/useShortcuts';
import HistoryBand from './Sidebar/HistoryBand';

const COLLAPSE_KEY = 'bokari.sidebar.collapsed';

const Sidebar = ({ children }: { children: React.ReactNode }) => {
  const segments = useSelectedLayoutSegments();
  const { user, loading: authLoading, setShowAuthModal, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const navLinks = [
    {
      icon: Search,
      href: '/',
      active: segments.length === 0 || segments.includes('c'),
      label: 'Recherche',
    },
    {
      icon: Compass,
      href: '/discover',
      active: segments.includes('discover'),
      label: 'Decouvrir',
    },
    {
      icon: BookOpenText,
      href: '/library',
      active: segments.includes('library'),
      label: 'Bibliotheque',
    },
  ];

  const sidebarBody = (
    <>
      <div className={cn('h-14 flex items-center justify-between', collapsed ? 'px-3' : 'px-4')}>
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-bokari-400 to-bokari-600 flex items-center justify-center shadow-sm flex-shrink-0">
            <span className="text-white text-sm font-bold" style={{ fontFamily: 'Instrument Serif, serif' }}>B</span>
          </div>
          {!collapsed && (
            <span
              className="text-[17px] text-black/90 dark:text-white/90 tracking-tight"
              style={{ fontFamily: 'Instrument Serif, serif', fontStyle: 'italic' }}
            >
              Bokari
            </span>
          )}
        </Link>
        {!collapsed && (
          <button
            onClick={() => updateCollapsed(true)}
            className="p-1.5 rounded-lg text-black/30 dark:text-white/30 hover:text-black/60 dark:hover:text-white/60 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
            title={`Replier (${typeof navigator !== 'undefined' && /Mac/.test(navigator.platform) ? 'Cmd' : 'Ctrl'}+B)`}
            aria-label="Replier la barre laterale"
          >
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>

      <div className={cn('pb-3', collapsed ? 'px-3' : 'px-3')}>
        <Link
          href="/"
          onClick={() => setMobileOpen(false)}
          className={cn(
            'flex items-center gap-2.5 rounded-xl border border-black/[0.08] dark:border-white/[0.08] transition-all duration-200 group hover:border-bokari-500/30 hover:bg-bokari-500/[0.03]',
            collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5',
          )}
        >
          <Plus size={16} className="text-black/50 dark:text-white/50 group-hover:text-bokari-500 transition-colors flex-shrink-0" />
          {!collapsed && (
            <span className="text-[13px] text-black/60 dark:text-white/50 group-hover:text-black/80 dark:group-hover:text-white/70 transition-colors">
              Nouveau fil
            </span>
          )}
        </Link>
      </div>

      <nav
        aria-label="Navigation principale"
        className={cn('space-y-0.5 px-2', collapsed ? '' : '')}
      >
        {navLinks.map((link, i) => (
          <Link
            key={i}
            href={link.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-3 rounded-xl transition-all duration-200',
              collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5',
              link.active
                ? 'bg-black/[0.05] dark:bg-white/[0.06] text-black dark:text-white'
                : 'text-black/50 dark:text-white/40 hover:text-black/80 dark:hover:text-white/70 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]',
            )}
            title={collapsed ? link.label : undefined}
          >
            <link.icon size={18} strokeWidth={link.active ? 2 : 1.5} className="flex-shrink-0" />
            {!collapsed && (
              <span className={cn('text-[13px]', link.active ? 'font-medium' : 'font-normal')}>
                {link.label}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {!collapsed && user && (
        <div className="flex-1 flex flex-col min-h-0 mt-3 border-t border-black/[0.06] dark:border-white/[0.06] pt-3">
          <p className="px-3 pb-1 text-[10px] font-medium uppercase tracking-wider text-black/30 dark:text-white/25">
            Historique
          </p>
          <HistoryBand onItemClick={() => setMobileOpen(false)} />
        </div>
      )}

      {!collapsed && !user && <div className="flex-1" />}

      <div className={cn('pb-3 pt-2 border-t border-black/[0.06] dark:border-white/[0.06] space-y-0.5', collapsed ? 'px-2' : 'px-2')}>
        {collapsed && (
          <button
            onClick={() => updateCollapsed(false)}
            className="w-full flex items-center justify-center p-2.5 rounded-xl text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/60 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors"
            aria-label="Deployer la barre laterale"
          >
            <PanelLeft size={18} />
          </button>
        )}

        {!authLoading && (
          user ? (
            <div className={cn('flex items-center rounded-xl', collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5')}>
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-bokari-400 to-bokari-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-[11px] font-semibold">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-black/80 dark:text-white/80 font-medium truncate">
                      {user.name}
                    </p>
                    <p className="text-[10px] text-black/35 dark:text-white/30 truncate">
                      {user.plan === 'free' ? 'Plan Gratuit' : user.plan === 'pro' ? 'Plan Pro' : 'Enterprise'}
                    </p>
                  </div>
                  <button
                    onClick={logout}
                    className="p-1.5 rounded-lg text-black/25 dark:text-white/25 hover:text-red-500 hover:bg-red-500/5 transition-colors"
                    title="Se deconnecter"
                    aria-label="Se deconnecter"
                  >
                    <LogOut size={14} />
                  </button>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className={cn(
                'w-full flex items-center rounded-xl text-black/50 dark:text-white/40 hover:text-black/80 dark:hover:text-white/70 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-all',
                collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
              )}
            >
              <LogIn size={18} strokeWidth={1.5} className="flex-shrink-0" />
              {!collapsed && <span className="text-[13px]">Se connecter</span>}
            </button>
          )
        )}
        {!collapsed && <SettingsButton />}
      </div>
    </>
  );

  return (
    <div className="h-screen flex overflow-hidden">
      <aside
        className={cn(
          'hidden lg:flex flex-col h-full flex-shrink-0 bg-light-100 dark:bg-dark-50 border-r border-black/[0.06] dark:border-white/[0.06] transition-all duration-300',
          collapsed ? 'w-[68px]' : 'w-[260px]',
        )}
        aria-label="Barre laterale"
      >
        {sidebarBody}
      </aside>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={cn(
          'lg:hidden fixed top-0 left-0 bottom-0 z-50 w-[300px] max-w-[85vw] flex flex-col bg-light-100 dark:bg-dark-50 border-r border-black/[0.06] dark:border-white/[0.06] transition-transform duration-300',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Menu mobile"
      >
        {sidebarBody}
      </aside>

      <div className="lg:hidden fixed top-0 w-full z-30 h-14 flex items-center justify-between px-4 bg-light-primary/90 dark:bg-dark-primary/90 backdrop-blur-xl border-b border-black/[0.06] dark:border-white/[0.06]">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-xl text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/60 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
          aria-label="Ouvrir le menu"
        >
          <Menu size={20} />
        </button>
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-bokari-400 to-bokari-600 flex items-center justify-center shadow-sm">
            <span className="text-white text-sm font-bold" style={{ fontFamily: 'Instrument Serif, serif' }}>B</span>
          </div>
          <span
            className="text-[15px] text-black/80 dark:text-white/80"
            style={{ fontFamily: 'Instrument Serif, serif', fontStyle: 'italic' }}
          >
            Bokari
          </span>
        </Link>
        <div className="flex items-center gap-1.5">
          {!authLoading && !user && (
            <button
              onClick={() => setShowAuthModal(true)}
              className="text-bokari-600 dark:text-bokari-400 text-xs font-medium px-3.5 py-1.5 rounded-full bg-bokari-500/8 dark:bg-bokari-500/10 hover:bg-bokari-500/12 transition-colors"
            >
              Connexion
            </button>
          )}
          {!authLoading && user && (
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-bokari-400 to-bokari-600 flex items-center justify-center">
              <span className="text-white text-[11px] font-semibold">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <Link
            href="/"
            className="p-2 rounded-xl text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/60 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
            aria-label="Nouveau fil"
          >
            <Plus size={20} />
          </Link>
        </div>
      </div>

      <div className="fixed bottom-0 w-full z-30 flex items-center justify-around bg-light-primary/90 dark:bg-dark-primary/90 backdrop-blur-xl px-2 py-2 lg:hidden border-t border-black/[0.06] dark:border-white/[0.06] safe-area-bottom">
        {navLinks.map((link, i) => (
          <Link
            href={link.href}
            key={i}
            className={cn(
              'flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all',
              link.active
                ? 'text-bokari-500'
                : 'text-black/35 dark:text-white/35',
            )}
          >
            <link.icon size={20} strokeWidth={link.active ? 2 : 1.5} />
            <span className="text-[10px] font-medium">{link.label}</span>
          </Link>
        ))}
      </div>

      <Layout>{children}</Layout>
    </div>
  );
};

export default Sidebar;
