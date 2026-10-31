// Graveyard Bonk wire format. docs/api.md is the authority; these types
// mirror it for the phone (WebSocket) and every screen (SSE).

export type PopKind = 'zombie' | 'golden' | 'grandma' | 'cat' | 'kevin';
export type DecoyKind = Extract<PopKind, 'grandma' | 'cat' | 'kevin'>;
export type Verdict = 'bonk' | 'too_fast' | 'escaped' | 'decoy';

export const isDecoy = (kind: PopKind): kind is DecoyKind =>
  kind === 'grandma' || kind === 'cat' || kind === 'kevin';

// One scheduled pop. atMs counts from the end of the countdown
export interface Pop {
  id: number;
  atMs: number;
  grave: number;
  kind: PopKind;
}

export interface GameResult {
  initials: string;
  score: number;
  avgMs: number | null;
  rank: number | null;
  scoreId: number | null;
}

// WebSocket, server -> phone
export type ServerMessage =
  | {
      type: 'game_started';
      sessionId: string;
      initials: string;
      countdownMs: number;
      durationMs: number;
      upMs: number;
      pops: Pop[];
    }
  | { type: 'game_start_denied'; reason: string; initials: string | null; endsInMs: number }
  | { type: 'score_update'; id: number; verdict: Verdict; points: number; score: number }
  | ({ type: 'game_ended' } & GameResult)
  | { type: 'error'; reason: string };

// WebSocket, phone -> server
export type ClientMessage =
  | { type: 'game_start'; initials: string }
  | { type: 'pop_shown'; id: number }
  | { type: 'bonk'; id: number; ms: number }
  | { type: 'tap'; x: number; z: number }
  | { type: 'game_quit' };

// SSE /api/events, server -> every screen
export type GameFeedMessage =
  | {
      type: 'game_status';
      active: boolean;
      sessionId: string;
      initials: string | null;
      endsInMs: number;
      upMs: number;
      zombieCount: number;
      timestamp: string;
    }
  | { type: 'game_pop'; id: number; grave: number; kind: PopKind; timestamp: string }
  | {
      type: 'game_bonk';
      id: number;
      grave: number;
      kind: PopKind;
      verdict: Verdict;
      ms: number;
      points: number;
      score: number;
      timestamp: string;
    }
  | { type: 'game_tap'; x: number; z: number; timestamp: string }
  | ({ type: 'game_result'; timestamp: string } & GameResult);
