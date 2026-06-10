export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import AppShell from '@/components/AppShell';
import { Toaster } from 'sonner';
import ThemeProvider from '@/components/theme/Provider';
import { ChatProvider } from '@/lib/hooks/useChat';
import { AuthProvider } from '@/lib/hooks/useAuth';
import AuthModal from '@/components/AuthModal';

const inter = Inter({
  weight: ['300', '400', '500', '600'],
  subsets: ['latin'],
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
});

export const metadata: Metadata = {
  title: 'Bokari - Journaliste IA Africain',
  description:
    'Bokari est un journaliste IA intelligent qui combat les fake news en Afrique. Recherche, verifie, informe.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className="h-full" lang="fr" suppressHydrationWarning>
      <body className={cn('h-full antialiased bg-light-primary dark:bg-dark-primary', inter.className)} suppressHydrationWarning>
        {/* TEMP diagnostic: surface any client JS / hydration error on-device
            (esp. mobile Safari) in a bottom bar, since such errors are otherwise
            invisible and leave the app stuck on the SSR "Chargement…". Remove
            once the chat-load issue is confirmed fixed. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){window.__bkErrors=[];function show(m){try{window.__bkErrors.push(m);var d=document.getElementById('__bkerr');if(!d){d=document.createElement('div');d.id='__bkerr';d.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#b91c1c;color:#fff;font:11px monospace;padding:4px 6px;white-space:pre-wrap;max-height:35vh;overflow:auto';document.body.appendChild(d);}d.textContent=(d.textContent?d.textContent+' | ':'JS ERROR: ')+m;}catch(_){}}window.addEventListener('error',function(e){show((e.message||'err')+' @'+((e.filename||'').split('/').pop())+':'+(e.lineno||0));});window.addEventListener('unhandledrejection',function(e){var r=e.reason;show('promise: '+((r&&(r.message||r.toString&&r.toString()))||'rejection'));});})();",
          }}
        />
        <ThemeProvider>
          <AuthProvider>
            <ChatProvider>
              <AppShell>{children}</AppShell>
              <AuthModal />
              <Toaster
                toastOptions={{
                  unstyled: true,
                  classNames: {
                    toast:
                      'bg-light-secondary dark:bg-dark-secondary dark:text-white/70 text-black-70 rounded-lg p-4 flex flex-row items-center space-x-2',
                  },
                }}
              />
            </ChatProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
