'use client';

import { useCallback, useRef } from 'react';
import BkNav from './canvas/BkNav';
import BkHero from './canvas/BkHero';
import LandingComposer from './LandingComposer';

/**
 * The standalone Bokari home — a single, focused hero.
 *
 * Notion-style B&W "paper": the few-word value-prop H1 + Bokari's avatar + the
 * chat box, front-and-centre, so visitors ask immediately. No other sections.
 * Theme-independent light world (no app sidebar); white root.
 */
const Landing = () => {
  const focusInputRef = useRef<(() => void) | null>(null);

  const registerFocus = useCallback((fn: () => void) => {
    focusInputRef.current = fn;
  }, []);

  const scrollToChat = useCallback(() => {
    document
      .getElementById('accueil')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => focusInputRef.current?.(), 420);
  }, []);

  return (
    <div className="min-h-screen bg-white text-[color:var(--bk-ink,#0f172a)]">
      <BkNav />
      <main>
        <BkHero id="accueil" onStart={scrollToChat} onDemo={scrollToChat}>
          <LandingComposer registerFocus={registerFocus} />
        </BkHero>
      </main>
    </div>
  );
};

export default Landing;
