/**
 * Citation round-trip: the <citation> tag produced by useChat (with its
 * data-source="S1" attribute) must survive markdown-to-jsx and reach the
 * Citation component, which renders the anchor the click-to-source handler
 * needs to find the matching [data-source-card] card.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'markdown-to-jsx';
import Citation from '@/components/MessageRenderer/Citation';

describe('Citation round-trip', () => {
  const html = renderToStaticMarkup(
    <Markdown
      options={{
        overrides: { citation: { component: Citation } },
      }}
    >
      {
        'Selon RFI <citation href="https://rfi.fr/x" title="Titre" data-source="S1">RFI</citation> le prix monte.'
      }
    </Markdown>,
  );

  it('renders the pill with the source id preserved', () => {
    expect(html).toContain('data-source="S1"');
    expect(html).toContain('href="https://rfi.fr/x"');
    expect(html).toContain('>RFI</a>');
  });
});
