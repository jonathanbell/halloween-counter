import { describe, expect, it } from 'vitest';
import {
  REPLAY_MS, RESULTS_MS, TOP5_MS, feedReducer, initialFeedState, replayTarget, type FeedAction, type FeedBonk, type FeedState,
} from '../game/feedReducer';
import type { GameFeedMessage } from '../game/protocol';

const T = '2026-10-31T19:00:00Z';

const msg = (m: GameFeedMessage, now = 0): FeedAction => ({ type: 'message', msg: m, now });
const run = (actions: FeedAction[], from: FeedState = initialFeedState) => actions.reduce(feedReducer, from);

const started = msg({
  type: 'game_status', active: true, sessionId: 's', initials: 'JB', endsInMs: 33000, upMs: 1500, zombieCount: 13, timestamp: T,
});
const ended = (now: number) => msg({
  type: 'game_status', active: false, sessionId: 's', initials: 'JB', endsInMs: 0, upMs: 1500, zombieCount: 13, timestamp: T,
}, now);
const pop = (id: number, grave: number, now: number) => msg({ type: 'game_pop', id, grave, kind: 'zombie', timestamp: T }, now);
const bonk = (id: number, ms: number, score: number, now: number, kind: 'zombie' | 'grandma' = 'zombie') => msg({
  type: 'game_bonk', id, grave: 4, kind, verdict: kind === 'zombie' ? 'bonk' : 'decoy', ms, points: 500, score, timestamp: T,
}, now);
const result = (now: number) => msg({
  type: 'game_result', initials: 'JB', score: 1640, avgMs: 290, rank: 3, scoreId: 7, timestamp: T,
}, now);

describe('feedReducer', () => {
  it('counts down until the first pop, then goes live', () => {
    const counting = run([started]);
    expect(counting.phase).toBe('countdown');
    expect(counting.initials).toBe('JB');

    const live = feedReducer(counting, pop(0, 4, 3500));
    expect(live.phase).toBe('live');
    expect(live.pops[0]).toMatchObject({ grave: 4, state: 'up' });
  });

  it('tracks bonks, score and the zombie tally', () => {
    const state = run([started, pop(0, 4, 100), bonk(0, 320, 790, 400), pop(1, 2, 2000), bonk(1, 400, 290, 2300, 'grandma')]);

    expect(state.score).toBe(290);
    expect(state.bonked).toBe(1); // Grandma does not count
    expect(state.pops[0].state).toBe('bonked');
    expect(state.bonks).toHaveLength(2);
  });

  it('sends unbonked characters back down after their up time', () => {
    const live = run([started, pop(0, 4, 100)]);

    expect(feedReducer(live, { type: 'tick', now: 1500 }).pops[0].state).toBe('up');
    expect(feedReducer(live, { type: 'tick', now: 1700 }).pops[0].state).toBe('escaped');
  });

  it('replays, shows results, then the top five, then goes idle', () => {
    let state = run([started, pop(0, 4, 100), bonk(0, 320, 790, 400), ended(31000), result(31010)]);
    expect(state.phase).toBe('replay');
    expect(state.result?.rank).toBe(3);

    state = feedReducer(state, { type: 'tick', now: 31000 + REPLAY_MS });
    expect(state.phase).toBe('results');

    state = feedReducer(state, { type: 'tick', now: 31000 + REPLAY_MS + RESULTS_MS });
    expect(state.phase).toBe('top5');

    state = feedReducer(state, { type: 'tick', now: 31000 + REPLAY_MS + RESULTS_MS + TOP5_MS });
    expect(state).toEqual(initialFeedState);
  });

  it('ends on game_result even when it beats game_status there', () => {
    const state = run([started, pop(0, 4, 100), result(31000), ended(31010)]);

    expect(state.phase).toBe('replay');
    expect(state.phaseEndsAt).toBe(31000 + REPLAY_MS);
    expect(state.result?.scoreId).toBe(7);
  });

  it('goes straight back to idle when the game ends before anything popped', () => {
    expect(run([started, ended(2000)])).toEqual(initialFeedState);
  });

  it('lets a new game interrupt the results', () => {
    const results = run([started, pop(0, 4, 100), ended(31000), { type: 'tick', now: 31000 + REPLAY_MS }]);
    expect(results.phase).toBe('results');

    const next = feedReducer(results, started);
    expect(next.phase).toBe('countdown');
    expect(next.bonks).toEqual([]);
  });

  it('joins a game already in progress from the snapshot', () => {
    const state = feedReducer(initialFeedState, {
      type: 'snapshot', snapshot: { active: true, initials: 'AB', endsInMs: 12000 }, now: 1000,
    });

    expect(state.phase).toBe('live');
    expect(state.endsAt).toBe(13000);
  });

  it('ignores stray game messages while idle', () => {
    expect(run([pop(0, 4, 100), bonk(0, 300, 800, 200)])).toEqual(initialFeedState);
  });
});

describe('replayTarget', () => {
  const b = (id: number, ms: number, kind: FeedBonk['kind'] = 'zombie', verdict: FeedBonk['verdict'] = 'bonk'): FeedBonk => ({
    id, grave: id, kind, verdict, ms, points: 0, at: 0,
  });

  it('picks the fastest real bonk', () => {
    expect(replayTarget([b(0, 400), b(1, 250, 'golden'), b(2, 120, 'grandma', 'decoy'), b(3, 90, 'zombie', 'too_fast')])?.id).toBe(1);
  });

  it('has nothing to replay without a real bonk', () => {
    expect(replayTarget([b(0, 300, 'cat', 'decoy')])).toBeNull();
  });
});
