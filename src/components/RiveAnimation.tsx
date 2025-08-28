import React from 'react';
import { useRive } from '@rive-app/react-canvas';

interface RiveAnimationProps {
  src: string;
  stateMachine?: string;
  autoplay?: boolean;
  className?: string;
  onLoad?: () => void;
}

const RiveAnimation: React.FC<RiveAnimationProps> = ({
  src,
  stateMachine,
  autoplay = true,
  className = '',
  onLoad
}) => {
  const { RiveComponent } = useRive({
    src,
    stateMachines: stateMachine ? [stateMachine] : undefined,
    autoplay,
    onLoad: () => {
      console.log(`Rive animation loaded: ${src}`);
      onLoad?.();
    },
    onLoadError: (error) => {
      console.error(`Error loading Rive animation ${src}:`, error);
    }
  });

  return (
    <div className={className}>
      <RiveComponent />
    </div>
  );
};

export default RiveAnimation;