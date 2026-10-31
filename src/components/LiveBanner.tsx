// Shown on viewers' phones while someone plays Graveyard Bonk: the game
// itself is on the garage door, this just says who and how it is going.
export const LiveBanner = ({ initials, score }: { initials: string | null; score: number }) => (
  <a className="live-banner" href="/game">
    <span className="live-dot" aria-hidden="true" />
    <span>
      LIVE: <strong>{initials ?? 'Someone'}</strong> is bonking zombies, {score} pts. Watch the garage door!
    </span>
  </a>
);
