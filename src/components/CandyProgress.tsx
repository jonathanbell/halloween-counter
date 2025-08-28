import React, { useMemo } from 'react';
import './CandyProgress.css';

interface CandyProgressProps {
  candyRemaining: number;
  initialCandyCount: number;
}

const candyIcons = ['🍬', '🍭', '🍫'];

export const CandyProgress: React.FC<CandyProgressProps> = React.memo(({ candyRemaining, initialCandyCount }) => {
  const percentage = (candyRemaining / initialCandyCount) * 100;
  const isCritical = percentage < 10;
  const isEmpty = candyRemaining === 0;

  let colorClass = 'green';
  if (percentage <= 20) colorClass = 'red';
  else if (percentage <= 50) colorClass = 'yellow';

  const candyIconElements = useMemo(() =>
    Array.from({ length: 10 }).map((_, i) => ({
      key: i,
      icon: candyIcons[i % 3],
      isDepleted: i * 10 >= percentage
    })),
    [percentage]
  );

  return (
    <div className="candy-progress-container">
      <div className="candy-header">
        <span className="candy-title">🍬 Candy Supply 🍬</span>
        <span className="candy-count">{candyRemaining} / {initialCandyCount}</span>
      </div>

      <div className="progress-bar-outer">
        <div
          className={`progress-bar-inner ${colorClass} ${isCritical ? 'critical' : ''} ${isEmpty ? 'empty' : ''}`}
          style={{ width: `${Math.max(0, percentage)}%` }}
        >
          <div className="progress-glow"></div>
        </div>

        {isEmpty && (
          <div className="empty-message">
            ⚠️ OUT OF CANDY! ⚠️
          </div>
        )}
      </div>

      <div className="candy-icons">
        {candyIconElements.map(({ key, icon, isDepleted }) => (
          <span
            key={key}
            className={`candy-icon ${isDepleted ? 'depleted' : ''}`}
          >
            {icon}
          </span>
        ))}
      </div>
    </div>
  );
});
