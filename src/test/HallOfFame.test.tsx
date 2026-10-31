import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HallOfFame } from '../components/HallOfFame';

const rows = [
  { id: 7, initials: 'JB', score: 5200, avgMs: 280 },
  { id: 9, initials: 'BOO', score: 5200, avgMs: 300 },
  { id: 3, initials: 'AB', score: 3100, avgMs: null },
];

function mockLeaderboard(body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve(body) }));
}

describe('HallOfFame', () => {
  beforeEach(() => {
    // jsdom has no layout, so no scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.location.hash = '';
  });

  it('lists the year best first, ties sharing a rank', async () => {
    mockLeaderboard(rows);
    render(<HallOfFame year={2026} />);

    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('#1JB280ms5200');
    expect(items[1]).toHaveTextContent('#1BOO300ms5200');
    expect(items[2]).toHaveTextContent('#3AB3100');
    expect(fetch).toHaveBeenCalledWith('/api/leaderboard?year=2026');
    expect(screen.getByRole('heading')).toHaveTextContent('🏆 2026 Graveyard Bonk Hall of Fame');
  });

  it('highlights and scrolls to the score in the link', async () => {
    window.location.hash = '#score-9';
    mockLeaderboard(rows);
    render(<HallOfFame year={2026} />);

    const row = (await screen.findAllByRole('listitem'))[1];
    expect(row).toHaveClass('highlight');
    expect(row).toHaveAttribute('id', 'score-9');
    expect(row.scrollIntoView).toHaveBeenCalled();
  });

  it('invites the first player when the year is empty', async () => {
    mockLeaderboard([]);
    render(<HallOfFame year={2025} />);

    expect(await screen.findByRole('link', { name: /be the first/i })).toHaveAttribute('href', '/game');
  });
});
