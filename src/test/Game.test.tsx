import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Game } from '../components/Game';
import { initialPhoneState, type PhoneState } from '../game/phoneReducer';

// No WebSocket, no SSE, no WebGL: the hooks are pinned to a state per test
// and the three.js play view is a stub (jsdom has no WebGL context)
const mocks = vi.hoisted(() => ({
  state: null as unknown as PhoneState,
  now: 0,
  start: vi.fn(),
}));

vi.mock('../hooks/useGame', () => ({
  useGame: () => ({
    state: mocks.state,
    now: mocks.now,
    start: mocks.start,
    shown: vi.fn(),
    bonk: vi.fn(),
    tap: vi.fn(),
    reconnect: vi.fn(),
  }),
}));
vi.mock('../hooks/useGameFeed', () => ({ useGameFeed: () => ({ status: null }) }));
vi.mock('../game/models', () => ({ preloadScenery: vi.fn() }));
vi.mock('../game/PhoneGame', () => ({ PhoneGame: () => <div data-testid="phone-game" /> }));
vi.mock('../game/CastLineup', () => ({
  CastLineup: ({ heading, cast }: { heading: string; cast: Array<{ kind: string }> }) => (
    <section aria-label={heading}>{cast.map(c => c.kind).join(' ')}</section>
  ),
}));

const ready: PhoneState = { ...initialPhoneState, phase: 'ready', connected: true };

describe('Game', () => {
  beforeEach(() => {
    mocks.state = ready;
    mocks.now = 0;
    mocks.start.mockReset();
    localStorage.clear();
  });

  it('takes up to three letters of initials and starts with them', () => {
    render(<Game />);
    const input = screen.getByLabelText(/your initials/i);
    const start = screen.getByRole('button', { name: 'Start' });
    expect(start).toBeDisabled();

    fireEvent.change(input, { target: { value: 'j.b9xyz' } });
    expect(input).toHaveValue('JBX');

    fireEvent.click(start);
    expect(mocks.start).toHaveBeenCalledWith('JBX');
  });

  it('shows who to bonk and who to leave alone', () => {
    render(<Game />);

    expect(screen.getByText(/as fast as you can/i)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '🔨 Bonk these!' })).toHaveTextContent('zombie golden');
    expect(screen.getByRole('region', { name: /don't bonk/i })).toHaveTextContent('grandma cat kevin');
  });

  it('locks the start button while someone else is playing', () => {
    mocks.state = { ...ready, lock: { initials: 'AB', endsAt: 12_000 } };
    mocks.now = 400;
    localStorage.setItem('graveyardBonkInitials', 'JB');

    render(<Game />);

    expect(screen.getByRole('status')).toHaveTextContent('AB is playing, 12s left');
    expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled();
  });

  it('hands the screen to the 3D game while playing', () => {
    mocks.state = {
      ...ready,
      phase: 'playing',
      game: { initials: 'JB', pops: [], countdownMs: 3000, durationMs: 30000, upMs: 1500, startedAt: 0 },
    };

    render(<Game />);

    expect(screen.getByTestId('phone-game')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('shows the score, rank, title and a Hall of Fame link at the end', () => {
    mocks.state = {
      ...ready,
      phase: 'results',
      final: { initials: 'JB', score: 3140, avgMs: 287, rank: 4, scoreId: 42 },
    };

    render(<Game />);

    expect(screen.getByText('Literally The Flash')).toBeInTheDocument();
    expect(screen.getByText('3140')).toBeInTheDocument();
    expect(screen.getByText(/#4 this year/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /hall of fame/i })).toHaveAttribute('href', '/stats#score-42');
    expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /counter/i })).toHaveAttribute('href', '/');
  });

  it('rains candy confetti at the end, not before', () => {
    // Through the play view, as on a phone: it swaps the page (and the rain) out
    mocks.state = {
      ...ready,
      phase: 'playing',
      game: { initials: 'JB', pops: [], countdownMs: 3000, durationMs: 30000, upMs: 1500, startedAt: 0 },
    };
    const { container, rerender } = render(<Game />);
    expect(container.querySelectorAll('.drooling-emoji')).toHaveLength(0);

    mocks.state = {
      ...ready,
      phase: 'results',
      final: { initials: 'JB', score: 3140, avgMs: 287, rank: 4, scoreId: 42 },
    };
    rerender(<Game />);

    expect(container.querySelectorAll('.drooling-emoji').length).toBeGreaterThan(0);
  });
});
