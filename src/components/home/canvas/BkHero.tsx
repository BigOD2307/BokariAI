'use client';

import type React from 'react';

/**
 * BkHero — Section 1 of the 3-section Bokari home.
 *
 * Presentational only. The real search box (<LandingComposer/>) is injected via
 * {children} so the app keeps ownership of routing + focus registration. Buttons
 * fire onStart / onDemo callbacks supplied by the parent.
 *
 * AESTHETIC: Notion B&W "paper" restraint. Ink (#0f172a) on paper (#fff) is the
 * dominant language; teal (#14b8a6) appears only as a SINGLE sparing accent (one
 * subtitle underline + one sticky note). The hero keeps the signature animated
 * SELECT-BOX framing a punchy Chewy value prop — but the H1 is now a few-word
 * value prop ("Cherchez. Vérifiez. Citez."), NOT the bare brand word.
 *
 * MOTION: tasteful, premium, transform/opacity-only.
 *  - <Reveal> fades + small-slides the eyebrow / H1 / subtitle / CTA on load.
 *  - <Parallax> drifts the few decorative layers (notes + doodles) slowly on
 *    scroll for depth.
 *  - Both honor useReducedMotion AND prefers-reduced-motion (the shared bk-
 *    stylesheet also freezes the CSS ambient motion), short-circuiting to a
 *    static, fully-visible state.
 */

import { MousePointer2, ShieldCheck, Layers } from 'lucide-react';

import { Reveal, Parallax } from '@/components/home/canvas/motion/BkMotion';

type SearchMode = 'rapide' | 'standard' | 'approfondi';

type Props = {
  /** Anchor id so the page can scroll to the hero / search box. */
  id?: string;
  /** The injected search box (the app passes <LandingComposer registerFocus=… />). */
  children?: React.ReactNode;
  /** Primary CTA — "Commencer". */
  onStart?: () => void;
  /** Secondary CTA — "Voir la démo". */
  onDemo?: () => void;
  /** Currently active search mode (carried through the contract; reserved). */
  activeMode?: SearchMode;
  /** Fired when the active search mode changes (carried through the contract). */
  onModeChange?: (mode: SearchMode) => void;
};

const BkHero = ({
  id = 'accueil',
  children,
  onStart,
  onDemo,
  // onStart / onDemo / activeMode / onModeChange stay on Props for the parent
  // contract, but the hero no longer renders CTA buttons or a mode toolbar —
  // the injected <LandingComposer/> is the single, focused call-to-action.
  onStart: _onStart,
  onDemo: _onDemo,
  activeMode: _activeMode,
  onModeChange: _onModeChange,
}: Props) => {
  return (
    <section
      id={id}
      aria-labelledby="bk-hero-title"
      className="bk-grid bk-grid-fade relative isolate flex min-h-[88vh] items-center overflow-hidden px-4 pb-20 pt-16 scroll-mt-20 md:px-8 lg:pt-24"
    >
      {/* ───────────────────────── Ambient canvas decorations ─────────────────────────
          Notion restraint: only TWO sticky notes (mostly paper/ink, one teal accent)
          and two faint doodles. Decorative → aria-hidden. Hidden on small screens so
          the title + search box stay the unobstructed focal point. Each layer drifts
          slowly on scroll via <Parallax> (transform-only). */}
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
        {/* Top-left: paper/ink note (no color) — slow background drift */}
        <div className="absolute left-[4%] top-[18%] hidden lg:block">
          <Parallax depth={28}>
            <div className="bk-note bk-rot-n3 bk-note-float">
              <span className="bk-tape" />
              <ShieldCheck className="h-5 w-5" strokeWidth={2.1} />
              <span className="bk-hand">Vérifié &amp; cité</span>
            </div>
          </Parallax>
        </div>

        {/* Bottom-right: the SINGLE teal-accented note — slightly faster drift */}
        <div className="absolute right-[5%] bottom-[20%] hidden md:block">
          <Parallax depth={44}>
            <div className="bk-note bk-note-cyan bk-rot-p3 bk-note-float-2">
              <span className="bk-tape bk-tape--sand" />
              <Layers className="h-5 w-5" strokeWidth={2.1} />
              <span className="bk-hand">Multi-sources</span>
            </div>
          </Parallax>
        </div>

        {/* Faint hand-drawn doodle arrow — top-left, points toward the title */}
        <Parallax
          depth={20}
          className="absolute left-[18%] top-[26%] hidden lg:block"
        >
          <svg className="bk-doodle h-14 w-20" viewBox="0 0 96 64" fill="none">
            <path
              className="bk-doodle-path bk-doodle-path--sand"
              pathLength={100}
              d="M4 10 C 30 6, 52 22, 70 40"
            />
            <path
              className="bk-doodle-path bk-doodle-path--sand bk-doodle-delay-1"
              pathLength={100}
              d="M70 40 L 58 32 M70 40 L 62 52"
            />
          </svg>
        </Parallax>

        {/* Faint teal squiggle — bottom-left near the CTA (the one teal doodle) */}
        <Parallax
          depth={34}
          className="absolute left-[12%] bottom-[24%] hidden lg:block"
        >
          <svg className="bk-doodle h-12 w-24" viewBox="0 0 112 56" fill="none">
            <path
              className="bk-doodle-path bk-doodle-path--teal"
              pathLength={100}
              d="M108 14 C 80 4, 40 12, 22 34 C 14 44, 24 52, 34 46"
            />
          </svg>
        </Parallax>
      </div>

      {/* ───────────────────────────────── Center column ──────────────────────────── */}
      <div className="relative z-10 mx-auto flex w-full max-w-[760px] flex-col items-center text-center">
        {/* Eyebrow — small playful label */}
        <Reveal as="p" className="bk-eyebrow mb-6 text-sm sm:text-base">
          Le journaliste IA africain
        </Reveal>

        {/* Signature SELECT-BOX framing the punchy Chewy value prop */}
        <Reveal delay={0.08} className="w-full">
          <div
            className="bk-select-box mx-auto"
            style={
              {
                // Cursor travel path tuned to this box (consumed by bk- keyframes).
                ['--bk-cursor-x' as string]: '106%',
                ['--bk-cursor-y' as string]: '118%',
              } as React.CSSProperties
            }
          >
            {/* Figma-style name chip */}
            <span className="bk-sb-tag" aria-hidden="true">
              Bokari
            </span>

            {/* Four self-drawing edges */}
            <span className="bk-sb-edge bk-sb-top" aria-hidden="true" />
            <span className="bk-sb-edge bk-sb-right" aria-hidden="true" />
            <span className="bk-sb-edge bk-sb-bottom" aria-hidden="true" />
            <span className="bk-sb-edge bk-sb-left" aria-hidden="true" />

            {/* Eight popping handles */}
            <span className="bk-sb-handle bk-sb-h-tl" aria-hidden="true" />
            <span className="bk-sb-handle bk-sb-h-tc" aria-hidden="true" />
            <span className="bk-sb-handle bk-sb-h-tr" aria-hidden="true" />
            <span className="bk-sb-handle bk-sb-h-ml" aria-hidden="true" />
            <span className="bk-sb-handle bk-sb-h-mr" aria-hidden="true" />
            <span className="bk-sb-handle bk-sb-h-bl" aria-hidden="true" />
            <span className="bk-sb-handle bk-sb-h-bc" aria-hidden="true" />
            <span className="bk-sb-handle bk-sb-h-br" aria-hidden="true" />

            {/* Traveling pointer */}
            <MousePointer2
              className="bk-sb-cursor"
              strokeWidth={2.4}
              aria-hidden="true"
            />

            <h1
              id="bk-hero-title"
              className="bk-display bk-ink px-5 py-2 text-5xl leading-[1.05] sm:text-6xl md:text-7xl lg:text-[5.75rem]"
            >
              Ne crois rien. Vérifie tout.
            </h1>
          </div>
        </Reveal>

        {/* One-line subtitle (Patrick Hand) — ONE teal underline on a key word */}
        <Reveal as="p" delay={0.16} className="bk-hand bk-ink-soft mt-7 max-w-[36rem] text-lg leading-snug sm:text-xl">
          Posez une question, Bokari fouille de nombreuses sources et répond avec
          des citations <span className="bk-underline">vérifiées</span>.
        </Reveal>

        {/* ── Search box slot — THE focal point. The app injects <LandingComposer/>. ── */}
        <Reveal delay={0.24} className="bk-hero-slot relative mt-9 w-full max-w-[620px]">
          {children}
        </Reveal>

      </div>

      {/* Soft seam so the hero blends into the next section */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-24 bg-gradient-to-b from-transparent to-[var(--bk-paper)]"
        aria-hidden="true"
      />
    </section>
  );
};

export default BkHero;
