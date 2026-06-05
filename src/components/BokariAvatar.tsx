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
 * answers (BokariBot). The source illustration (/public/bokari-chatbot.png) is a
 * head-and-shoulders portrait, so we render it as a zoomed background focused on
 * the FACE — fitting the whole square into the circle left the face tiny. Swap
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
    role="img"
    aria-label="Bokari"
  >
    <span
      className="block h-full w-full"
      style={{
        backgroundImage: "url('/bokari-chatbot.png')",
        backgroundRepeat: 'no-repeat',
        // Zoom in and bias upward so the face fills the circle.
        backgroundSize: '148%',
        backgroundPosition: '50% 18%',
      }}
    />
  </span>
);

export default BokariAvatar;
