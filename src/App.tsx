import { useEffect } from 'react';
import { Counter } from './components/Counter';
import { CandyProgress } from './components/CandyProgress';
import { StatsDisplay } from './components/StatsDisplay';
import { ZombieHorde } from './components/ZombieHorde';
import { LightningCanvas } from './components/LightningCanvas';
import { DroolingRain } from './components/DroolingRain';
import { Game } from './components/Game';
import { useCounter } from './hooks/useCounter';
import { useStats } from './hooks/useStats';
import { useSSE } from './hooks/useSSE';
import './App.css';

// Cheap router for /game route
function usePath() {
  return window.location.pathname;
}

function App() {
  const path = usePath();

  // Phone controller route
  if (path === '/game') {
    return <Game />;
  }

  const counter = useCounter();
  const stats = useStats(
    counter.currentCount,
    counter.candyRemaining,
    counter.initialCandyCount
  );

  // Game mode listening — render game overlay when a game session is active
  const { lastMessage } = useSSE('/api/events');
  const isGameActive = lastMessage?.type === 'game_status' && lastMessage.active;

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'r' && e.ctrlKey) {
        e.preventDefault();
        counter.reset();
      }
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

      {isGameActive ? (
        <Game />
      ) : (
        <div className="main-content">
          <Counter
            count={counter.currentCount}
            isAnimating={counter.isAnimating}
            isOutOfCandy={counter.candyRemaining === 0}
          />

          <CandyProgress
            candyRemaining={counter.candyRemaining}
            initialCandyCount={counter.initialCandyCount}
          />

          <StatsDisplay stats={stats} />

          <ZombieHorde
            currentCount={counter.currentCount}
            candyRemaining={counter.candyRemaining}
          />

          <DroolingRain isActive={counter.candyRemaining > 0} />
        </div>
      )}

    </div>
  );
}

export default App;
