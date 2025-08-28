import React from 'react';
import type { StatsData } from '../types';
import './StatsDisplay.css';

interface StatsDisplayProps {
  stats: StatsData;
}

export const StatsDisplay: React.FC<StatsDisplayProps> = React.memo(({ stats }) => {
  // Format time in fuzzy increments
  const formatFuzzyTime = (seconds: number): string => {
    if (seconds <= 0) return 'N/A';
    
    if (seconds < 60) {
      // Round to nearest 5 seconds
      const rounded = Math.round(seconds / 5) * 5;
      return `~${rounded || 5} seconds`;
    } else {
      // Convert to minutes
      const minutes = Math.round(seconds / 60);
      return minutes === 1 ? '~1 min' : `~${minutes} mins`;
    }
  };
  
  return (
    <div className="stats-container">
      <div className="stat-item">
        <span className="stat-icon">👻</span>
        {/* <span className="stat-icon">🧟‍♂️</span> */}
        <span className="stat-label">Candy Output (past 5 mins):</span>
        <span className="stat-value">{stats.candiesGivenPastFiveMinutes !== null ? stats.candiesGivenPastFiveMinutes : 'N/A'}</span>
      </div>

      <div className="stat-item">
        <span className="stat-icon">⏱️</span>
        <span className="stat-label">Average Wait:</span>
        <span className="stat-value">
          {formatFuzzyTime(stats.averageTimeBetween)}
        </span>
      </div>

      <div className="stat-item">
        <span className="stat-icon">🍬</span>
        <span className="stat-label">Depletion Rate:</span>
        <span className="stat-value">{stats.candyDepletionRate}/hr</span>
      </div>
    </div>
  );
});
