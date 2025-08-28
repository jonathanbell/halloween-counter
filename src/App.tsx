import { useEffect } from 'react';
import { Counter } from './components/Counter';
import { CandyProgress } from './components/CandyProgress';
import { StatsDisplay } from './components/StatsDisplay';
import { ZombieHorde } from './components/ZombieHorde';
import { LightningCanvas } from './components/LightningCanvas';
import { DroolingRain } from './components/DroolingRain';
import { useCounter } from './hooks/useCounter';
import { useStats } from './hooks/useStats';
import './App.css';

function App() {
  const counter = useCounter();

  const stats = useStats(
    counter.currentCount,
    counter.candyRemaining,
    counter.initialCandyCount
  );

  // Log connection status to console
  useEffect(() => {
    if (counter.isConnected) {
      console.log('✅ Connected to counter server');
    } else if (counter.connectionError) {
      console.log('❌ Server connection error:', counter.connectionError);
    } else {
      console.log('⏳ Connecting to server...');
    }
  }, [counter.isConnected, counter.connectionError]);

  // Unified keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+R: Reset counter
      if (e.key === 'r' && e.ctrlKey) {
        e.preventDefault();
        counter.reset();
      }
      // Ctrl+F: Toggle fullscreen
      if (e.key === 'f' && e.ctrlKey) {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen();
        } else {
          document.exitFullscreen();
        }
      }
    };

    const handleKeyPress = (e: KeyboardEvent) => {
      // Space: Increment counter
      if (e.code === 'Space') {
        e.preventDefault();
        counter.increment();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keypress', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keypress', handleKeyPress);
    };
  }, [counter]);

  return (
    <div className="app">
      <LightningCanvas triggerOnIncrement={counter.isAnimating} />
      <div className="main-content">
        {/* <img src="/kscb.png" alt="KSCB Logo" style={{ width: 120, marginBottom: 16 }} /> */}
        <Counter
          count={counter.currentCount}
          isAnimating={counter.isAnimating}
        />

        <CandyProgress
          candyRemaining={counter.candyRemaining}
          initialCandyCount={counter.initialCandyCount}
        />

        <StatsDisplay stats={stats} />

        <ZombieHorde
          triggerAnimation={counter.isAnimating}
          currentCount={counter.currentCount}
          candyRemaining={counter.candyRemaining}
        />

        <DroolingRain />
      </div>

    </div>
  );
}

export default App;
