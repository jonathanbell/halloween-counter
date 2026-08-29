import { useEffect, useState, useRef, useCallback } from 'react';

export type SSEMessage =
  | { type: 'increment' | 'effect_lightning' | 'effect_candy_rain' | 'vote'; year: number; total: number; timestamp: string }
  | { type: 'game_status'; active: boolean; sessionId: string; timestamp: string }
  | { type: 'zombie_spawned'; zombieId: string; direction: number; timestamp: string }
  | { type: 'zombie_missed'; zombieId: string; timestamp: string };

interface UseSSEReturn {
  lastMessage: SSEMessage | null;
  isConnected: boolean;
  error: string | null;
  reconnectAttempts: number;
  registerListener: (cb: (msg: SSEMessage) => void) => () => void;
}

export const useSSE = (url: string): UseSSEReturn => {
  const [lastMessage, setLastMessage] = useState<SSEMessage | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const listenersRef = useRef<Array<(msg: SSEMessage) => void>>([]);

  const registerListener = useCallback((cb: (msg: SSEMessage) => void) => {
    listenersRef.current.push(cb);
    return () => {
      listenersRef.current = listenersRef.current.filter(l => l !== cb);
    };
  }, []);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[SSE] Connection established');
      setIsConnected(true);
      setError(null);
      setReconnectAttempts(0);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SSEMessage;
        setLastMessage(data);
        listenersRef.current.forEach(cb => cb(data));
      } catch (err) {
        console.error('[SSE] Parse error:', err);
        setError('Failed to parse server message');
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      setError('Connection lost');
      eventSource.close();

      const attempts = reconnectAttempts + 1;
      setReconnectAttempts(attempts);
      const delay = Math.min(1000 * Math.pow(2, attempts - 1), 30000);

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      reconnectTimeoutRef.current = window.setTimeout(() => connect(), delay);
    };
  }, [url, reconnectAttempts]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { lastMessage, isConnected, error, reconnectAttempts, registerListener };
};
