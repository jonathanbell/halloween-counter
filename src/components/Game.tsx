import { useEffect, useState } from 'react';
import { useGame } from '../hooks/useGame';
import { useGameFeed } from '../hooks/useGameFeed';
import { CastLineup, type CastMember } from '../game/CastLineup';
import { preloadScenery } from '../game/models';
import { PhoneGame } from '../game/PhoneGame';
import type { Lock, PhoneState } from '../game/phoneReducer';
import { isDecoy } from '../game/protocol';
import { unlockAudio } from '../game/sfx';
import { emptyTally, gameTitle, type DecoyTally } from '../game/titles';
import { DroolingRain } from './DroolingRain';
import { PageShell } from './PageShell';
import './Game.css';

const WS_URL = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/game`;

const INITIALS_KEY = 'graveyardBonkInitials';
const MAX_INITIALS = 3;

const cleanInitials = (raw: string) => raw.toUpperCase().replace(/[^A-Z]/g, '').slice(0, MAX_INITIALS);

// Per-phone convenience only; private windows and blocked storage just
// start blank
function savedInitials(): string {
  try {
    return cleanInitials(localStorage.getItem(INITIALS_KEY) ?? '');
  } catch {
    return '';
  }
}

function saveInitials(initials: string): void {
  try {
    localStorage.setItem(INITIALS_KEY, initials);
  } catch {
    // Not remembered next time, nothing else lost
  }
}

export const Game = () => {
  const feed = useGameFeed();
  const { state, now, start, shown, bonk, tap, quit, reconnect } = useGame({ url: WS_URL, feed: feed.status });
  const [initials, setInitials] = useState(savedInitials);

  useEffect(() => preloadScenery(), []);

  // Bumped after the results page mounts: an inactive DroolingRain drops a
  // trigger it mounts with, and the play view unmounted it
  const [confetti, setConfetti] = useState(0);
  useEffect(() => {
    if (state.phase === 'results') setConfetti(c => c + 1);
  }, [state.phase]);

  const begin = () => {
    // Inside the tap: iOS only allows audio to start from a user gesture
    unlockAudio();
    saveInitials(initials);
    start(initials);
  };

  const inPlay = state.game && (state.phase === 'countdown' || state.phase === 'playing' || state.phase === 'finishing');
  if (inPlay && state.game) {
    return (
      <PhoneGame
        game={state.game}
        phase={state.phase}
        score={state.score}
        verdicts={state.verdicts}
        now={now}
        onShown={shown}
        onBonk={bonk}
        onTap={tap}
        onQuit={quit}
      />
    );
  }

  return (
    <PageShell active="game" title="🪦 Graveyard Bonk">
      <div className="bonk-page">
        {state.phase === 'connecting' && <p className="bonk-note">Digging up zombies…</p>}

        {!state.connected && state.phase !== 'connecting' && (
          <div className="card bonk-offline">
            <p>Lost the connection to the graveyard.</p>
            <button className="btn btn-primary" onClick={reconnect}>Reconnect</button>
          </div>
        )}

        {state.phase === 'results' && state.final && <Results state={state} />}
        {state.phase === 'ready' && <HowToPlay />}

        <DroolingRain isActive={false} burstTrigger={confetti} />

        {(state.phase === 'ready' || state.phase === 'results' || state.phase === 'starting') && (
          <StartPanel
            initials={initials}
            onInitials={value => setInitials(cleanInitials(value))}
            onStart={begin}
            lock={state.lock}
            now={now}
            starting={state.phase === 'starting'}
            connected={state.connected}
            label={state.phase === 'results' ? 'Play again' : 'Start'}
          />
        )}
      </div>
    </PageShell>
  );
};

// Who to bonk and who to leave alone, drawn with the game's own 3D cast
const ZOMBIES: CastMember[] = [
  { kind: 'zombie', name: 'Zombie' },
  { kind: 'golden', name: 'Golden', note: '2x points' },
];

const DECOYS: CastMember[] = [
  { kind: 'grandma', name: 'Grandma' },
  { kind: 'cat', name: 'The cat' },
  { kind: 'kevin', name: 'Kevin', note: 'just a kid' },
];

function HowToPlay() {
  return (
    <div className="card bonk-how">
      {/* Testers mistook the practice cast for the game itself */}
      <h2>Instructions</h2>
      <p className="bonk-scroll">👇 Scroll down to start the game</p>

      <ol className="bonk-steps">
        <li>Zombies pop out of the graves for 30 seconds.</li>
        <li>Tap them <strong>as fast as you can</strong>. Faster = more points!</li>
        <li>Don't tap anyone else, or you lose points.</li>
      </ol>
      <p className="bonk-note">Tap the characters below to practice.</p>

      <CastLineup tone="bonk" heading="🔨 Bonk these!" cast={ZOMBIES} />
      <CastLineup tone="nope" heading="🚫 Don't bonk these!" cast={DECOYS} />
    </div>
  );
}

interface StartPanelProps {
  initials: string;
  onInitials: (value: string) => void;
  onStart: () => void;
  lock: Lock | null;
  now: number;
  starting: boolean;
  connected: boolean;
  label: string;
}

function StartPanel({ initials, onInitials, onStart, lock, now, starting, connected, label }: StartPanelProps) {
  const secondsLeft = lock ? Math.max(0, Math.ceil((lock.endsAt - now) / 1000)) : 0;
  const disabled = !connected || starting || lock !== null || initials.length === 0;

  return (
    <div className="bonk-start">
      <div className="field">
        <label htmlFor="bonk-initials">Enter your initials</label>
        <input
          id="bonk-initials"
          className="bonk-initials"
          value={initials}
          onChange={e => onInitials(e.target.value)}
          maxLength={MAX_INITIALS}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="AAA"
        />
      </div>

      {lock && (
        <p className="bonk-lock" role="status">
          🎮 {lock.initials ?? 'Someone'} is playing, {secondsLeft}s left
        </p>
      )}

      <button className="btn btn-primary bonk-go" onClick={onStart} disabled={disabled}>
        {starting ? 'Waking the dead…' : label}
      </button>
    </div>
  );
}

function decoyTally(state: PhoneState): DecoyTally {
  const tally = emptyTally();
  for (const pop of state.game?.pops ?? []) {
    if (isDecoy(pop.kind) && state.verdicts[pop.id]?.verdict === 'decoy') tally[pop.kind] += 1;
  }
  return tally;
}

function Results({ state }: { state: PhoneState }) {
  const final = state.final;
  if (!final) return null;

  return (
    <div className="card bonk-results">
      <h2>{gameTitle(final.avgMs, decoyTally(state))}</h2>
      <div className="bonk-score readout">{final.score}</div>
      <div className="bonk-caption">points</div>

      <div className="bonk-facts">
        {final.avgMs !== null && <span>⚡ avg {final.avgMs}ms</span>}
        {final.rank !== null && <span>🏆 #{final.rank} this year</span>}
      </div>

      {final.scoreId !== null && (
        <a className="btn btn-gold" href={`/stats#score-${final.scoreId}`}>
          See yourself in the Hall of Fame
        </a>
      )}
    </div>
  );
}
