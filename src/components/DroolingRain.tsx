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
  burstTrigger?: number; // increment for a short candy-only burst (Grandma got bonked)
  count?: number; // trick-or-treaters so far: one emoji each per wave
}

// Mix of drooling faces and candy emojis (drooling face weighted more heavily)
const EMOJI_POOL = ['🤤', '🤤', '🤤', '🤤', '🍬', '🍭', '🍫'];

// Grandma's bowl: candy only, no drool, over in about two seconds
const BURST_POOL = ['🍬', '🍭', '🍫'];

interface WaveShape {
  count?: [number, number]; // omitted: one emoji per trick-or-treater
  delayMs: number;
  durationMs: [number, number];
  pool: string[];
}

const WAVE: WaveShape = { delayMs: 2000, durationMs: [3000, 5000], pool: EMOJI_POOL };
const BURST: WaveShape = { count: [14, 20], delayMs: 300, durationMs: [1400, 1900], pool: BURST_POOL };

const between = ([min, max]: [number, number]) => min + Math.random() * (max - min);

// A late-night wave or a mashed rain button stops here, so phones stay
// smooth. Past it the emoji no longer match the count
const MAX_LIVE_EMOJI = 200;

export const DroolingRain = memo(({ isActive = true, externalTrigger, burstTrigger, count: visitors = 0 }: DroolingRainProps) => {
  const [emojis, setEmojis] = useState<FallingEmoji[]>([]);
  const nextIdRef = useRef(0);
  const lastRainRef = useRef(0);

  // The random-rain interval holds the first render's createEmojiWave, so
  // it reads the count through a ref
  const visitorsRef = useRef(visitors);
  visitorsRef.current = visitors;

  const createEmojiWave = (shape: WaveShape = WAVE) => {
    const now = Date.now();
    const count = shape.count ? Math.floor(between(shape.count)) : visitorsRef.current;
    const newEmojis: FallingEmoji[] = [];

    for (let i = 0; i < count; i++) {
      newEmojis.push({
        id: nextIdRef.current++,
        x: Math.random() * 100, // Percentage across screen
        delay: Math.random() * shape.delayMs, // Staggered start
        duration: between(shape.durationMs), // Fall time
        size: 40 + Math.random() * 40, // 40-80px size
        swayAmount: 30 + Math.random() * 50, // How much it sways side to side
        emoji: shape.pool[Math.floor(Math.random() * shape.pool.length)],
      });
    }

    lastRainRef.current = now;
    setEmojis(prev => [...prev, ...newEmojis.slice(0, Math.max(0, MAX_LIVE_EMOJI - prev.length))]);

    // Clean up old emojis after animation completes
    setTimeout(() => {
      setEmojis(prev => prev.filter(e => !newEmojis.some(ne => ne.id === e.id)));
    }, 7000); // Max duration + delay
  };

  // External trigger (SSE effect_candy_rain event from server)
  useEffect(() => {
    if (!externalTrigger) return;
    createEmojiWave();
  }, [externalTrigger]);

  useEffect(() => {
    if (!burstTrigger) return;
    createEmojiWave(BURST);
  }, [burstTrigger]);

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
