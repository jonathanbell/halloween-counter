import type { GameResult, Pop, ServerMessage, Verdict } from './protocol';

// The phone's side of a game, as a pure function so every transition is
// testable without a WebSocket.
//
//  connecting ─open─> ready ─Start─> starting ─game_started─> countdown
//                       ^              │ denied                  │ tick
//                       │              v                         v
//                    results <─game_ended── finishing <─tick── playing
//
// Quitting mid-play waits for game_ended (the score counts); quitting in the
// countdown goes straight back to ready, since nothing will be saved.
//
// Timestamps are performance.now() milliseconds on this phone.

export type PhonePhase =
  | 'connecting'
  | 'ready'
  | 'starting'
  | 'countdown'
  | 'playing'
  | 'finishing'
  | 'results';

export interface ActiveGame {
  initials: string;
  pops: Pop[];
  countdownMs: number;
  durationMs: number;
  upMs: number;
  startedAt: number;
}

// Someone else is playing until roughly this moment
export interface Lock {
  initials: string | null;
  endsAt: number;
}

export interface PhoneState {
  phase: PhonePhase;
  connected: boolean;
  game: ActiveGame | null;
  score: number;
  verdicts: Record<number, { verdict: Verdict; points: number }>;
  final: GameResult | null;
  lock: Lock | null;
}

export interface FeedStatus {
  active: boolean;
  initials: string | null;
  endsInMs: number;
}

export type PhoneAction =
  | { type: 'connected' }
  | { type: 'disconnected' }
  | { type: 'start_requested' }
  | { type: 'quit' }
  | { type: 'server'; msg: ServerMessage; now: number }
  | { type: 'feed'; status: FeedStatus; now: number }
  | { type: 'tick'; now: number };

export const initialPhoneState: PhoneState = {
  phase: 'connecting',
  connected: false,
  game: null,
  score: 0,
  verdicts: {},
  final: null,
  lock: null,
};

// Phases where this phone owns the running game
const PLAYING_PHASES: PhonePhase[] = ['starting', 'countdown', 'playing', 'finishing'];

export const isOwnGame = (phase: PhonePhase) => PLAYING_PHASES.includes(phase);

export function phoneReducer(state: PhoneState, action: PhoneAction): PhoneState {
  switch (action.type) {
    case 'connected':
      return { ...state, connected: true, phase: state.phase === 'connecting' ? 'ready' : state.phase };

    // The server ends a game whose phone drops, so a live game is over
    case 'disconnected':
      return {
        ...state,
        connected: false,
        phase: isOwnGame(state.phase) ? 'ready' : state.phase,
        game: isOwnGame(state.phase) ? null : state.game,
      };

    case 'start_requested':
      return { ...state, phase: 'starting' };

    case 'quit':
      return state.phase === 'countdown' ? { ...state, phase: 'ready', game: null } : state;

    case 'feed':
      return onFeed(state, action.status, action.now);

    case 'tick':
      return onTick(state, action.now);

    case 'server':
      return onServer(state, action.msg, action.now);
  }
}

// Someone's game started or ended. Our own game also echoes back over SSE
// and must not lock us out of it
function onFeed(state: PhoneState, status: FeedStatus, now: number): PhoneState {
  if (!status.active) return { ...state, lock: null };
  if (isOwnGame(state.phase)) return state;
  return { ...state, lock: { initials: status.initials, endsAt: now + status.endsInMs } };
}

function onTick(state: PhoneState, now: number): PhoneState {
  const game = state.game;
  if (!game) return state;

  const playFrom = game.startedAt + game.countdownMs;
  if (state.phase === 'countdown' && now >= playFrom) {
    return { ...state, phase: 'playing' };
  }
  if (state.phase === 'playing' && now >= playFrom + game.durationMs) {
    return { ...state, phase: 'finishing' };
  }
  return state;
}

function onServer(state: PhoneState, msg: ServerMessage, now: number): PhoneState {
  switch (msg.type) {
    case 'game_started':
      return {
        ...state,
        phase: 'countdown',
        lock: null,
        score: 0,
        verdicts: {},
        final: null,
        game: {
          initials: msg.initials,
          pops: msg.pops,
          countdownMs: msg.countdownMs,
          durationMs: msg.durationMs,
          upMs: msg.upMs,
          startedAt: now,
        },
      };

    case 'game_start_denied':
      return {
        ...state,
        phase: state.phase === 'starting' ? 'ready' : state.phase,
        lock: { initials: msg.initials, endsAt: now + msg.endsInMs },
      };

    case 'score_update':
      return {
        ...state,
        score: msg.score,
        verdicts: { ...state.verdicts, [msg.id]: { verdict: msg.verdict, points: msg.points } },
      };

    // Only for a game this phone is still in: a countdown quit already left
    case 'game_ended':
      if (!isOwnGame(state.phase)) return state;
      return {
        ...state,
        phase: 'results',
        score: msg.score,
        final: {
          initials: msg.initials,
          score: msg.score,
          avgMs: msg.avgMs,
          rank: msg.rank,
          scoreId: msg.scoreId,
        },
      };

    case 'error':
      return state;
  }
}
