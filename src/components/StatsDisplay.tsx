import React from 'react';
import styles from './StatsDisplay.module.css';

interface HourlyStats {
  hour: number;
  count: number;
}

interface StatsDisplayProps {
  totalCount: number;
  currentHour: number;
  hourlyBreakdown: HourlyStats[];
  onClose: () => void;
}

const StatsDisplay: React.FC<StatsDisplayProps> = ({ 
  totalCount, 
  currentHour, 
  hourlyBreakdown,
  onClose 
}) => {
  const formatHour = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}${period}`;
  };

  const currentHourCount = hourlyBreakdown.find(h => h.hour === currentHour)?.count || 0;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.container} onClick={e => e.stopPropagation()}>
        <div className={styles.title}>🎃 Halloween Stats 🎃</div>
        
        <div className={styles.mainStats}>
          <div className={styles.statItem}>
            <div className={styles.statValue}>{totalCount}</div>
            <div className={styles.statLabel}>Total Trick-or-Treaters</div>
          </div>
          
          <div className={styles.statItem}>
            <div className={styles.statValue}>{currentHourCount}</div>
            <div className={styles.statLabel}>This Hour ({formatHour(currentHour)})</div>
          </div>
        </div>

        {hourlyBreakdown.length > 1 && (
          <div className={styles.hourlyBreakdown}>
            <div className={styles.breakdownTitle}>Hourly Breakdown:</div>
            <div className={styles.hourlyList}>
              {hourlyBreakdown.map(({ hour, count }) => (
                <div key={hour} className={styles.hourlyItem}>
                  <span className={styles.hourTime}>{formatHour(hour)}:</span>
                  <span className={styles.hourCount}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={styles.closeHint}>Press spacebar to continue counting...</div>
      </div>
    </div>
  );
};

export default StatsDisplay;