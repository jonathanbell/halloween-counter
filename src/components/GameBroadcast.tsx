import { useCallback, useEffect, useRef, useState } from 'react';
import { Counter } from './Counter';
import type { GameFeed } from '../hooks/useGameFeed';
import { GraveyardScene, type Actor, type GraveProjector, type SceneLabel } from '../game/GraveyardScene';
import {
  LABEL_MS, REPLAY_MS, REPLAY_TIME_SCALE, feedAvgMs, feedDecoyTally, replayTarget, type FeedState,
} from '../game/feedReducer';
import { bonkLabel } from '../game/labels';
import { isDecoy } from '../game/protocol';
import { DECOY_BANNERS, gameTitle } from '../game/titles';
import './GameBroadcast.css';

// The garage door during a game: the same graveyard from a wide, low
// camera, driven only by SSE, with a TV-style HUD on top.
//
//   countdown  GET READY, JB!
//   live       pops, bonks, splats, lightning per bonk, candy rain on Grandma
//   replay     the fastest bonk again at quarter speed, camera pushed in
//   results    score, title, rank (10s)
//   top5       the year's Hall of Fame + a QR to play (15s), then back to the counter

const CURRENT_YEAR = 2026;
const TOP_COUNT = 5;
const BANNER_MS = 1600;

// Where nobody-bonked-anything replays a dancing zombie: the middle grave
const DANCE_GRAVE = 4;
const REPLAY_ACTOR_ID = -1;

interface LeaderRow {
  id: number;
  initials: string;
  score: number;
}

interface GameBroadcastProps {
  feed: GameFeed;
  count: number;
  isAnimating: boolean;
  isOutOfCandy: boolean;
  onStrike: (x: number) => void;
  onCandyBurst: () => void;
}

export function GameBroadcast({ feed, count, isAnimating, isOutOfCandy, onStrike, onCandyBurst }: GameBroadcastProps) {
  const { broadcast: game, now, dispatch } = feed;
  const project = useRef<GraveProjector | null>(null);
  const seenBonks = useRef(0);
  const [banner, setBanner] = useState<string | null>(null);

  const setProjector = useCallback((p: GraveProjector) => { project.current = p; }, []);

  const strikeAt = useCallback((grave: number) => {
    onStrike(project.current?.(grave).x ?? 0.5);
  }, [onStrike]);

  // React to each new bonk once: lightning for a real one, banner (and
  // Grandma's candy rain) for a decoy
  useEffect(() => {
    if (game.bonks.length < seenBonks.current) seenBonks.current = 0;
    const fresh = game.bonks.slice(seenBonks.current);
    seenBonks.current = game.bonks.length;

    for (const b of fresh) {
      if (b.verdict === 'bonk' && !isDecoy(b.kind)) strikeAt(b.grave);
      if (!isDecoy(b.kind) || b.verdict !== 'decoy') continue;

      if (b.kind === 'grandma') onCandyBurst();
      setBanner(DECOY_BANNERS[b.kind]);
      window.setTimeout(() => setBanner(null), BANNER_MS);
    }
  }, [game.bonks, strikeAt, onCandyBurst]);

  const replay = replayState(game, now);

  // The replayed bonk gets its lightning too
  useEffect(() => {
    if (replay?.state === 'bonked' && replay.target) strikeAt(replay.target.grave);
  }, [replay?.state, replay?.target, strikeAt]);

  const actors: Actor[] = replay
    ? [{ id: REPLAY_ACTOR_ID, grave: replay.grave, kind: replay.target?.kind ?? 'zombie', state: replay.state }]
    : Object.entries(game.pops).map(([id, p]) => ({ id: Number(id), grave: p.grave, kind: p.kind, state: p.state }));

  const labels: SceneLabel[] = game.phase !== 'live' ? [] : game.bonks
    .filter(b => now - b.at < LABEL_MS)
    .map(b => ({ key: String(b.id), grave: b.grave, ...bonkLabel(b.kind, b.ms, b.verdict, b.points) }));

  return (
    <div className="game-broadcast">
      <GraveyardScene
        view="door"
        actors={actors}
        splats={game.taps}
        labels={labels}
        timeScale={replay ? REPLAY_TIME_SCALE : 1}
        focusGrave={replay ? replay.grave : null}
        onActorDone={id => { if (id !== REPLAY_ACTOR_ID) dispatch({ type: 'retire_pop', id }); }}
        onSplatDone={key => dispatch({ type: 'retire_tap', key })}
        onProjector={setProjector}
      />

      {(game.phase === 'countdown' || game.phase === 'live') && <LiveHud game={game} now={now} />}
      {game.phase === 'countdown' && <div className="broadcast-shout">GET READY, {game.initials ?? 'PLAYER'}!</div>}
      {banner && <div className="broadcast-banner" key={banner}>{banner}</div>}

      {replay && (
        <div className="broadcast-caption">
          {replay.target ? `🎬 FASTEST BONK · ${replay.target.ms}ms` : '🕺 NOBODY GOT BONKED'}
        </div>
      )}
      {game.phase === 'results' && <ResultsCard game={game} />}
      {game.phase === 'top5' && <TopFive scoreId={game.result?.scoreId ?? null} rank={game.result?.rank ?? null} game={game} />}

      {/* The centred cards reach the corner the counter sits in */}
      {game.phase !== 'results' && game.phase !== 'top5' && (
        <div className="broadcast-counter">
          <span className="broadcast-counter-caption">Now serving customer number:</span>
          <Counter count={count} isAnimating={isAnimating} isOutOfCandy={isOutOfCandy} />
        </div>
      )}
    </div>
  );
}

// During the replay phase: which grave, and whether the replayed character
// is still up or already bonked, on the slowed-down scene clock
function replayState(game: FeedState, now: number) {
  if (game.phase !== 'replay') return null;

  const target = replayTarget(game.bonks);
  const sceneMs = (now - (game.phaseEndsAt - REPLAY_MS)) * REPLAY_TIME_SCALE;
  const state: Actor['state'] = target && sceneMs >= target.ms ? 'bonked' : 'up';
  return { target, grave: target?.grave ?? DANCE_GRAVE, state };
}

function LiveHud({ game, now }: { game: FeedState; now: number }) {
  const secondsLeft = Math.max(0, Math.ceil((game.endsAt - now) / 1000));

  return (
    <div className="broadcast-hud">
      <div className="hud-player">
        <span className="hud-label">Now playing</span>
        <span className="hud-name">{game.initials ?? '???'}</span>
      </div>
      <div className="hud-score readout">{game.score}</div>
      <div className="hud-time">
        <span className="hud-clock">{game.phase === 'live' ? `${secondsLeft}s` : ''}</span>
        <span className="hud-label">Bonked {game.bonked}/{game.zombieCount}</span>
      </div>
    </div>
  );
}

function ResultsCard({ game }: { game: FeedState }) {
  const avgMs = game.result?.avgMs ?? feedAvgMs(game.bonks);
  const rank = game.result?.rank ?? null;

  return (
    <div className="broadcast-card">
      <div className="card-name">{game.result?.initials ?? game.initials ?? '???'}</div>
      <div className="card-title">{gameTitle(avgMs, feedDecoyTally(game.bonks))}</div>
      <div className="card-score readout">{game.result?.score ?? game.score}</div>
      <div className="card-facts">
        {avgMs !== null && <span>⚡ avg {avgMs}ms</span>}
        {rank !== null && <span>🏆 #{rank} this year</span>}
      </div>
    </div>
  );
}

function TopFive({ scoreId, rank, game }: { scoreId: number | null; rank: number | null; game: FeedState }) {
  const [rows, setRows] = useState<LeaderRow[] | null>(null);

  useEffect(() => {
    fetch(`/api/leaderboard?year=${CURRENT_YEAR}&limit=${TOP_COUNT}`)
      .then(r => r.json())
      .then(setRows)
      .catch(err => console.error('[Broadcast] leaderboard fetch failed:', err));
  }, []);

  const playerOffBoard = rank !== null && rank > TOP_COUNT;

  return (
    <div className="broadcast-card">
      <div className="top-board">
        <div className="card-title">🏆 Hall of Fame {CURRENT_YEAR}</div>
        <ol className="top-list">
          {(rows ?? []).map((row, i) => (
            <li key={row.id} className={row.id === scoreId ? 'you' : ''}>
              <span className="top-rank">#{i + 1}</span>
              <span className="top-name">{row.initials}</span>
              <span className="top-score readout">{row.score}</span>
            </li>
          ))}
          {playerOffBoard && (
            <li className="you">
              <span className="top-rank">#{rank}</span>
              <span className="top-name">{game.result?.initials ?? game.initials}</span>
              <span className="top-score readout">{game.result?.score ?? game.score}</span>
            </li>
          )}
        </ol>
      </div>
    </div>
  );
}
