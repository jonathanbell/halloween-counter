import { useState, useEffect, useMemo, useRef } from 'react';
import type { StatsData } from '../types';

const YEAR = 2026;

// Any count jump larger than this is a resync (initial state fetch, admin
// adjustment), not real visitors walking up - don't fabricate timestamps
const MAX_LIVE_DELTA = 5;

interface HistogramPoint {
  minute: string;
  count: number;
}

// Real handout timestamps: seeded from the server's /api/stats histogram
// (minute resolution), then appended live as increments arrive. Survives
// page refreshes instead of simulating a fake even distribution.
export const useStats = (currentCount: number, candyRemaining: number, initialCandyCount: number) => {
  const [timestamps, setTimestamps] = useState<number[]>([]);
  const [seeded, setSeeded] = useState(false);
  const prevCountRef = useRef<number | null>(null);

  useEffect(() => {
    fetch(`/api/stats?year=${YEAR}`)
      .then(r => r.json())
      .then(stats => {
        const seededTimestamps: number[] = [];
        for (const bucket of (stats.histogram ?? []) as HistogramPoint[]) {
          const time = new Date(bucket.minute).getTime();
          if (Number.isNaN(time)) continue;
          for (let i = 0; i < bucket.count; i++) {
            seededTimestamps.push(time);
          }
        }
        seededTimestamps.sort((a, b) => a - b);
        setTimestamps(prev => [...seededTimestamps, ...prev]);
        setSeeded(true);
      })
      .catch(err => {
        console.error('[Stats] histogram fetch failed:', err);
        setSeeded(true);
      });
  }, []);

  // Append a timestamp per live increment
  useEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = currentCount;
    if (prev === null || currentCount <= prev) return;

    const delta = currentCount - prev;
    if (delta > MAX_LIVE_DELTA) return;

    const now = Date.now();
    setTimestamps(ts => [...ts, ...Array.from({ length: delta }, () => now)]);
  }, [currentCount]);

  // Tick so the time-window stats (past-5-min, depletion rate) decay even
  // when no new increments arrive
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  const stats = useMemo<StatsData>(() => {
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;

    const candiesGivenPastFiveMinutes = seeded
      ? timestamps.filter(time => time >= fiveMinutesAgo).length
      : null;

    let averageTimeBetween = 0;
    if (timestamps.length > 1) {
      const totalTime = timestamps[timestamps.length - 1] - timestamps[0];
      averageTimeBetween = Math.round(totalTime / (timestamps.length - 1) / 1000);
    }

    let candyDepletionRate = 0;
    const startTime = timestamps.length > 0 ? timestamps[0] : now;
    const elapsedHours = (now - startTime) / (1000 * 60 * 60);
    if (elapsedHours > 0) {
      const candyUsed = initialCandyCount - candyRemaining;
      candyDepletionRate = Math.floor(candyUsed / elapsedHours);
    }

    return {
      candiesGivenPastFiveMinutes,
      averageTimeBetween,
      candyDepletionRate,
      startTime,
      timestamps,
    };
    // tick is a deliberate dep: it forces the time-window math to re-run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeded, candyRemaining, initialCandyCount, timestamps, tick]);

  return stats;
};
