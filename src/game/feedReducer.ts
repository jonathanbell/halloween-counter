import type { ActorState } from './Character';
import { isDecoy, type GameFeedMessage, type GameResult, type PopKind, type Verdict } from './protocol';
import { emptyTally, type DecoyTally } from './titles';

// The garage door's view of a game, rebuilt from SSE messages alone. Pure,
// so the whole broadcast can be tested without a browser.
//
//   idle ─game_status(on)─> countdown ─first pop─> live
//     ^                                             │ game_status(off) or game_result
//     └── top5 <─15s── results <─10s── replay <────┘ (replay skipped if nothing popped)
//
// A new game_status(on) interrupts any phase. SSE messages can arrive out
// of order (the server sends each one on its own thread), so the end of a
// game is whichever of game_status(off) / game_result lands first.

export type DoorPhase = 'idle' | 'countdown' | 'live' | 'replay' | 'results' | 'top5';

export const REPLAY_MS = 6000;
export const REPLAY_TIME_SCALE = 0.25;
export const RESULTS_MS = 10_000;
export const TOP5_MS = 15_000;
export const LABEL_MS = 1100;

// Defaults for a door that joins mid-game from /api/state, which does not
// carry them (game_status does)
const DEFAULT_UP_MS = 1500;
const DEFAULT_ZOMBIE_COUNT = 13;

export interface FeedPop {
  grave: number;
  kind: PopKind;
  shownAt: number;
  state: ActorState;
}

export interface FeedBonk {
  id: number;
  grave: number;
  kind: PopKind;
  verdict: Verdict;
  ms: number;
  points: number;
  at: number;
}

export interface FeedTap {
  key: number;
  x: number;
  z: number;
}

export interface FeedState {
  phase: DoorPhase;
  phaseEndsAt: number;
  initials: string | null;
  score: number;
  bonked: number;
  zombieCount: number;
  upMs: number;
  endsAt: number;
  pops: Record<number, FeedPop>;
  bonks: FeedBonk[];
  taps: FeedTap[];
  nextTapKey: number;
  result: GameResult | null;
}

export interface Snapshot {
  active: boolean;
  initials: string | null;
  endsInMs: number;
}

export type FeedAction =
  | { type: 'snapshot'; snapshot: Snapshot; now: number }
  | { type: 'message'; msg: GameFeedMessage; now: number }
  | { type: 'tick'; now: number }
  | { type: 'retire_pop'; id: number }
  | { type: 'retire_tap'; key: number };

export const initialFeedState: FeedState = {
  phase: 'idle',
  phaseEndsAt: 0,
  initials: null,
  score: 0,
  bonked: 0,
  zombieCount: DEFAULT_ZOMBIE_COUNT,
  upMs: DEFAULT_UP_MS,
  endsAt: 0,
  pops: {},
  bonks: [],
  taps: [],
  nextTapKey: 0,
  result: null,
};

const PLAYING: DoorPhase[] = ['countdown', 'live'];

export function feedReducer(state: FeedState, action: FeedAction): FeedState {
  switch (action.type) {
    case 'snapshot':
      // Only a door that loads mid-game cares; live messages win otherwise
      if (!action.snapshot.active || state.phase !== 'idle') return state;
      return {
        ...initialFeedState,
        phase: 'live',
        initials: action.snapshot.initials,
        endsAt: action.now + action.snapshot.endsInMs,
      };

    case 'message':
      return onMessage(state, action.msg, action.now);

    case 'tick':
      return onTick(state, action.now);

    case 'retire_pop': {
      const pops = { ...state.pops };
      delete pops[action.id];
      return { ...state, pops };
    }

    case 'retire_tap':
      return { ...state, taps: state.taps.filter(t => t.key !== action.key) };
  }
}

function onMessage(state: FeedState, msg: GameFeedMessage, now: number): FeedState {
  switch (msg.type) {
    case 'game_status':
      if (msg.active) {
        return {
          ...initialFeedState,
          phase: 'countdown',
          initials: msg.initials,
          endsAt: now + msg.endsInMs,
          upMs: msg.upMs,
          zombieCount: msg.zombieCount,
        };
      }
      return endGame(state, now);

    case 'game_pop':
      if (!PLAYING.includes(state.phase)) return state;
      return {
        ...state,
        phase: 'live',
        pops: { ...state.pops, [msg.id]: { grave: msg.grave, kind: msg.kind, shownAt: now, state: 'up' } },
      };

    case 'game_bonk': {
      if (!PLAYING.includes(state.phase)) return state;
      const pop = state.pops[msg.id];
      const counts = msg.verdict === 'bonk' && !isDecoy(msg.kind);
      const bonk: FeedBonk = {
        id: msg.id, grave: msg.grave, kind: msg.kind, verdict: msg.verdict, ms: msg.ms, points: msg.points, at: now,
      };
      return {
        ...state,
        score: msg.score,
        bonked: state.bonked + (counts ? 1 : 0),
        bonks: [...state.bonks, bonk],
        pops: pop ? { ...state.pops, [msg.id]: { ...pop, state: 'bonked' } } : state.pops,
      };
    }

    case 'game_tap':
      if (!PLAYING.includes(state.phase)) return state;
      return {
        ...state,
        taps: [...state.taps, { key: state.nextTapKey, x: msg.x, z: msg.z }],
        nextTapKey: state.nextTapKey + 1,
      };

    case 'game_result': {
      const result: GameResult = {
        initials: msg.initials, score: msg.score, avgMs: msg.avgMs, rank: msg.rank, scoreId: msg.scoreId,
      };
      const withResult = { ...state, result, score: msg.score, initials: msg.initials };
      return PLAYING.includes(state.phase) ? endGame(withResult, now) : withResult;
    }
  }
}

function endGame(state: FeedState, now: number): FeedState {
  if (!PLAYING.includes(state.phase)) return state;

  // Closed during the countdown: nothing to show, straight back to candy
  if (Object.keys(state.pops).length === 0 && state.bonks.length === 0) {
    return { ...initialFeedState };
  }
  return { ...state, phase: 'replay', phaseEndsAt: now + REPLAY_MS, pops: {}, taps: [] };
}

function onTick(state: FeedState, now: number): FeedState {
  if (state.phase === 'live') return escapePops(state, now);
  if (state.phaseEndsAt === 0 || now < state.phaseEndsAt) return state;

  if (state.phase === 'replay') return { ...state, phase: 'results', phaseEndsAt: now + RESULTS_MS };
  if (state.phase === 'results') return { ...state, phase: 'top5', phaseEndsAt: now + TOP5_MS };
  if (state.phase === 'top5') return { ...initialFeedState };
  return state;
}

// Nobody bonked it in time: it taunts and sinks, same as on the phone
function escapePops(state: FeedState, now: number): FeedState {
  let changed = false;
  const pops = { ...state.pops };
  for (const [id, pop] of Object.entries(pops)) {
    if (pop.state !== 'up' || now - pop.shownAt <= state.upMs) continue;
    pops[Number(id)] = { ...pop, state: 'escaped' };
    changed = true;
  }
  return changed ? { ...state, pops } : state;
}

// The bonk the replay shows: the fastest real one, or null for a game with
// no bonks (the replay then just lets a zombie dance)
export function replayTarget(bonks: FeedBonk[]): FeedBonk | null {
  const real = bonks.filter(b => b.verdict === 'bonk' && !isDecoy(b.kind));
  if (real.length === 0) return null;
  return real.reduce((best, b) => (b.ms < best.ms ? b : best));
}

export function feedDecoyTally(bonks: FeedBonk[]): DecoyTally {
  const tally = emptyTally();
  for (const b of bonks) {
    if (b.verdict === 'decoy' && isDecoy(b.kind)) tally[b.kind] += 1;
  }
  return tally;
}

// Real bonks' average, for when game_result never arrives
export function feedAvgMs(bonks: FeedBonk[]): number | null {
  const real = bonks.filter(b => b.verdict === 'bonk' && !isDecoy(b.kind));
  if (real.length === 0) return null;
  return Math.round(real.reduce((sum, b) => sum + b.ms, 0) / real.length);
}
