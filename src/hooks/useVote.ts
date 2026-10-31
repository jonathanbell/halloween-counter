import { useEffect, useState } from 'react';

// The admin's list for the year, edited on /settings.html
export interface CandyOption {
  id: string;
  label: string;
  imageUrl: string | null;
}

const YEAR = 2026;
const VOTE_KEY = `halloweenVote${YEAR}`;
const VOTER_KEY = 'halloweenVoterId';

// One id per phone: the server counts only its latest vote, so tapping
// another candy changes the vote instead of adding one
const voterId = () => {
  let id = localStorage.getItem(VOTER_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VOTER_KEY, id);
  }
  return id;
};

export const useVote = () => {
  const [options, setOptions] = useState<CandyOption[]>([]);
  const [voted, setVoted] = useState<string | null>(
    () => localStorage.getItem(VOTE_KEY) || null
  );
  // True only once the server accepts a vote on this visit; `voted` alone
  // is restored from storage and may be stale
  const [recorded, setRecorded] = useState(false);

  useEffect(() => {
    fetch(`/api/vote/options?year=${YEAR}`)
      .then(r => r.json())
      .then(setOptions)
      .catch(err => console.error('candy options fetch failed:', err));
  }, []);

  const vote = async (candyType: string) => {
    if (candyType === voted) return;

    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: YEAR, candyType, voterId: voterId() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setVoted(candyType);
      setRecorded(true);
      localStorage.setItem(VOTE_KEY, candyType);
    } catch (err) {
      console.error('Vote failed:', err);
    }
  };

  return { options, voted, recorded, vote };
};
