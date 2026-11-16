import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FreezeCountdown } from '../components/FreezeCountdown';

const NOW = Date.parse('2026-11-13T20:00:00Z');

// Midnight PDT on Oct 31 2027: 351 days and 11 hours after NOW
const OPENS_AT = Date.parse('2027-10-31T07:00:00Z');

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

describe('FreezeCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts down in days, hours, minutes and seconds', () => {
    render(<FreezeCountdown opensAt={OPENS_AT} />);

    expect(screen.getByRole('timer')).toHaveTextContent('351 days 11 hours 0 minutes 0 seconds');

    act(() => {
      vi.advanceTimersByTime(SECOND_MS);
    });

    expect(screen.getByRole('timer')).toHaveTextContent('351 days 10 hours 59 minutes 59 seconds');
  });

  it('drops the plural for one of anything', () => {
    render(<FreezeCountdown opensAt={NOW + DAY_MS + HOUR_MS + MINUTE_MS + SECOND_MS} />);

    expect(screen.getByRole('timer')).toHaveTextContent('1 day 1 hour 1 minute 1 second');
  });

  it('waits at zero when the phone clock is ahead of the server', () => {
    render(<FreezeCountdown opensAt={NOW - 5 * SECOND_MS} />);

    expect(screen.getByRole('timer')).toHaveTextContent('0 days 0 hours 0 minutes 0 seconds');
  });
});
