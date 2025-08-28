import React from 'react';
import RiveAnimation from './RiveAnimation';
import styles from './Background.module.css';

interface BackgroundProps {
  triggerAnimation: boolean;
}

const Background: React.FC<BackgroundProps> = ({ triggerAnimation }) => {
  return (
    <div className={styles.background}>
      {/* Hanging Pumpkin - Top center */}
      <div className={styles.hangingPumpkinContainer}>
        <RiveAnimation
          src="/assets/rive/halloween-pumpkin.riv"
          className={styles.hangingPumpkinAnimation}
          autoplay={true}
        />
      </div>

      {/* Floating Ghost - Right side */}
      <div className={styles.floatingGhostContainer}>
        <RiveAnimation
          src="/assets/rive/ghost-animate.riv"
          className={styles.floatingGhostAnimation}
          autoplay={true}
        />
      </div>

      {/* Zombie Character - Walking across the screen */}
      <div className={styles.zombieContainer}>
        <RiveAnimation
          src="/assets/rive/zombie-character.riv"
          stateMachine="State Machine 1"
          className={styles.zombieAnimation}
          autoplay={true}
        />
      </div>
      
      {/* Floating ghosts */}
      <div className={`${styles.ghost} ${styles.ghost1}`}>👻</div>
      <div className={`${styles.ghost} ${styles.ghost2}`}>👻</div>
      <div className={`${styles.ghost} ${styles.ghost3}`}>👻</div>
      
      {/* Flying bats */}
      <div className={`${styles.bat} ${styles.bat1}`}>🦇</div>
      <div className={`${styles.bat} ${styles.bat2}`}>🦇</div>
      <div className={`${styles.bat} ${styles.bat3}`}>🦇</div>
      
      {/* Trigger animations */}
      {triggerAnimation && (
        <>
          <div className={`${styles.pumpkin} ${styles.triggerAnimation}`}>🎃</div>
          <div className={`${styles.monster} ${styles.triggerAnimation}`}>👹</div>
          <div className={`${styles.candy} ${styles.triggerAnimation}`}>🍭</div>
        </>
      )}
      
      {/* Corner decorations */}
      <div className={styles.webTopLeft}>🕸️</div>
      <div className={styles.webTopRight}>🕸️</div>
    </div>
  );
};

export default Background;