import { useEffect, useRef, useState } from 'react';

export type Difficulty = 'easy' | 'hard' | 'lightning';

export type GameMessage =
  | { type: 'game_started'; sessionId: string }
  | { type: 'game_start_denied'; reason: string }
  | { type: 'zombie_spawned'; zombieId: string; direction: number }
  | { type: 'zombie_missed'; zombieId: string }
  | { type: 'score_update'; result: 'hit' | 'miss'; score: number }
  | { type: 'game_ended'; score: number };

interface UseGameOptions {
  url: string;
}

export function useGame({ url }: UseGameOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentZombies, setCurrentZombies] = useState<Array<{ id: string; direction: number }>>([]);
  const [score, setScore] = useState(0);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = () => {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setIsConnected(true);
      console.log('[Game] connected');
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data) as GameMessage;

      switch (msg.type) {
        case 'game_started':
          setIsPlaying(true);
          setCurrentZombies([]);
          setScore(0);
          setFinalScore(null);
          break;

        case 'game_start_denied':
          alert('Game already in progress');
          break;

        case 'zombie_spawned':
          setCurrentZombies(prev => [...prev, { id: msg.zombieId, direction: msg.direction }]);
          break;

        case 'zombie_missed':
          setCurrentZombies(prev => prev.filter(z => z.id !== msg.zombieId));
          break;

        case 'score_update':
          // Server-authoritative score (covers both hits and misses)
          setScore(msg.score);
          break;

        case 'game_ended':
          setIsPlaying(false);
          setFinalScore(msg.score);
          break;
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsPlaying(false);
    };

    ws.onerror = (err) => {
      console.error('[Game] ws error', err);
      setIsConnected(false);
    };

    wsRef.current = ws;
  };

  const disconnect = () => {
    wsRef.current?.close();
    wsRef.current = null;
    setIsConnected(false);
    setIsPlaying(false);
  };

  const sendMessage = (msg: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  };

  const startGame = (difficulty: Difficulty = 'easy') => {
    sendMessage({ type: 'game_start', difficulty });
  };

  const hitZombie = (zombieId: string) => {
    // Optimistically remove so the tapped zombie disappears immediately
    setCurrentZombies(prev => prev.filter(z => z.id !== zombieId));
    sendMessage({ type: 'zombie_hit', zombieId });
  };

  const endGame = () => {
    sendMessage({ type: 'game_end' });
  };

  useEffect(() => {
    return () => disconnect();
  }, []);

  return {
    isConnected,
    isPlaying,
    currentZombies,
    score,
    finalScore,
    connect,
    disconnect,
    startGame,
    hitZombie,
    endGame,
  };
}
