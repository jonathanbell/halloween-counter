import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { ClientMessage, ServerMessage } from '../game/protocol';
import { initialPhoneState, isOwnGame, phoneReducer, type FeedStatus } from '../game/phoneReducer';

// The phone's WebSocket to /ws/game. Connects on mount, turns server
// messages into phoneReducer actions, and exposes the things a player can
// do. Game rules live on the server; screen state lives in the reducer.

const TICK_MS = 100;

interface UseGameOptions {
  url: string;
  feed: FeedStatus | null;
}

export function useGame({ url, feed }: UseGameOptions) {
  const [state, dispatch] = useReducer(phoneReducer, initialPhoneState);
  const [now, setNow] = useState(() => performance.now());
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    wsRef.current?.close();
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => dispatch({ type: 'connected' });
    ws.onmessage = event => {
      try {
        dispatch({ type: 'server', msg: JSON.parse(event.data) as ServerMessage, now: performance.now() });
      } catch (err) {
        console.error('[Game] bad message', err);
      }
    };

    // Ignore closes of a socket we already replaced (StrictMode remounts,
    // reconnect)
    ws.onclose = () => {
      if (wsRef.current === ws) dispatch({ type: 'disconnected' });
    };
  }, [url]);

  useEffect(() => {
    connect();
    return () => {
      const ws = wsRef.current;
      wsRef.current = null;
      ws?.close();
    };
  }, [connect]);

  useEffect(() => {
    if (feed) dispatch({ type: 'feed', status: feed, now: performance.now() });
  }, [feed]);

  // A clock for countdowns, phase changes and the lockout timer. Idle on
  // the start screen when nobody is playing
  const ticking = isOwnGame(state.phase) || state.lock !== null;
  useEffect(() => {
    if (!ticking) return;
    const timer = window.setInterval(() => {
      const t = performance.now();
      setNow(t);
      dispatch({ type: 'tick', now: t });
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [ticking]);

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(msg));
  }, []);

  const start = useCallback((initials: string) => {
    dispatch({ type: 'start_requested' });
    send({ type: 'game_start', initials });
  }, [send]);

  const shown = useCallback((id: number) => send({ type: 'pop_shown', id }), [send]);
  const bonk = useCallback((id: number, ms: number) => send({ type: 'bonk', id, ms }), [send]);
  const tap = useCallback((x: number, z: number) => send({ type: 'tap', x, z }), [send]);

  const quit = useCallback(() => {
    dispatch({ type: 'quit' });
    send({ type: 'game_quit' });
  }, [send]);

  return { state, now, start, shown, bonk, tap, quit, reconnect: connect };
}
