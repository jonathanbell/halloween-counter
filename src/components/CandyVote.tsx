import type { CandyOption } from '../hooks/useVote';

interface CandyVoteProps {
  options: CandyOption[];
  voted: string | null;
  onVote: (id: string) => void;
}

// The favorite-candy buttons, shared by the counter page and /stats.
// Images are decorative: the label is the button's text
export const CandyVote = ({ options, voted, onVote }: CandyVoteProps) => (
  <div className="vote-grid">
    {options.map(option => (
      <button
        key={option.id}
        className={`vote-btn ${voted === option.id ? 'voted' : ''}`}
        onClick={() => onVote(option.id)}
        aria-pressed={voted === option.id}
      >
        {option.imageUrl && <img src={option.imageUrl} alt="" loading="lazy" />}
        {option.label}
      </button>
    ))}
  </div>
);
