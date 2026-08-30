import { useEffect, useState } from 'react';
import { Counter } from './components/Counter';
import { CandyProgress } from './components/CandyProgress';
import { StatsDisplay } from './components/StatsDisplay';
import { ZombieHorde } from './components/ZombieHorde';
import { LightningCanvas } from './components/LightningCanvas';
import { DroolingRain } from './components/DroolingRain';
import { Game } from './components/Game';
import { GameOverlay } from './components/GameOverlay';
import { ViewerControls } from './components/ViewerControls';
import { StatsPage } from './components/StatsPage';
import { useCounter } from './hooks/useCounter';
import { useStats } from './hooks/useStats';
import { useSSE } from './hooks/useSSE';
import { useProjectionMode } from './hooks/useProjectionMode';
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

  if (path === '/stats') {
    return <StatsPage />;
  }

  return <CounterPage />;
}

// Projection/viewer page. Own component so its hooks run unconditionally
// (App returns early for /game and /stats)
function CounterPage() {
  const isProjection = useProjectionMode();
  const counter = useCounter();
  const stats = useStats(
    counter.currentCount,
    counter.candyRemaining,
    counter.initialCandyCount
  );

  // Game mode listening — render game overlay when a game session is active
  const { lastMessage } = useSSE('/api/events');

  // Latched from game_status: deriving it from lastMessage directly would
  // flip false as soon as any other SSE message arrives mid-game
  const [isGameActive, setIsGameActive] = useState(false);

  // Effect triggers: bump counters when SSE effect events arrive
  const [lightningTrigger, setLightningTrigger] = useState(0);
  const [rainTrigger, setRainTrigger] = useState(0);

  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type === 'game_status') {
      setIsGameActive(lastMessage.active);
    }
    if (lastMessage.type === 'effect_lightning') {
      setLightningTrigger((t: number) => t + 1);
    }
    if (lastMessage.type === 'effect_candy_rain') {
      setRainTrigger((t: number) => t + 1);
    }
  }, [lastMessage]);

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
      <LightningCanvas triggerOnIncrement={counter.isAnimating} externalTrigger={lightningTrigger} />

      {isGameActive ? (
        <GameOverlay />
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

          <DroolingRain isActive={counter.candyRemaining > 0} externalTrigger={rainTrigger} />

          {!isProjection && <ViewerControls />}
        </div>
      )}

    </div>
  );
}

export default App;
