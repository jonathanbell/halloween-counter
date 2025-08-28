import { useState, useEffect, useCallback } from 'react';
import { updateUrlWithCount } from './useQueryParams';

interface CounterData {
  count: number;
  increment: () => void;
  lastIncrementTime: number | null;
}

export const useCounter = (initialCount: number): CounterData => {
  const [count, setCount] = useState(initialCount);
  const [lastIncrementTime, setLastIncrementTime] = useState<number | null>(null);

  // Update count when initialCount changes (from URL params)
  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  const increment = useCallback(() => {
    const newCount = count + 1;
    setCount(newCount);
    setLastIncrementTime(Date.now());
    updateUrlWithCount(newCount);
  }, [count]);

  // Keyboard event listener for spacebar
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        increment();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [increment]);

  return {
    count,
    increment,
    lastIncrementTime
  };
};