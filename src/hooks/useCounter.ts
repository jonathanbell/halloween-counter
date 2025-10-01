import { useState, useCallback, useEffect, useRef } from 'react';
import type { CounterState } from '../types';
import { useSSE } from './useSSE';

export const useCounter = () => {
  // Get server state via SSE
  const { state: sseState, isConnected, error } = useSSE('/events');
  
  // Local state for optimistic updates and animation
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
    }, 600);
  }, []);
  
  // Sync local state with SSE state
  useEffect(() => {
    if (sseState) {
      setLocalState(prev => ({
        ...prev,
        currentCount: sseState.currentCount,
        candyRemaining: sseState.candyRemaining,
        initialCandyCount: sseState.initialCandyCount,
      }));

      if (prevCountRef.current !== null && sseState.currentCount > prevCountRef.current) {
        const delta = sseState.currentCount - prevCountRef.current;
        const pendingLocal = pendingLocalUpdatesRef.current;

        if (pendingLocal > 0) {
          if (delta >= pendingLocal) {
            pendingLocalUpdatesRef.current = 0;
            if (delta > pendingLocal) {
              triggerAnimation();
            }
          } else {
            pendingLocalUpdatesRef.current = pendingLocal - delta;
          }
        } else {
          triggerAnimation();
        }
      }

      prevCountRef.current = sseState.currentCount;
    }
  }, [sseState, triggerAnimation]);
  
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
      candyRemaining: Math.max(0, prev.candyRemaining - prev.candyPerChild),
    }));
    pendingLocalUpdatesRef.current += 1;
    triggerAnimation();

    try {
      // Send increment request to server
      const response = await fetch('/increment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to increment counter');
      }
      
      const data = await response.json();
      console.log('[Counter] Increment successful:', data);
    } catch (err) {
      console.error('[Counter] Failed to increment:', err);
      // Revert optimistic update on failure
      if (sseState) {
        setLocalState(prev => ({
          ...prev,
          currentCount: sseState.currentCount,
          candyRemaining: sseState.candyRemaining,
        }));
      }
      if (pendingLocalUpdatesRef.current > 0) {
        pendingLocalUpdatesRef.current = Math.max(0, pendingLocalUpdatesRef.current - 1);
      }
    }
  }, [sseState, triggerAnimation]);

  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        window.clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  const reset = useCallback(() => {
    if (window.confirm('Are you sure you want to reset the counter?')) {
      // Navigate to settings page for reset
      window.location.href = '/settings';
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
