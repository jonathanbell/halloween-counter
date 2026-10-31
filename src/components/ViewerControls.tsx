import { useVote } from '../hooks/useVote';
import { CandyVote } from './CandyVote';

// Paused while Graveyard Bonk is live: lightning on the door means a bonk
export type EffectsMode = 'on' | 'paused';

export const ViewerControls = ({ effects = 'on' }: { effects?: EffectsMode }) => {
  const paused = effects === 'paused';

  const { options, voted, vote } = useVote();

  const fireEffect = async (effect: 'lightning' | 'candy-rain') => {
    try {
      await fetch(`/api/effects/${effect}?year=2026`, { method: 'POST' });
    } catch (err) {
      console.error('Effect failed:', err);
    }
  };

  return (
    <div className="viewer-controls">
      {/* The counter page's only way to the game and stats, so they shout */}
      <a className="card hero-link hero-play" href="/game">
        <span className="hero-icon" aria-hidden="true">🪦</span>
        <span className="hero-text">
          <strong>Play Graveyard Bonk</strong>
          <span>Bonk zombies as fast as you can but don't hurt Grandma!</span>
        </span>
        <span aria-hidden="true">▶</span>
      </a>
      <a className="card hero-link" href="/stats">
        <span className="hero-icon" aria-hidden="true">📊</span>
        <span className="hero-text">
          <strong>View historical halloween data</strong>
          <span>Previous years and Graveyard Bonk Hall of Fame</span>
        </span>
        <span aria-hidden="true">›</span>
      </a>

      <div className="control-row">
        <span className="control-title">Control the display on the garage door</span>
        <button className="btn btn-ghost control-btn" onClick={() => fireEffect('lightning')} disabled={paused}>
          ⚡ Fire lightning
        </button>
        <button className="btn btn-ghost control-btn" onClick={() => fireEffect('candy-rain')} disabled={paused}>
          🍬 Make it rain
        </button>
      </div>

      {options.length > 0 && (
        <div className="vote-row">
          <span className="vote-title">Vote for tonight's best candy</span>
          <CandyVote options={options} voted={voted} onVote={vote} />
        </div>
      )}
    </div>
  );
};
