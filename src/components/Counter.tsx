import React, { useMemo } from 'react';
import './Counter.css';

interface CounterProps {
  count: number;
  isAnimating: boolean;
  isOutOfCandy?: boolean;
}

export const Counter: React.FC<CounterProps> = React.memo(({ count, isAnimating, isOutOfCandy = false }) => {
  const digits = useMemo(() => 
    count.toString().padStart(3, '0').split(''),
    [count]
  );

  return (
    <div className="counter-container">
      <div className={`counter-label ${isOutOfCandy ? 'out-of-candy' : ''}`}>Now serving trick-or-treater number:</div>
      <div className={`counter-display ${isAnimating ? 'animating' : ''}`}>
        {digits.map((digit, index) => (
          <div key={index} className="digit-container">
            <div className={`digit ${isAnimating ? 'flip' : ''}`}>
              {digit}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});