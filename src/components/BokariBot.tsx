import { cn } from '@/lib/utils';

type Props = {
  /** Pixel size of the (square) avatar. Default 28. */
  size?: number;
  className?: string;
};

/**
 * BokariBot — the chatbot's avatar (the illustrated, tech-suit Bokari). Shown
 * next to assistant answers + the "thinking" indicator in the chat. Served from
 * /public/bokari-face.png (512px square, pre-cropped to the FACE), rendered 1:1
 * with object-cover — same framing as BokariAvatar, no CSS zoom (which left it
 * soft on high-DPR phones). Dark-aware ring for light + dark chat surfaces.
 */
const BokariBot = ({ size = 28, className }: Props) => (
  <span
    className={cn(
      'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-black/5 ring-1 ring-black/10 dark:bg-white/5 dark:ring-white/15',
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

export default BokariBot;
