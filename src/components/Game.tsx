import { useEffect, useRef, useState } from 'react';
import { useGame } from '../hooks/useGame';
import type { Difficulty } from '../hooks/useGame';

const GAME_DURATION_MS = 30_000;
const TICK_INTERVAL_MS = 500;

const DIFFICULTIES: Array<{ id: Difficulty; label: string }> = [
  { id: 'easy', label: '🙂 Easy' },
  { id: 'hard', label: '😈 Hard' },
  { id: 'lightning', label: '⚡ Lightning' },
];

interface ActiveZombie {
  id: string;
  direction: 0 | 1;
  expiresAt: number;
}

export const Game = () => {
  const {
    isConnected,
    isPlaying,
    currentZombies,
    score,
    finalScore,
    connect,
    startGame,
    hitZombie,
    endGame,
  } = useGame({ url: 'ws://localhost:8080/ws/game' });

  const [timeRemainingMs, setTimeRemainingMs] = useState(GAME_DURATION_MS);
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying) return;
    startTimeRef.current = Date.now();
    setTimeRemainingMs(GAME_DURATION_MS);

    const timer = window.setInterval(() => {
      const elapsed = Date.now() - (startTimeRef.current ?? Date.now());
      setTimeRemainingMs(Math.max(0, GAME_DURATION_MS - elapsed));
    }, TICK_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [isPlaying]);

  const visibleZombies: ActiveZombie[] = currentZombies.map(z => ({
    id: z.id,
    direction: (z.direction === 1 ? 1 : 0) as 0 | 1,
    expiresAt: Date.now() + 3000,
  }));

  const handleZoneTap = (direction: 0 | 1) => {
    // Find most recent zombie with matching direction
    const candidates = visibleZombies.filter(z => z.direction === direction);
    if (candidates.length === 0) return;

    const target = candidates[0];
    hitZombie(target.id);
  };

  return (
    <div className="game-page">
      <h1>🧟 Whack-a-Zombie 🎮</h1>

      {!isConnected && (
        <button className="primary-btn" onClick={connect}>
          Connect to Game
        </button>
      )}

      {isConnected && !isPlaying && finalScore === null && (
        <>
          <div className="difficulty-row">
            {DIFFICULTIES.map(d => (
              <button
                key={d.id}
                className={`difficulty-btn ${difficulty === d.id ? 'selected' : ''}`}
                onClick={() => setDifficulty(d.id)}
              >
                {d.label}
              </button>
            ))}
          </div>
          <button className="primary-btn" onClick={() => startGame(difficulty)}>
            Start Game
          </button>
        </>
      )}

      {isPlaying && (
        <>
          <div className="score-timer">
            <div className="score">Score: {score}</div>
            <div className="timer">{(timeRemainingMs / 1000).toFixed(0)}s</div>
          </div>

          <div className="touch-zones">
            <button
              className="touch-zone left"
              onPointerDown={() => handleZoneTap(0)}
            >
              {visibleZombies.filter(z => z.direction === 0).map(z => (
                <span key={z.id} className="floating-zombie">🧟</span>
              ))}
            </button>
            <button
              className="touch-zone right"
              onPointerDown={() => handleZoneTap(1)}
            >
              {visibleZombies.filter(z => z.direction === 1).map(z => (
                <span key={z.id} className="floating-zombie">🧟</span>
              ))}
            </button>
          </div>

          <button className="end-btn" onClick={endGame}>
            End Game Early
          </button>
        </>
      )}

      {finalScore !== null && (
        <div className="final-score">
          <h2>Game Over!</h2>
          <div className="final-score-value">{finalScore}</div>
          <div className="action-row">
            <button className="primary-btn" onClick={() => startGame(difficulty)}>Play Again</button>
            <button className="primary-btn share" onClick={() => shareScore(finalScore)}>
              📸 Share Score
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

function shareScore(score: number): void {
  const hashtag = '#HalloweenCandyCounter2026';
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 500;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, 800, 500);

  ctx.fillStyle = '#9b59b6';
  ctx.font = 'bold 32px monospace';
  ctx.fillText('🧟 Whack-a-Zombie 🎮', 80, 80);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 120px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(score), 400, 280);

  ctx.fillStyle = '#e67e22';
  ctx.font = 'bold 24px monospace';
  ctx.fillText(hashtag, 400, 360);

  const url = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = url;
  link.download = `whack-a-zombie-score-${score}.png`;
  link.click();
}
