import { useState, useEffect, useMemo, useRef } from 'react';
import type { StatsData } from '../types';

export const useStats = (currentCount: number, candyRemaining: number, initialCandyCount: number) => {
  const startTimeRef = useRef(Date.now());
  
  // Initialize timestamps based on initial count (simulating even distribution)
  const [timestamps, setTimestamps] = useState<number[]>(() => {
    if (currentCount === 0) return [];
    
    // Create simulated timestamps for existing count
    const now = Date.now();
    const timePerVisitor = 5 * 60 * 1000; // Assume 5 minutes between visitors
    const simulated: number[] = [];
    
    for (let i = 0; i < currentCount; i++) {
      simulated.push(now - (currentCount - i) * timePerVisitor);
    }
    
    return simulated;
  });

  // Track when a new visitor arrives
  useEffect(() => {
    if (currentCount > timestamps.length) {
      setTimestamps(prev => [...prev, Date.now()]);
    }
  }, [currentCount, timestamps.length]);

  // Calculate all stats in a memoized way
  const stats = useMemo<StatsData>(() => {
    const now = Date.now();
    const elapsedHours = (now - startTimeRef.current) / (1000 * 60 * 60);
    const fiveMinutesAgo = now - (5 * 60 * 1000);

    let candiesGivenPastFiveMinutes: number | null = null;
    let averageTimeBetween = 0;
    let candyDepletionRate = 0;

    // Calculate candies given in the past five minutes
    const elapsedMinutes = (now - startTimeRef.current) / (1000 * 60);
    if (elapsedMinutes >= 5) {
      const visitorsInPastFiveMinutes = timestamps.filter(time => time >= fiveMinutesAgo).length;
      // Assuming 1 candy per visitor for simplicity
      // Could be multiplied by candyPerChild if we track that
      candiesGivenPastFiveMinutes = visitorsInPastFiveMinutes;
    }
    
    if (elapsedHours > 0) {
      if (timestamps.length > 1) {
        const totalTime = timestamps.reduce((acc, time, i) => {
          if (i === 0) return acc;
          return acc + (time - timestamps[i - 1]);
        }, 0);
        // Calculate average time in seconds
        averageTimeBetween = Math.round(totalTime / (timestamps.length - 1) / 1000);
      }

      const candyUsed = initialCandyCount - candyRemaining;
      candyDepletionRate = Math.floor(candyUsed / elapsedHours);
    }

    return {
      candiesGivenPastFiveMinutes,
      averageTimeBetween,
      candyDepletionRate,
      startTime: startTimeRef.current,
      timestamps,
    };
  }, [candyRemaining, initialCandyCount, timestamps]);

  // Update stats periodically without causing re-renders
  const [, forceUpdate] = useState({});
  useEffect(() => {
    const interval = setInterval(() => {
      forceUpdate({});
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return stats;
};