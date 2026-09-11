import { MouseEvent, useCallback } from 'react';

/**
 * Inline citation pill — the [Sn] contract rendered as a domain pill
 * (e.g. "RFI", "BBC"). Clicking scrolls to the source card in the same
 * message (Perplexity-style round-trip) and pulses it; the card itself
 * carries the external link. Ctrl/Cmd+click (or middle-click) still opens
 * the article directly in a new tab.
 */
const Citation = ({
  href,
  title,
  'data-source': dataSource,
  children,
}: {
  href: string;
  title?: string;
  /** The 'S1'..'Sn' id, from the data-source attribute (passed through verbatim by markdown-to-jsx). */
  'data-source'?: string;
  children: React.ReactNode;
}) => {
  const sourceId = dataSource;
  const handleClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      // Let modifier/middle clicks open the article directly.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1 || !sourceId)
        return;
      e.preventDefault();
      const section = e.currentTarget.closest('[data-message-section]');
      if (!section) return;
      const card =
        section.querySelector(`[data-source-card="${sourceId}"]`) ??
        section.querySelector('[data-sources-block]');
      if (card instanceof HTMLElement) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        card.classList.remove('source-flash');
        // Re-trigger the pulse when clicking the same citation twice.
        void card.offsetWidth;
        card.classList.add('source-flash');
        window.setTimeout(() => card.classList.remove('source-flash'), 1300);
      }
    },
    [sourceId],
  );

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title || href}
      data-source={dataSource}
      onClick={handleClick}
      className="inline-flex cursor-pointer items-center justify-center bg-bokari-500/8 hover:bg-bokari-500/14 px-1.5 py-0.5 rounded-md mx-0.5 no-underline text-[10px] font-semibold text-bokari-600 dark:text-bokari-400 transition-colors duration-150 align-middle min-w-[18px] tabular-nums"
    >
      {children}
    </a>
  );
};

export default Citation;
