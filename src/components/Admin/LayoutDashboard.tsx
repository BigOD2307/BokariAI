'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Newspaper,
  LayoutDashboard as DashboardIcon,
  Rss,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Minimal admin chrome: a fixed left sidebar (shadcn tokens) with the nav
 * sections, and the children in a scrollable main area. No sidebar
 * collapse state to manage — the admin is desktop-first by design.
 */
const NAV = [
  { href: '/admin', label: 'Vue d’ensemble', icon: DashboardIcon },
  { href: '/admin/articles', label: 'Articles', icon: Newspaper },
  { href: '/admin/news-sources', label: 'Sources news', icon: Rss },
];

export default function LayoutDashboard({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r border-neutral-200 bg-white">
        <div className="flex h-14 items-center gap-2 border-b border-neutral-200 px-5">
          <span className="text-sm font-semibold tracking-tight">Bokari</span>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium uppercase text-neutral-500">
            Admin
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active =
              href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-neutral-100 font-medium text-neutral-900'
                    : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900',
                )}
              >
                <Icon size={15} className="shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-neutral-200 p-3">
          <a
            href="/"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
          >
            <ExternalLink size={15} className="shrink-0" />
            Retour à Bokari
          </a>
        </div>
      </aside>
      <main className="ml-60 flex-1 px-8 py-6">{children}</main>
    </div>
  );
}
