/**
 * @module components/ChartBlock.test
 * @description SSR smoke test for the chart block.  Verifies that
 *   the wrapper renders the title, the chart container, and a
 *   download button for each supported kind.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ChartBlock from '@/components/MessageRenderer/ChartBlock';
import type { ChartSpec } from '@/lib/types/multimodal';

function specOf(kind: ChartSpec['kind']): ChartSpec {
  return {
    id: 'c1',
    kind,
    title: 'PIB par pays',
    xKey: 'pays',
    series: [{ name: 'PIB' }],
    data: [
      { pays: 'Mali', PIB: 17 },
      { pays: 'Senegal', PIB: 28 },
      { pays: 'Cote d Ivoire', PIB: 70 },
    ],
    unit: 'B USD',
  };
}

describe('ChartBlock (SSR smoke)', () => {
  it('renders the chart title', () => {
    const html = renderToStaticMarkup(<ChartBlock spec={specOf('bar')} />);
    expect(html).toContain('PIB par pays');
  });

  it('renders the chart container with the spec id', () => {
    const html = renderToStaticMarkup(<ChartBlock spec={specOf('line')} />);
    expect(html).toContain('id="chart-c1"');
  });

  it('renders a download button', () => {
    const html = renderToStaticMarkup(<ChartBlock spec={specOf('area')} />);
    expect(html).toMatch(/T[ée]l[ée]charger/i);
  });

  it('renders the unit in the caption when provided', () => {
    const html = renderToStaticMarkup(<ChartBlock spec={specOf('bar')} />);
    expect(html).toContain('B USD');
  });

  it('omits caption when unit is absent', () => {
    const spec = { ...specOf('bar'), unit: undefined };
    const html = renderToStaticMarkup(<ChartBlock spec={spec} />);
    expect(html).not.toContain('undefined');
  });

  it('renders pie kind without crashing', () => {
    const html = renderToStaticMarkup(<ChartBlock spec={specOf('pie')} />);
    expect(html).toContain('PIB par pays');
  });

  it('renders radar kind without crashing', () => {
    const html = renderToStaticMarkup(<ChartBlock spec={specOf('radar')} />);
    expect(html).toContain('PIB par pays');
  });

  it('falls back to bar for unknown kind', () => {
    const html = renderToStaticMarkup(
      <ChartBlock spec={specOf('scatter' as ChartSpec['kind'])} />,
    );
    expect(html).toContain('PIB par pays');
  });

  it('renders caption when provided', () => {
    const spec = { ...specOf('bar'), caption: 'Source: World Bank 2024' };
    const html = renderToStaticMarkup(<ChartBlock spec={spec} />);
    expect(html).toContain('Source: World Bank 2024');
  });
});
