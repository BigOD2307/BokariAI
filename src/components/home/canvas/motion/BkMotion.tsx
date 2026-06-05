'use client';

/**
 * BkMotion — a small, reusable scroll-animation toolkit for the Bokari home,
 * built on the `motion` library (framer-motion successor) via `motion/react`.
 *
 * Design intent (Notion-level restraint): tasteful scroll-triggered reveals,
 * staggered children, and gentle scroll-linked parallax. Premium and calm —
 * NOT flashy "AI" gimmicks.
 *
 * Performance + accessibility contract:
 *  - Animates ONLY `transform` + `opacity` (60fps target on low-end Android).
 *  - `useReducedMotion()` short-circuits EVERY animation to a static, fully
 *    visible state (the OS-level prefers-reduced-motion is honored by motion).
 *  - SSR-safe: no `window`/`document` access at module scope; all DOM-linked
 *    work runs inside hooks/refs (client only).
 *  - Tree-shakable NAMED exports only — there is intentionally no default export.
 *
 * Usage:
 *   import { Reveal, Stagger, StaggerItem, Parallax } from '@/components/home/canvas/motion/BkMotion';
 *
 *   <Reveal>…</Reveal>
 *   <Stagger><StaggerItem>…</StaggerItem><StaggerItem>…</StaggerItem></Stagger>
 *   <Parallax depth={40}>…decorative layer…</Parallax>
 */

import { useMemo, useRef } from 'react';
import type { ElementType, ReactNode } from 'react';
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type Variants,
  type Transition,
} from 'motion/react';

/* ────────────────────────────────────────────────────────────────────────────
 * Shared timing — calm, unhurried, snappy enough to never feel slow.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Default upward slide distance for a reveal (px). Small + tasteful. */
const DEFAULT_Y = 16;

/** Reveal duration (seconds). 550ms reads as premium without dragging. */
const REVEAL_DURATION = 0.55;

/** Easing — gentle ease-out. */
const EASE_OUT: Transition['ease'] = [0.22, 1, 0.36, 1];

/**
 * Negative root margin so a reveal triggers slightly BEFORE the element is fully
 * on screen — content is already settled by the time the user reaches it.
 */
const VIEWPORT_MARGIN = '0px 0px -12% 0px';

/* ════════════════════════════════════════════════════════════════════════════
 * Reveal — fade + small upward slide as the element enters the viewport.
 * ════════════════════════════════════════════════════════════════════════════ */

export type RevealProps = {
  children: ReactNode;
  /** Render element / motion-able component. Defaults to a <div>. */
  as?: ElementType;
  /** Delay before the reveal starts, in seconds. Default 0. */
  delay?: number;
  /** Upward slide distance in px (the element starts this far below). Default 16. */
  y?: number;
  /** Reveal duration in seconds. Default 0.55. */
  duration?: number;
  /** Play once (default) or replay every time it re-enters the viewport. */
  once?: boolean;
  /** Fraction of the element that must be visible to trigger (0–1). Default 0.2. */
  amount?: number;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * <Reveal> — the workhorse scroll reveal.
 *
 * Under reduced motion it renders its children in the final, visible state with
 * no transition (animate === initial === visible), so nothing is ever hidden.
 */
export function Reveal({
  children,
  as = 'div',
  delay = 0,
  y = DEFAULT_Y,
  duration = REVEAL_DURATION,
  once = true,
  amount = 0.2,
  className,
  style,
}: RevealProps) {
  const reduce = useReducedMotion();

  // Resolve the polymorphic element to its motion-wrapped counterpart.
  // MUST be memoized — calling motion.create() during render creates a NEW
  // component type every render, remounting children (e.g. the injected
  // composer) and firing state updates on unmounted instances.
  const MotionTag = useMemo(() => motion.create(as), [as]);

  const variants: Variants = reduce
    ? {
        hidden: { opacity: 1, y: 0 },
        visible: { opacity: 1, y: 0 },
      }
    : {
        hidden: { opacity: 0, y },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration, ease: EASE_OUT, delay },
        },
      };

  return (
    <MotionTag
      className={className}
      style={style}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount, margin: VIEWPORT_MARGIN }}
    >
      {children}
    </MotionTag>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 * Stagger + StaggerItem — a container that reveals its children in sequence.
 * ════════════════════════════════════════════════════════════════════════════ */

export type StaggerProps = {
  children: ReactNode;
  as?: ElementType;
  /** Gap between each child's reveal, in seconds. Default 0.08 (80ms). */
  stagger?: number;
  /** Initial delay before the first child starts, in seconds. Default 0. */
  delay?: number;
  once?: boolean;
  amount?: number;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * <Stagger> — wraps a group of <StaggerItem>s. The container itself has no
 * visual animation; it only orchestrates the timing of its children via
 * `staggerChildren`. Keep the gap small (≤ ~80ms) so it feels snappy and the
 * total delay never snowballs across many items.
 */
export function Stagger({
  children,
  as = 'div',
  stagger = 0.08,
  delay = 0,
  once = true,
  amount = 0.2,
  className,
  style,
}: StaggerProps) {
  const reduce = useReducedMotion();
  const MotionTag = useMemo(() => motion.create(as), [as]);

  const container: Variants = {
    hidden: {},
    visible: {
      transition: reduce
        ? {}
        : { staggerChildren: stagger, delayChildren: delay },
    },
  };

  return (
    <MotionTag
      className={className}
      style={style}
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount, margin: VIEWPORT_MARGIN }}
    >
      {children}
    </MotionTag>
  );
}

export type StaggerItemProps = {
  children: ReactNode;
  as?: ElementType;
  /** Upward slide distance in px. Default 16. */
  y?: number;
  /** Per-item duration in seconds. Default 0.5. */
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * <StaggerItem> — a single child of <Stagger>. It inherits the `hidden`/`visible`
 * orchestration from its parent (no `initial`/`whileInView` of its own — that is
 * driven by variant propagation), so its reveal timing is governed by the
 * container's `staggerChildren`.
 *
 * Under reduced motion the variants resolve to the visible state immediately.
 */
export function StaggerItem({
  children,
  as = 'div',
  y = DEFAULT_Y,
  duration = 0.5,
  className,
  style,
}: StaggerItemProps) {
  const reduce = useReducedMotion();
  const MotionTag = useMemo(() => motion.create(as), [as]);

  const item: Variants = reduce
    ? {
        hidden: { opacity: 1, y: 0 },
        visible: { opacity: 1, y: 0 },
      }
    : {
        hidden: { opacity: 0, y },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration, ease: EASE_OUT },
        },
      };

  return (
    <MotionTag className={className} style={style} variants={item}>
      {children}
    </MotionTag>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 * Parallax — gentle scroll-linked translateY for depth (decorative layers).
 * ════════════════════════════════════════════════════════════════════════════ */

export type ParallaxProps = {
  children: ReactNode;
  /**
   * Drift amount in px across the element's full scroll-through. Positive values
   * make the layer move UP (slower than scroll → "further away"); negative
   * values drift it DOWN. Keep small (background ≈ 24–40, midground ≈ 60–80).
   * `speed` is an alias for `depth`.
   */
  depth?: number;
  /** Alias for `depth` — whichever is provided wins (depth takes precedence). */
  speed?: number;
  className?: string;
  style?: React.CSSProperties;
  /** aria-hidden the wrapper (parallax layers are usually decorative). */
  ariaHidden?: boolean;
};

/**
 * <Parallax> — wraps children in a transform-only layer whose translateY is
 * linked to how far the element has scrolled through the viewport.
 *
 * Uses `useScroll({ target, offset: ['start end', 'end start'] })` so
 * `scrollYProgress` goes 0 → 1 from "element's top hits viewport bottom" to
 * "element's bottom leaves viewport top" — i.e. the entire on-screen lifetime.
 *
 * Under reduced motion the y mapping is flattened to a constant 0, so the layer
 * is completely static (no scroll listeners drive any movement).
 */
/** Internal: the animated layer. Only mounted when motion is allowed, so its
 *  scroll listener + will-change never exist under reduced motion. */
function ParallaxLayer({
  children,
  drift,
  className,
  style,
  ariaHidden,
}: {
  children: ReactNode;
  drift: number;
  className?: string;
  style?: React.CSSProperties;
  ariaHidden: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  // Centered around the element's natural position (no initial jump).
  const y = useTransform(scrollYProgress, [0, 1], [drift / 2, -drift / 2]);

  return (
    <motion.div
      ref={ref}
      aria-hidden={ariaHidden || undefined}
      className={className}
      style={{ ...style, y, willChange: 'transform' }}
    >
      {children}
    </motion.div>
  );
}

export function Parallax({
  children,
  depth,
  speed,
  className,
  style,
  ariaHidden = true,
}: ParallaxProps) {
  const reduce = useReducedMotion();
  // Resolve drift: `depth` wins, else `speed`, else a calm default.
  const drift = depth ?? speed ?? 40;

  // Reduced motion: a plain static layer — no useScroll listener, no
  // will-change, no permanently-promoted compositor layer.
  if (reduce) {
    return (
      <div aria-hidden={ariaHidden || undefined} className={className} style={style}>
        {children}
      </div>
    );
  }

  return (
    <ParallaxLayer drift={drift} className={className} style={style} ariaHidden={ariaHidden}>
      {children}
    </ParallaxLayer>
  );
}
