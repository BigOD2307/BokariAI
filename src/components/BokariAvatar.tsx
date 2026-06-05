/* eslint-disable @next/next/no-img-element */
import { cn } from '@/lib/utils';

type Props = {
  /** Pixel size of the (square) avatar. Default 40. */
  size?: number;
  className?: string;
  /** Draw the Canvas ink ring around it. Default true. */
  ring?: boolean;
};

/**
 * Bokari's avatar — the single, consistent "face" of the chatbot, shown on every
 * surface (nav, sidebar, auth, blog) so it matches the avatar next to chat
 * answers (BokariBot). Served from /public/bokari-chatbot.png (head-and-shoulders
 * illustration), framed in a Canvas paper/ink circle. One image everywhere — swap
 * that single file to re-skin Bokari across the whole product.
 */
const BokariAvatar = ({ size = 40, className, ring = true }: Props) => (
  <span
    className={cn(
      'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white',
      ring && 'border-2 border-[color:var(--bk-ink,#0f172a)]',
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
      style={{ objectPosition: '50% 28%' }}
    />
  </span>
);

export default BokariAvatar;
