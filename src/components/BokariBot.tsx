import { cn } from '@/lib/utils';

type Props = {
  /** Pixel size of the (square) avatar. Default 28. */
  size?: number;
  className?: string;
};

/**
 * BokariBot — the chatbot's avatar (the illustrated, tech-suit Bokari). Shown
 * next to assistant answers + the "thinking" indicator in the chat. Served from
 * /public/bokari-chatbot.png (head-and-shoulders), rendered as a zoomed
 * background focused on the FACE so it reads clearly at small sizes — same
 * framing as BokariAvatar. Dark-aware ring for light + dark chat surfaces.
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
    <span
      className="block h-full w-full"
      style={{
        backgroundImage: "url('/bokari-chatbot.png')",
        backgroundRepeat: 'no-repeat',
        backgroundSize: '148%',
        backgroundPosition: '50% 18%',
      }}
    />
  </span>
);

export default BokariBot;
