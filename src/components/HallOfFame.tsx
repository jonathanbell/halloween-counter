import { useEffect, useRef, useState } from 'react';

interface Entry {
  id: number;
  initials: string;
  score: number;
  avgMs: number | null;
}

// Graveyard Bonk scores for one year, best first. The phone's results screen
// links here as /stats#score-<id>; that row is highlighted and scrolled to
// once the list has loaded (the browser's own anchor jump fires too early).
export const HallOfFame = ({ year }: { year: number }) => {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const highlightRef = useRef<HTMLLIElement>(null);
  const highlightId = window.location.hash.match(/^#score-(\d+)$/)?.[1];

  useEffect(() => {
    setEntries(null);
    fetch(`/api/leaderboard?year=${year}`)
      .then(r => r.json())
      .then(setEntries)
      .catch(err => console.error('leaderboard fetch failed:', err));
  }, [year]);

  useEffect(() => {
    highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [entries]);

  if (!entries) return null;

  return (
    <div className="card hall-of-fame">
      <h3>🏆 {year} Graveyard Bonk Hall of Fame</h3>
      <p className="card-desc">Top scores from the zombie-bonking game: Graveyard Bonk!</p>
      {entries.length === 0 ? (
        <div className="stats-empty">
          No bonks yet. <a href="/game">Be the first!</a>
        </div>
      ) : (
        <ol className="hof-list">
          {entries.map((entry, i) => {
            const mine = String(entry.id) === highlightId;
            return (
              <li
                key={entry.id}
                id={`score-${entry.id}`}
                ref={mine ? highlightRef : undefined}
                className={mine ? 'highlight' : ''}
              >
                <span className="hof-rank">#{rankAt(entries, i)}</span>
                <span className="hof-initials">{entry.initials}</span>
                <span className="hof-avg">{entry.avgMs !== null ? `${entry.avgMs}ms` : ''}</span>
                <span className="hof-score readout">{entry.score}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};

// Ties share the better rank, the same way the server ranks a new score
function rankAt(entries: Entry[], index: number): number {
  const first = entries.findIndex(e => e.score === entries[index].score);
  return first + 1;
}
