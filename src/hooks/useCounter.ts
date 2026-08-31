import { useState, useCallback, useEffect, useRef } from 'react';
import type { CounterState } from '../types';
import { useSSE } from './useSSE';

const CURRENT_YEAR = 2026;
const API_BASE = '/api';

interface UseCounterReturn {
  currentCount: number;
  candyRemaining: number;
  initialCandyCount: number;
  isAnimating: boolean;
  isConnected: boolean;
  isGameActive: boolean;
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

  // Latched from game_status messages; seeded from /api/state so a
  // projection refreshed mid-game restores the overlay
  const [isGameActive, setIsGameActive] = useState(false);

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
    }, 600);
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
        setIsGameActive(Boolean(state.gameActive));
        prevCountRef.current = state.currentCount;
      })
      .catch(err => console.error('[Counter] state fetch failed:', err));
  }, []);

  // Sync local state with SSE messages
  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === 'game_status') {
      setIsGameActive(lastMessage.active);
      return;
    }

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
    // Optimistic update
    setLocalState(prev => ({
      ...prev,
      currentCount: prev.currentCount + 1,
      candyRemaining: Math.max(0, prev.initialCandyCount - (prev.currentCount + 1)),
    }));
    pendingLocalUpdatesRef.current += 1;
    triggerAnimation();

    try {
      const token = new URLSearchParams(window.location.search).get('token') || 'dev-admin-token';
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
      window.location.href = '/settings';
    }
  }, []);

  return {
    ...localState,
    increment,
    reset,
    isAnimating,
    isConnected,
    isGameActive,
    connectionError: error,
  };
};
