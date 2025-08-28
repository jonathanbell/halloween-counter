import { useState, useCallback, useEffect } from 'react';
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
  
  // Sync local state with SSE state
  useEffect(() => {
    if (sseState) {
      setLocalState(prev => ({
        ...prev,
        currentCount: sseState.currentCount,
        candyRemaining: sseState.candyRemaining,
        initialCandyCount: sseState.initialCandyCount,
      }));
    }
  }, [sseState]);
  
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
    
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 600);
    
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
    }
  }, [sseState]);

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