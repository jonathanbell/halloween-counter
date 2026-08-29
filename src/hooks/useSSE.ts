import { useEffect, useState, useRef, useCallback } from 'react';

export type SSEMessage =
  | { type: 'increment' | 'effect_lightning' | 'effect_candy_rain' | 'vote'; year: number; total: number; timestamp: string }
  | { type: 'game_status'; active: boolean; sessionId: string; timestamp: string };

interface UseSSEReturn {
  lastMessage: SSEMessage | null;
  isConnected: boolean;
  error: string | null;
  reconnectAttempts: number;
}

export const useSSE = (url: string): UseSSEReturn => {
  const [lastMessage, setLastMessage] = useState<SSEMessage | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    console.log(`[SSE] Connecting to ${url}...`);
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
        console.log('[SSE] Received:', data);
        setLastMessage(data);
      } catch (err) {
        console.error('[SSE] Parse error:', err);
        setError('Failed to parse server message');
      }
    };

    eventSource.onerror = () => {
      console.error('[SSE] Connection error');
      setIsConnected(false);
      setError('Connection lost');
      eventSource.close();

      const attempts = reconnectAttempts + 1;
      setReconnectAttempts(attempts);
      const delay = Math.min(1000 * Math.pow(2, attempts - 1), 30000);
      console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${attempts})`);

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      reconnectTimeoutRef.current = window.setTimeout(() => connect(), delay);
    };
  }, [url, reconnectAttempts]);

  useEffect(() => {
    connect();

    return () => {
      console.log('[SSE] Cleaning up');
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { lastMessage, isConnected, error, reconnectAttempts };
};