import { useEffect, useState, useRef, memo } from 'react';
import './DroolingRain.css';

interface Emoji {
  id: number;
  x: number;
  delay: number;
  duration: number;
  size: number;
  swayAmount: number;
}

interface DroolingRainProps {
  isActive?: boolean;
}

export const DroolingRain = memo(({ isActive = true }: DroolingRainProps) => {
  const [emojis, setEmojis] = useState<Emoji[]>([]);
  const nextIdRef = useRef(0);
  const lastRainRef = useRef(0);

  const createEmojiWave = () => {
    const now = Date.now();
    const count = 15 + Math.floor(Math.random() * 20); // 15-35 emojis per wave
    const newEmojis: Emoji[] = [];

    for (let i = 0; i < count; i++) {
      newEmojis.push({
        id: nextIdRef.current++,
        x: Math.random() * 100, // Percentage across screen
        delay: Math.random() * 2000, // Stagger start times up to 2s
        duration: 3000 + Math.random() * 2000, // 3-5s fall time
        size: 40 + Math.random() * 40, // 40-80px size
        swayAmount: 30 + Math.random() * 50, // How much it sways side to side
      });
    }

    lastRainRef.current = now;
    setEmojis(prev => [...prev, ...newEmojis]);

    // Clean up old emojis after animation completes
    setTimeout(() => {
      setEmojis(prev => prev.filter(e => !newEmojis.some(ne => ne.id === e.id)));
    }, 7000); // Max duration + delay
  };

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
          🤤
        </div>
      ))}
    </div>
  );
});

DroolingRain.displayName = 'DroolingRain';
