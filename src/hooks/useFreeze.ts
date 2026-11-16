import { useEffect, useState } from 'react';
import { useSSE } from './useSSE';
import { CURRENT_YEAR } from '../year';

export interface Freeze {
  // Any day but Oct 31 (Pacific), unless unlocked from the settings page
  frozen: boolean;
  // Midnight that starts the next Halloween, epoch ms
  opensAt: number;
}

// When the server cannot be asked: a page left waiting stays blank, and the
// server refuses a frozen write whatever the page shows
const ASSUME_OPEN: Freeze = { frozen: false, opensAt: 0 };

// Whether the year's data is locked. null until the server answers, so a
// page can wait instead of drawing the counter and swapping it for the
// countdown a moment later.
export function useFreeze(): Freeze | null {
  const { registerListener, isConnected } = useSSE('/api/events');
  const [freeze, setFreeze] = useState<Freeze | null>(null);

  // On load and after every reconnect: a phone that slept through midnight
  // never got the flip message
  useEffect(() => {
    fetch(`/api/state?year=${CURRENT_YEAR}`)
      .then(r => r.json())
      .then(state => setFreeze({ frozen: Boolean(state.frozen), opensAt: Date.parse(state.opensAt) }))
      .catch(err => {
        console.error('[Freeze] state fetch failed:', err);
        setFreeze(known => known ?? ASSUME_OPEN);
      });
  }, [isConnected]);

  useEffect(() => registerListener(msg => {
    if (msg.type !== 'freeze') return;
    setFreeze({ frozen: msg.frozen, opensAt: Date.parse(msg.opensAt) });
  }), [registerListener]);

  return freeze;
}
