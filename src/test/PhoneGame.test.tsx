import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhoneGame } from '../game/PhoneGame';
import type { ActiveGame } from '../game/phoneReducer';

// jsdom has no WebGL: the scene is a stub, the HUD and buttons are real
vi.mock('../game/GraveyardScene', () => ({ GraveyardScene: () => null }));

const game: ActiveGame = { initials: 'JB', pops: [], countdownMs: 3000, durationMs: 30000, upMs: 1500, startedAt: 0 };

function renderGame(onQuit = vi.fn(), phase: 'playing' | 'finishing' = 'playing') {
  render(
    <PhoneGame
      game={game}
      phase={phase}
      score={0}
      verdicts={{}}
      now={5000}
      onShown={vi.fn()}
      onBonk={vi.fn()}
      onTap={vi.fn()}
      onQuit={onQuit}
    />,
  );
  return onQuit;
}

describe('PhoneGame quit button', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('takes two taps to end the game', () => {
    const onQuit = renderGame();

    fireEvent.click(screen.getByRole('button', { name: 'End game' }));
    expect(onQuit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /tap again/i }));
    expect(onQuit).toHaveBeenCalledTimes(1);
  });

  it('disarms itself if the second tap never comes', () => {
    const onQuit = renderGame();

    fireEvent.click(screen.getByRole('button', { name: 'End game' }));
    act(() => { vi.advanceTimersByTime(3000); });

    fireEvent.click(screen.getByRole('button', { name: 'End game' }));
    expect(onQuit).not.toHaveBeenCalled();
  });

  it('hides once time is up', () => {
    renderGame(vi.fn(), 'finishing');

    expect(screen.queryByRole('button', { name: 'End game' })).not.toBeInTheDocument();
  });
});
