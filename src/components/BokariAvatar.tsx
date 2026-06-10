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
 * answers (BokariBot). The source (/public/bokari-face.png) is a 512px square
 * pre-cropped to the FACE, so we render it 1:1 with object-cover — no CSS zoom,
 * which kept the avatar soft on high-DPR phones. The browser downscales the
 * high-res source, so it stays crisp at every size. Swap that single file to
 * re-skin Bokari across the whole product.
 */
const BokariAvatar = ({ size = 40, className, ring = true }: Props) => (
  <span
    className={cn(
      'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white',
      ring && 'border-2 border-[color:var(--bk-ink,#0f172a)]',
      className,
    )}
    style={{ width: size, height: size }}
    role="img"
    aria-label="Bokari"
  >
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src="/bokari-face.png"
      alt=""
      draggable={false}
      className="block h-full w-full object-cover"
    />
  </span>
);

export default BokariAvatar;
