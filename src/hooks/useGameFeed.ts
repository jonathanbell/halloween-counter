import { useEffect, useReducer, useRef, useState } from 'react';
import { useSSE, type SSEMessage } from './useSSE';
import type { FeedStatus } from '../game/phoneReducer';
import type { GameFeedMessage } from '../game/protocol';
import { feedReducer, initialFeedState, type FeedAction, type FeedState } from '../game/feedReducer';

const CURRENT_YEAR = 2026;
const TICK_MS = 100;

const GAME_MESSAGES = new Set(['game_status', 'game_pop', 'game_bonk', 'game_tap', 'game_result']);

const isGameMessage = (msg: SSEMessage): msg is GameFeedMessage => GAME_MESSAGES.has(msg.type);

export interface GameFeed {
  // Who is playing and for how long: the phones' "12s left" lockout
  status: FeedStatus | null;
  // The whole game as the garage door shows it
  broadcast: FeedState;
  now: number;
  dispatch: (action: FeedAction) => void;
}

// Graveyard Bonk as seen from the outside: /api/state on load, then the
// game_* messages on the shared SSE stream.
export function useGameFeed(): GameFeed {
  const { registerListener } = useSSE('/api/events');
  const [status, setStatus] = useState<FeedStatus | null>(null);
  const [broadcast, dispatch] = useReducer(feedReducer, initialFeedState);
  const [now, setNow] = useState(() => performance.now());

  // A live message beats the snapshot, whichever arrives first
  const heardLive = useRef(false);

  useEffect(() => {
    fetch(`/api/state?year=${CURRENT_YEAR}`)
      .then(r => r.json())
      .then(state => {
        if (heardLive.current) return;
        const snapshot = {
          active: Boolean(state.gameActive),
          initials: state.gameInitials ?? null,
          endsInMs: state.gameEndsInMs ?? 0,
        };
        setStatus(snapshot);
        dispatch({ type: 'snapshot', snapshot, now: performance.now() });
      })
      .catch(err => console.error('[GameFeed] state fetch failed:', err));
  }, []);

  // registerListener, not lastMessage: a pop and a bonk can land in the
  // same render and lastMessage would only show the second
  useEffect(() => registerListener(msg => {
    if (!isGameMessage(msg)) return;
    if (msg.type === 'game_status') {
      heardLive.current = true;
      setStatus({ active: msg.active, initials: msg.initials, endsInMs: msg.endsInMs });
    }
    dispatch({ type: 'message', msg, now: performance.now() });
  }), [registerListener]);

  // Drives escapes, labels and the post-game screens. Idle doors do not tick
  const ticking = broadcast.phase !== 'idle';
  useEffect(() => {
    if (!ticking) return;
    const timer = window.setInterval(() => {
      const t = performance.now();
      setNow(t);
      dispatch({ type: 'tick', now: t });
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [ticking]);

  return { status, broadcast, now, dispatch };
}
