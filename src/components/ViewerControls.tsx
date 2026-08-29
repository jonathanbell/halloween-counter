import { useState } from 'react';

const CANDY_OPTIONS = [
  { id: 'snickers', label: 'Snickers', emoji: '🍫' },
  { id: 'm&ms', label: "M&M's", emoji: '🟤' },
  { id: 'twix', label: 'Twix', emoji: '🍪' },
];

export const ViewerControls = () => {
  const [voted, setVoted] = useState<string | null>(null);

  const fireEffect = async (effect: 'lightning' | 'candy-rain') => {
    try {
      await fetch(`/api/effects/${effect}?year=2026`, { method: 'POST' });
    } catch (err) {
      console.error('Effect failed:', err);
    }
  };

  const vote = async (candyType: string) => {
    try {
      await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: 2026, candyType }),
      });
      setVoted(candyType);
    } catch (err) {
      console.error('Vote failed:', err);
    }
  };

  return (
    <div className="viewer-controls">
      <div className="control-row">
        <button className="control-btn" onClick={() => fireEffect('lightning')}>
          ⚡ Fire Lightning
        </button>
        <button className="control-btn" onClick={() => fireEffect('candy-rain')}>
          🍬 Candy Rain
        </button>
        <a className="control-btn game-link" href="/game">🎮 Play Game</a>
      </div>

      <div className="vote-row">
        <span className="vote-title">Vote for favorite candy:</span>
        {CANDY_OPTIONS.map(option => (
          <button
            key={option.id}
            className={`vote-btn ${voted === option.id ? 'voted' : ''}`}
            onClick={() => vote(option.id)}
          >
            {option.emoji} {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};
