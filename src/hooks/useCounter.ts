import { useState, useCallback, useEffect, useRef } from 'react';
import type { CounterState } from '../types';
import { useSSE } from './useSSE';

const CURRENT_YEAR = 2026;
const API_BASE = '/api';

// How long .animating / .glitching stay on the counter. Must outlast the
// unluckiest well in Counter.css: --glitch-surge (420ms) at its top
// --surge-scale (1.3) after the largest --glitch-jitter (55ms), or removing
// the class cuts that well's glitch short.
const ANIMATION_MS = 620;

interface UseCounterReturn {
  currentCount: number;
  candyRemaining: number;
  initialCandyCount: number;
  isAnimating: boolean;
  isConnected: boolean;
  connectionError: string | null;
  increment: () => Promise<void>;
  reset: () => void;
}

export const useCounter = (): UseCounterReturn => {
  const { lastMessage, isConnected, error } = useSSE(`${API_BASE}/events`);

  const [localState, setLocalState] = useState<CounterState>({
    currentCount: 0,
    candyRemaining: 300,
    initialCandyCount: 300,
    candyPerChild: 1,
  });

  const [isAnimating, setIsAnimating] = useState(false);
  const prevCountRef = useRef<number | null>(null);
  const animationTimeoutRef = useRef<number | null>(null);
  const pendingLocalUpdatesRef = useRef(0);

  const triggerAnimation = useCallback(() => {
    setIsAnimating(true);
    if (animationTimeoutRef.current) {
      window.clearTimeout(animationTimeoutRef.current);
    }
    animationTimeoutRef.current = window.setTimeout(() => {
      setIsAnimating(false);
      animationTimeoutRef.current = null;
    }, ANIMATION_MS);
  }, []);

  // Seed from the server on mount; without this the page shows 0 and the
  // default candy supply until the first SSE increment arrives
  useEffect(() => {
    fetch(`${API_BASE}/state?year=${CURRENT_YEAR}`)
      .then(r => r.json())
      .then(state => {
        setLocalState(prev => ({
          ...prev,
          currentCount: state.currentCount,
          candyRemaining: state.candyRemaining,
          initialCandyCount: state.initialCandyCount,
        }));
        prevCountRef.current = state.currentCount;
      })
      .catch(err => console.error('[Counter] state fetch failed:', err));
  }, []);

  // Sync local state with SSE messages
  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === 'increment') {
      const newCount = lastMessage.total;
      setLocalState(prev => {
        // The server includes the current supply so settings changes
        // propagate without a refresh
        const initial = lastMessage.initialCandyCount ?? prev.initialCandyCount;
        return {
          ...prev,
          currentCount: newCount,
          initialCandyCount: initial,
          candyRemaining: Math.max(0, initial - newCount),
        };
      });

      if (prevCountRef.current !== null && newCount > prevCountRef.current) {
        const delta = newCount - prevCountRef.current;
        const pendingLocal = pendingLocalUpdatesRef.current;

        if (pendingLocal > 0) {
          if (delta >= pendingLocal) {
            pendingLocalUpdatesRef.current = 0;
            if (delta > pendingLocal) triggerAnimation();
          } else {
            pendingLocalUpdatesRef.current = pendingLocal - delta;
          }
        } else {
          triggerAnimation();
        }
      }

      prevCountRef.current = newCount;
    }
  }, [lastMessage, triggerAnimation]);

  // Log connection status
  useEffect(() => {
    if (isConnected) {
      console.log('[Counter] Connected to server');
    } else if (error) {
      console.error('[Counter] Connection error:', error);
    }
  }, [isConnected, error]);

  const increment = useCallback(async () => {
    // The projector URL carries the admin token (/?projection&token=...).
    // Checked before the optimistic update so a missing token cannot leave
    // the local count ahead of the server.
    const token = new URLSearchParams(window.location.search).get('token');

    if (!token) {
      console.error('[Counter] No ?token= in the URL - cannot increment.');
      return;
    }

    // Optimistic update
    setLocalState(prev => ({
      ...prev,
      currentCount: prev.currentCount + 1,
      candyRemaining: Math.max(0, prev.initialCandyCount - (prev.currentCount + 1)),
    }));
    pendingLocalUpdatesRef.current += 1;
    triggerAnimation();

    try {
      const response = await fetch(`${API_BASE}/counter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ year: CURRENT_YEAR }),
      });

      if (!response.ok) {
        throw new Error('Failed to increment counter');
      }
    } catch (err) {
      console.error('[Counter] Failed to increment:', err);
      // Undo the optimistic +1 symmetrically - works even when no SSE
      // message has arrived yet
      setLocalState(prev => {
        const revertedCount = Math.max(0, prev.currentCount - 1);
        return {
          ...prev,
          currentCount: revertedCount,
          candyRemaining: Math.max(0, prev.initialCandyCount - revertedCount),
        };
      });
      if (pendingLocalUpdatesRef.current > 0) {
        pendingLocalUpdatesRef.current -= 1;
      }
    }
  }, [triggerAnimation]);

  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        window.clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  const reset = useCallback(() => {
    if (window.confirm('Are you sure you want to reset the counter?')) {
      window.location.href = '/settings.html';
    }
  }, []);

  return {
    ...localState,
    increment,
    reset,
    isAnimating,
    isConnected,
    connectionError: error,
  };
};
