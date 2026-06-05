'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

/**
 * Chooses the layout shell based on the route.
 *
 * App surfaces (chat, library, discover) render inside the <Sidebar>
 * rail.  The marketing landing ("/"), public share pages ("/p/...")
 * and the setup wizard render standalone — no sidebar, no app chrome.
 */
const APP_PREFIXES = ['/c', '/library', '/discover', '/learn'];

const AppShell = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname() || '/';
  const isAppRoute = APP_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isAppRoute) {
    return <Sidebar>{children}</Sidebar>;
  }

  return <>{children}</>;
};

export default AppShell;
