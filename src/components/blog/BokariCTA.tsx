import Link from 'next/link';
import { BadgeCheck, ArrowRight, Sparkles } from 'lucide-react';
import BokariAvatar from '@/components/BokariAvatar';

/**
 * End-of-article CTA card. Styled as a Bokari "chat answer turn" — same avatar
 * and "Vérifié & sourcé" mark as the article byline — so the journalistic trust
 * carries straight into the call to action. Server component (Link-based, no
 * hooks) so it ships in the initial SEO HTML.
 *
 * The suggestion chip pre-fills a query (`/?q=…`) so the reader lands inside
 * Bokari mid-question — the activation moment — rather than on a cold homepage.
 * (No public marketing domain yet, so links resolve to "/".)
 */
const BokariCTA = ({
  question = 'Quels sont les chiffres clés à retenir ?',
}: {
  question?: string;
}) => {
  const qHref = `/?q=${encodeURIComponent(question)}`;
  return (
    <section
      className="bk-grid mt-12 overflow-hidden rounded-3xl border-2 border-[color:var(--bk-ink,#0f172a)] bg-[color:var(--bk-teal,#14b8a6)]/[0.06] p-7 shadow-[0_6px_0_var(--bk-ink,#0f172a)] sm:p-9"
      aria-labelledby="bokari-cta-title"
    >
      {/* Header row — reads like a Bokari chat turn */}
      <div className="flex items-center gap-3">
        <BokariAvatar size={44} />
        <div className="flex flex-col">
          <span className="font-display text-[17px] leading-tight text-[color:var(--bk-ink,#0f172a)]">
            Bokari
          </span>
          <span className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-full bg-[color:var(--bk-teal,#14b8a6)]/10 px-2 py-0.5 text-[11px] font-medium text-[color:var(--bk-teal-700,#0f766e)]">
            <BadgeCheck size={12} strokeWidth={2.2} aria-hidden="true" />
            Vérifié &amp; sourcé
          </span>
        </div>
      </div>

      <h2
        id="bokari-cta-title"
        className="mt-5 text-balance font-display text-2xl leading-tight text-[color:var(--bk-ink,#0f172a)] sm:text-3xl"
      >
        Vous venez de lire une réponse vérifiée. Posez la vôtre.
      </h2>
      <p className="font-hand mt-3 max-w-xl text-lg text-[color:var(--bk-ink-soft,#334155)]">
        Bokari cherche, recoupe les sources africaines et vous répond — sourcé, en quelques secondes.
      </p>

      {/* Suggestion chip + primary button */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link
          href={qHref}
          className="font-hand inline-flex items-center gap-2 rounded-full border-2 border-[color:var(--bk-ink,#0f172a)]/15 bg-white px-4 py-2 text-[14px] text-[color:var(--bk-ink,#0f172a)] transition-transform hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--bk-teal,#14b8a6)]"
        >
          <Sparkles size={15} strokeWidth={2} className="text-[color:var(--bk-teal-700,#0f766e)]" aria-hidden="true" />
          <span className="line-clamp-1">{question}</span>
        </Link>
        <Link
          href="/"
          className="font-hand inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-[color:var(--bk-teal-700,#0f766e)] bg-[color:var(--bk-teal,#14b8a6)] px-5 py-2.5 text-[15px] uppercase tracking-wide text-white shadow-[0_4px_0_var(--bk-teal-700,#0f766e)] transition-transform hover:-translate-y-px active:translate-y-[2px] active:shadow-[0_2px_0_var(--bk-teal-700,#0f766e)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--bk-teal,#14b8a6)] focus-visible:ring-offset-2"
        >
          Essayer Bokari gratuitement
          <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
};

export default BokariCTA;
