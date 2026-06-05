/* eslint-disable @next/next/no-img-element */
import { cn } from '@/lib/utils';

type Props = {
  /** Pixel size of the (square) avatar. Default 28. */
  size?: number;
  className?: string;
};

/**
 * BokariBot — the chatbot's avatar (the illustrated, tech-suit Bokari). Shown
 * next to assistant answers + the "thinking" indicator in the chat, the way
 * Claude/ChatGPT badge their responses. Served from /public/bokari-chatbot.png
 * (pre-cropped to head-and-shoulders, optimized). Dark-aware ring so it sits
 * well on both light and dark chat surfaces.
 */
const BokariBot = ({ size = 28, className }: Props) => (
  <span
    className={cn(
      'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-black/5 ring-1 ring-black/10 dark:bg-white/5 dark:ring-white/15',
      className,
    )}
    style={{ width: size, height: size }}
  >
    <img
      src="/bokari-chatbot.png"
      alt="Bokari"
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className="h-full w-full object-cover"
      style={{ objectPosition: '50% 30%' }}
    />
  </span>
);

export default BokariBot;
