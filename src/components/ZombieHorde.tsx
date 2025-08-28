import React, { useEffect, useState } from 'react';
import { useRive } from '@rive-app/react-canvas';
import type { ZombieInstance } from '../types';
import './ZombieHorde.css';

interface ZombieHordeProps {
  triggerAnimation: boolean;
  currentCount: number;
  candyRemaining?: number;
}

export const ZombieHorde: React.FC<ZombieHordeProps> = ({ currentCount, candyRemaining = 100 }) => {
  const [zombies, setZombies] = useState<ZombieInstance[]>([]);

  useEffect(() => {
    // Sync zombies with current count + 1
    setZombies(prev => {
      const newZombies: ZombieInstance[] = [];
      const targetCount = currentCount;
      for (let i = 0; i < targetCount; i++) {
        const existingZombie = prev.find(z => z.id === `zombie-${i}`);

        if (existingZombie) {
          // Keep existing zombie with its current position and ensure it has a number
          newZombies.push({
            ...existingZombie,
            number: existingZombie.number || i + 1, // Ensure number is set
          });
        } else {
          // Only create new zombie if there's candy remaining
          if (candyRemaining > 0) {
            // Create new zombie appearing from the left side with more variation
            newZombies.push({
              id: `zombie-${i}`,
              number: i + 1, // Add the zombie's number (1-indexed for display)
              position: -5 + Math.random() * 25, // Start from left side with wider spawn area (-5 to 20)
              speed: 0.06 + Math.random() * 0.03, // Good shambling pace
              scale: 0.8 + Math.random() * 0.4, // Varied sizes
              yOffset: Math.random() * 10 - 5, // Slight vertical variation
              spawnTime: Date.now(), // Track when zombie was created
            });
          }
        }
      }

      return newZombies;
    });
  }, [currentCount, candyRemaining]);

  useEffect(() => {
    let animationFrameId: number;
    let lastTimestamp: number | null = null;

    const animate = (timestamp: number) => {
      // Stop animating if out of candy
      if (candyRemaining === 0) {
        cancelAnimationFrame(animationFrameId);
        return;
      }

      if (!lastTimestamp) lastTimestamp = timestamp;
      const deltaTime = (timestamp - lastTimestamp) / 16.67; // Normalize to 60fps
      lastTimestamp = timestamp;

      setZombies(prev => prev.map(zombie => {
        let newPosition = zombie.position + (zombie.speed * deltaTime);

        // Reset zombie when it reaches the right side
        // Using 105 to reset before going fully off-screen
        if (newPosition > 105) {
          // Reset far enough off-screen to avoid flashing
          newPosition = -35 - Math.random() * 40;
        }

        return { ...zombie, position: newPosition };
      }));

      animationFrameId = requestAnimationFrame(animate);
    };

    // Only start animation if there's candy remaining
    if (candyRemaining > 0) {
      animationFrameId = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [candyRemaining]);

  return (
    <div className="zombie-horde-container">
      {zombies.map(zombie => (
        <ZombieWalker
          key={zombie.id}
          zombie={zombie}
          isOutOfCandy={candyRemaining === 0}
        />
      ))}

    </div>
  );
};

interface ZombieWalkerProps {
  zombie: ZombieInstance;
  isOutOfCandy: boolean;
}

const ZombieWalker: React.FC<ZombieWalkerProps> = React.memo(({ zombie, isOutOfCandy }) => {
  const [showNumber, setShowNumber] = useState(false);
  const { RiveComponent, rive } = useRive({
    src: '/rive/zombie.riv',
    stateMachines: 'State Machine 1',
    autoplay: true,
  });

  // Trigger "In" animation when zombie first appears and show number after spawn animation
  useEffect(() => {
    if (rive) {
      // Small delay to ensure zombie is rendered and visible first
      const timeoutId = setTimeout(() => {
        const inputs = rive.stateMachineInputs('State Machine 1');
        const inInput = inputs?.find(input => input.name === 'In');

        if (inInput && 'fire' in inInput) {
          // Fire the "In" trigger after zombie is positioned
          inInput.fire();
        }
      }, 100);

      // Show number after spawn animation completes (approximately 1 second)
      const numberTimeoutId = setTimeout(() => {
        setShowNumber(true);
      }, 1000);

      return () => {
        clearTimeout(timeoutId);
        clearTimeout(numberTimeoutId);
      };
    }
  }, [rive]);

  // Trigger "Hit" animation when out of candy
  useEffect(() => {
    if (rive && isOutOfCandy) {
      // Small delay to ensure Rive is fully loaded
      const timeoutId = setTimeout(() => {
        const inputs = rive.stateMachineInputs('State Machine 1');
        const hitInput = inputs?.find(input => input.name === 'Hit');

        if (hitInput && 'fire' in hitInput) {
          // Fire the "Hit" trigger when candy runs out
          hitInput.fire();
        }
      }, 200);
      
      return () => clearTimeout(timeoutId);
    }
  }, [rive, isOutOfCandy]);

  // Only render zombies that are visible on screen
  const isVisible = zombie.position > -10 && zombie.position < 110;

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="zombie-instance"
      style={{
        transform: `translateX(${zombie.position}vw) translateY(${zombie.yOffset}vh) scale(${zombie.scale})`,
        zIndex: Math.floor(zombie.scale * 10),
      }}
    >
      <RiveComponent />
      {showNumber && !isOutOfCandy && (
        <div className="zombie-number">{zombie.number}</div>
      )}
    </div>
  );
}, (prevProps, nextProps) => 
  prevProps.zombie.id === nextProps.zombie.id &&
  prevProps.zombie.position === nextProps.zombie.position &&
  prevProps.isOutOfCandy === nextProps.isOutOfCandy
);
