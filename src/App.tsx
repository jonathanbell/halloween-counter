import { useState, useEffect } from 'react';
import Counter from './components/Counter';
import StatsDisplay from './components/StatsDisplay';
import Background from './components/Background';
import { useQueryParams } from './hooks/useQueryParams';
import { useCounter } from './hooks/useCounter';
import { useStats } from './hooks/useStats';
import './App.css';

function App() {
  const { currentCount, statsInterval } = useQueryParams();
  const { count, lastIncrementTime } = useCounter(currentCount);
  const { shouldShowStats, totalCount, currentHour, hourlyBreakdown, hideStats } = useStats(
    count, 
    lastIncrementTime, 
    statsInterval
  );
  
  const [isAnimating, setIsAnimating] = useState(false);
  const [triggerBackgroundAnimation, setTriggerBackgroundAnimation] = useState(false);

  // Handle counter animation
  useEffect(() => {
    if (lastIncrementTime) {
      setIsAnimating(true);
      setTriggerBackgroundAnimation(true);
      
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 600);
      
      const backgroundTimer = setTimeout(() => {
        setTriggerBackgroundAnimation(false);
      }, 2000);
      
      return () => {
        clearTimeout(timer);
        clearTimeout(backgroundTimer);
      };
    }
  }, [lastIncrementTime]);

  // Enable fullscreen mode with F11 or double-click
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleDoubleClick = () => {
      toggleFullscreen();
    };

    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'F11') {
        event.preventDefault();
        toggleFullscreen();
      }
      if (event.key === 'Escape' && shouldShowStats) {
        hideStats();
      }
    };

    window.addEventListener('dblclick', handleDoubleClick);
    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('dblclick', handleDoubleClick);
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [shouldShowStats, hideStats]);

  return (
    <div className="app">
      <Background triggerAnimation={triggerBackgroundAnimation} />
      
      <main className="main-content">
        <Counter count={count} isAnimating={isAnimating} />
        
        {shouldShowStats && (
          <StatsDisplay
            totalCount={totalCount}
            currentHour={currentHour}
            hourlyBreakdown={hourlyBreakdown}
            onClose={hideStats}
          />
        )}
      </main>
      
      <div className="instructions">
        <p>Press SPACEBAR to count trick-or-treaters | Double-click for fullscreen</p>
        <p>Stats appear every {statsInterval} counts | Current count: {count}</p>
      </div>
    </div>
  );
}

export default App;
