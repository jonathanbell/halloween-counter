import { describe, expect, it } from 'vitest';
import { initialPhoneState, phoneReducer, type PhoneAction, type PhoneState } from '../game/phoneReducer';
import type { ServerMessage } from '../game/protocol';

const started: ServerMessage = {
  type: 'game_started',
  sessionId: 's1',
  initials: 'JB',
  countdownMs: 3000,
  durationMs: 30000,
  upMs: 1500,
  pops: [{ id: 0, atMs: 500, grave: 4, kind: 'zombie' }],
};

const run = (actions: PhoneAction[], from: PhoneState = initialPhoneState) => actions.reduce(phoneReducer, from);

const server = (msg: ServerMessage, now = 0): PhoneAction => ({ type: 'server', msg, now });

describe('phoneReducer', () => {
  it('is ready once the socket opens', () => {
    expect(run([{ type: 'connected' }]).phase).toBe('ready');
  });

  it('counts down, plays, then finishes on its own clock', () => {
    const begun = run([{ type: 'connected' }, { type: 'start_requested' }, server(started, 1000)]);
    expect(begun.phase).toBe('countdown');
    expect(begun.game?.startedAt).toBe(1000);

    expect(phoneReducer(begun, { type: 'tick', now: 3999 }).phase).toBe('countdown');
    const playing = phoneReducer(begun, { type: 'tick', now: 4000 });
    expect(playing.phase).toBe('playing');
    expect(phoneReducer(playing, { type: 'tick', now: 34000 }).phase).toBe('finishing');
  });

  it('takes the server score and remembers each verdict', () => {
    const state = run([
      { type: 'connected' },
      server(started),
      server({ type: 'score_update', id: 0, verdict: 'bonk', points: 820, score: 820 }),
    ]);

    expect(state.score).toBe(820);
    expect(state.verdicts[0]).toEqual({ verdict: 'bonk', points: 820 });
  });

  it('shows results when the game ends', () => {
    const state = run([
      { type: 'connected' },
      server(started),
      server({ type: 'game_ended', initials: 'JB', score: 820, avgMs: 300, rank: 2, scoreId: 9 }),
    ]);

    expect(state.phase).toBe('results');
    expect(state.final).toEqual({ initials: 'JB', score: 820, avgMs: 300, rank: 2, scoreId: 9 });
  });

  it('locks the start button while someone else plays', () => {
    const locked = run([
      { type: 'connected' },
      { type: 'feed', status: { active: true, initials: 'AB', endsInMs: 12000 }, now: 500 },
    ]);
    expect(locked.lock).toEqual({ initials: 'AB', endsAt: 12500 });

    const free = phoneReducer(locked, { type: 'feed', status: { active: false, initials: 'AB', endsInMs: 0 }, now: 900 });
    expect(free.lock).toBeNull();
  });

  it('is not locked out of its own game by the SSE echo', () => {
    const state = run([
      { type: 'connected' },
      { type: 'start_requested' },
      { type: 'feed', status: { active: true, initials: 'JB', endsInMs: 33000 }, now: 10 },
    ]);

    expect(state.lock).toBeNull();
    expect(state.phase).toBe('starting');
  });

  it('goes back to ready with a lock when the start is denied', () => {
    const state = run([
      { type: 'connected' },
      { type: 'start_requested' },
      server({ type: 'game_start_denied', reason: 'already_active', initials: 'AB', endsInMs: 5000 }, 100),
    ]);

    expect(state.phase).toBe('ready');
    expect(state.lock).toEqual({ initials: 'AB', endsAt: 5100 });
  });

  it('waits for the final score when quitting mid-play', () => {
    const playing = run([{ type: 'connected' }, server(started, 0), { type: 'tick', now: 4000 }]);
    const quitting = phoneReducer(playing, { type: 'quit' });
    expect(quitting.phase).toBe('playing');

    const ended = phoneReducer(quitting, server({ type: 'game_ended', initials: 'JB', score: 820, avgMs: 300, rank: 2, scoreId: 9 }));
    expect(ended.phase).toBe('results');
    expect(ended.final?.score).toBe(820);
  });

  it('goes straight back to ready when quitting in the countdown', () => {
    const quit = run([{ type: 'connected' }, server(started), { type: 'quit' }]);
    expect(quit.phase).toBe('ready');
    expect(quit.game).toBeNull();

    // Nothing was saved; the server's game_ended must not show results
    const ended = phoneReducer(quit, server({ type: 'game_ended', initials: 'JB', score: 0, avgMs: null, rank: null, scoreId: null }));
    expect(ended.phase).toBe('ready');
  });

  it('drops a live game when the socket closes', () => {
    const state = run([{ type: 'connected' }, server(started), { type: 'disconnected' }]);

    expect(state.connected).toBe(false);
    expect(state.phase).toBe('ready');
    expect(state.game).toBeNull();
  });
});
