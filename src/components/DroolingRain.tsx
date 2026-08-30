import { useEffect, useState, useRef, memo } from 'react';
import './DroolingRain.css';

interface FallingEmoji {
  id: number;
  x: number;
  delay: number;
  duration: number;
  size: number;
  swayAmount: number;
  emoji: string;
}

interface DroolingRainProps {
  isActive?: boolean;
  externalTrigger?: number; // increment to force a rain wave (SSE effect event)
}

// Mix of drooling faces and candy emojis (drooling face weighted more heavily)
const EMOJI_POOL = ['🤤', '🤤', '🤤', '🤤', '🍬', '🍭', '🍫'];

export const DroolingRain = memo(({ isActive = true, externalTrigger }: DroolingRainProps) => {
  const [emojis, setEmojis] = useState<FallingEmoji[]>([]);
  const nextIdRef = useRef(0);
  const lastRainRef = useRef(0);

  const createEmojiWave = () => {
    const now = Date.now();
    const count = 15 + Math.floor(Math.random() * 20); // 15-35 emojis per wave
    const newEmojis: FallingEmoji[] = [];

    for (let i = 0; i < count; i++) {
      newEmojis.push({
        id: nextIdRef.current++,
        x: Math.random() * 100, // Percentage across screen
        delay: Math.random() * 2000, // Stagger start times up to 2s
        duration: 3000 + Math.random() * 2000, // 3-5s fall time
        size: 40 + Math.random() * 40, // 40-80px size
        swayAmount: 30 + Math.random() * 50, // How much it sways side to side
        emoji: EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)], // Random emoji from pool
      });
    }

    lastRainRef.current = now;
    setEmojis(prev => [...prev, ...newEmojis]);

    // Clean up old emojis after animation completes
    setTimeout(() => {
      setEmojis(prev => prev.filter(e => !newEmojis.some(ne => ne.id === e.id)));
    }, 7000); // Max duration + delay
  };

  // External trigger (SSE effect_candy_rain event from server)
  useEffect(() => {
    if (!externalTrigger) return;
    createEmojiWave();
  }, [externalTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isActive) {
      // Clear all emojis when not active
      setEmojis([]);
      return;
    }

    // Initial rain after a longer delay
    const initialTimeout = setTimeout(() => {
      createEmojiWave();
    }, 8000 + Math.random() * 12000);

    // Random rain intervals
    const checkForRain = () => {
      const now = Date.now();
      const timeSinceLastRain = now - lastRainRef.current;
      const minInterval = 40000; // 40 seconds minimum between rains
      const maxInterval = 120000; // 120 seconds maximum

      if (timeSinceLastRain > minInterval) {
        const probability = (timeSinceLastRain - minInterval) / (maxInterval - minInterval);

        if (Math.random() < probability) {
          createEmojiWave();
        }
      }
    };

    const interval = setInterval(checkForRain, 1000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [isActive]);

  return (
    <div className="drooling-rain-container" aria-hidden="true">
      {emojis.map(emoji => (
        <div
          key={emoji.id}
          className="drooling-emoji"
          style={{
            left: `${emoji.x}%`,
            animationDelay: `${emoji.delay}ms`,
            animationDuration: `${emoji.duration}ms`,
            fontSize: `${emoji.size}px`,
            '--sway-amount': `${emoji.swayAmount}px`,
          } as React.CSSProperties}
        >
          {emoji.emoji}
        </div>
      ))}
    </div>
  );
});

DroolingRain.displayName = 'DroolingRain';
