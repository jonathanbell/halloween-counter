import { useEffect, useState, useRef, useCallback } from 'react';

interface SSEState {
  currentCount: number;
  candyRemaining: number;
  initialCandyCount: number;
}

interface UseSSEReturn {
  state: SSEState | null;
  isConnected: boolean;
  error: string | null;
  reconnectAttempts: number;
}

export const useSSE = (url: string): UseSSEReturn => {
  const [state, setState] = useState<SSEState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  
  const connect = useCallback(() => {
    // Clean up any existing connection
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
        const data = JSON.parse(event.data);
        console.log('[SSE] Received data:', data);
        setState(data);
      } catch (err) {
        console.error('[SSE] Error parsing message:', err);
        setError('Failed to parse server message');
      }
    };
    
    eventSource.onerror = (err) => {
      console.error('[SSE] Connection error:', err);
      setIsConnected(false);
      setError('Connection lost');
      eventSource.close();
      
      // Attempt to reconnect with exponential backoff
      const attempts = reconnectAttempts + 1;
      setReconnectAttempts(attempts);
      
      const delay = Math.min(1000 * Math.pow(2, attempts - 1), 30000); // Max 30 seconds
      console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${attempts})`);
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, delay);
    };
  }, [url, reconnectAttempts]);
  
  useEffect(() => {
    connect();
    
    // Cleanup on unmount
    return () => {
      console.log('[SSE] Cleaning up connection');
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount
  
  return {
    state,
    isConnected,
    error,
    reconnectAttempts
  };
};