import { useEffect, useState } from 'react';
import { useSSE, SSEMessage } from '../hooks/useSSE';

interface Sprite {
  id: string;
  direction: 0 | 1;
  expiresAt: number;
}

const SPRITE_LIFETIME_MS = 3000;

export const GameOverlay = () => {
  const [sprites, setSprites] = useState<Sprite[]>([]);
  const { registerListener } = useSSE('/api/events');

  useEffect(() => {
    const unregister = registerListener((msg: SSEMessage) => {
      if (msg.type === 'zombie_spawned') {
        setSprites(prev => [...prev, {
          id: msg.zombieId,
          direction: msg.direction as 0 | 1,
          expiresAt: Date.now() + SPRITE_LIFETIME_MS,
        }]);
      }
      if (msg.type === 'zombie_missed') {
        setSprites(prev => prev.filter(s => s.id !== msg.zombieId));
      }
    });
    return unregister;
  }, [registerListener]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();
      setSprites(prev => prev.filter(s => s.expiresAt > now));
    }, 500);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="game-overlay">
      <h2 className="game-title">🧟 Whack-a-Zombie 🎮</h2>
      <div className="game-stage">
        {sprites.map(sprite => (
          <div
            key={sprite.id}
            className={`game-zombie ${sprite.direction === 0 ? 'left' : 'right'}`}
          >
            🧟
          </div>
        ))}
        {sprites.length === 0 && (
          <p className="game-waiting">Waiting for zombies...</p>
        )}
      </div>
    </div>
  );
};
