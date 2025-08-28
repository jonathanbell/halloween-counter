import { useState, useEffect, useMemo } from 'react';

interface HourlyStats {
  hour: number;
  count: number;
}

interface StatsData {
  shouldShowStats: boolean;
  totalCount: number;
  currentHour: number;
  hourlyBreakdown: HourlyStats[];
  hideStats: () => void;
}

export const useStats = (
  count: number, 
  lastIncrementTime: number | null, 
  statsInterval: number
): StatsData => {
  const [shouldShowStats, setShouldShowStats] = useState(false);
  const [incrementHistory, setIncrementHistory] = useState<number[]>([]);

  // Track increment times
  useEffect(() => {
    if (lastIncrementTime) {
      setIncrementHistory(prev => [...prev, lastIncrementTime]);
    }
  }, [lastIncrementTime]);

  // Check if we should show stats
  useEffect(() => {
    if (count > 0 && count % statsInterval === 0 && lastIncrementTime) {
      setShouldShowStats(true);
      
      // Auto-hide stats after 5 seconds
      const timer = setTimeout(() => {
        setShouldShowStats(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [count, statsInterval, lastIncrementTime]);

  const hideStats = () => {
    setShouldShowStats(false);
  };

  const hourlyBreakdown = useMemo(() => {
    const hourCounts: { [key: number]: number } = {};
    
    incrementHistory.forEach(timestamp => {
      const hour = new Date(timestamp).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    return Object.entries(hourCounts)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => a.hour - b.hour);
  }, [incrementHistory]);

  const currentHour = new Date().getHours();

  return {
    shouldShowStats,
    totalCount: count,
    currentHour,
    hourlyBreakdown,
    hideStats
  };
};