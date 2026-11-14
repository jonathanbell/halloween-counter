import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StatsPage } from '../components/StatsPage';
import { CURRENT_YEAR, FIRST_YEAR } from '../year';

// jsdom has no EventSource; the page only needs lastMessage
vi.mock('../hooks/useSSE', () => ({ useSSE: () => ({ lastMessage: null }) }));

// Totals per year: 2025 = 346, every later year = 100 + its offset
const totalFor = (year: number) => (year === FIRST_YEAR ? 346 : 100 + year - FIRST_YEAR);

describe('StatsPage', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      const year = Number(new URL(url, 'http://x').searchParams.get('year'));
      const body = url.startsWith('/api/stats') ? { total: totalFor(year), histogram: [] } : [];
      return Promise.resolve({ json: () => Promise.resolve(body) });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('offers every year from the first on record to now, newest selected', async () => {
    render(<StatsPage />);

    const years = Array.from({ length: CURRENT_YEAR - FIRST_YEAR + 1 }, (_, i) => String(CURRENT_YEAR - i));
    const buttons = await screen.findAllByRole('button');
    expect(buttons.map(b => b.textContent)).toEqual(years);
    expect(buttons[0]).toHaveClass('selected');
    expect(await screen.findByText(String(totalFor(CURRENT_YEAR)))).toBeInTheDocument();
  });

  it('shows the first year as its one recorded total', async () => {
    render(<StatsPage />);

    fireEvent.click(await screen.findByRole('button', { name: String(FIRST_YEAR) }));

    expect(await screen.findByText('346')).toBeInTheDocument();
    expect(screen.queryByText(`No handout data for ${FIRST_YEAR}`)).not.toBeInTheDocument();
  });
});
