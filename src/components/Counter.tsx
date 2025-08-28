import React from 'react';
import styles from './Counter.module.css';

interface CounterProps {
  count: number;
  isAnimating: boolean;
}

const Counter: React.FC<CounterProps> = ({ count, isAnimating }) => {
  return (
    <div className={styles.container}>
      <div className={styles.label}>Trick-or-Treaters:</div>
      <div className={`${styles.count} ${isAnimating ? styles.animate : ''}`}>
        {count}
      </div>
    </div>
  );
};

export default Counter;