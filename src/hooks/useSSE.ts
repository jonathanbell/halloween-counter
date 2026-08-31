import { useEffect, useState, useRef, useCallback } from 'react';

export type SSEMessage =
  | { type: 'increment' | 'effect_lightning' | 'effect_candy_rain' | 'vote'; year: number; total: number; initialCandyCount?: number; timestamp: string }
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

interface ConnectionStatus {
  isConnected: boolean;
  error: string | null;
  reconnectAttempts: number;
}

// One EventSource per URL, shared by every hook instance on the page.
// Multiple components subscribe to /api/events (counter, game overlay,
// effects), and each opening its own connection multiplies server load
interface SharedConnection {
  url: string;
  es: EventSource | null;
  listeners: Set<(msg: SSEMessage) => void>;
  statusListeners: Set<() => void>;
  status: ConnectionStatus;
  reconnectTimer: number | null;
  closeTimer: number | null;
  refCount: number;
}

const connections = new Map<string, SharedConnection>();

function notifyStatus(conn: SharedConnection) {
  conn.statusListeners.forEach(cb => cb());
}

function connect(conn: SharedConnection) {
  conn.es?.close();

  const eventSource = new EventSource(conn.url);
  conn.es = eventSource;

  eventSource.onopen = () => {
    console.log('[SSE] Connection established');
    conn.status = { isConnected: true, error: null, reconnectAttempts: 0 };
    notifyStatus(conn);
  };

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as SSEMessage;
      conn.listeners.forEach(cb => cb(data));
    } catch (err) {
      console.error('[SSE] Parse error:', err);
      conn.status = { ...conn.status, error: 'Failed to parse server message' };
      notifyStatus(conn);
    }
  };

  eventSource.onerror = () => {
    eventSource.close();
    const attempts = conn.status.reconnectAttempts + 1;
    conn.status = { isConnected: false, error: 'Connection lost', reconnectAttempts: attempts };
    notifyStatus(conn);

    const delay = Math.min(1000 * Math.pow(2, attempts - 1), 30000);
    if (conn.reconnectTimer) {
      clearTimeout(conn.reconnectTimer);
    }
    conn.reconnectTimer = window.setTimeout(() => connect(conn), delay);
  };
}

function acquire(url: string): SharedConnection {
  let conn = connections.get(url);
  if (!conn) {
    conn = {
      url,
      es: null,
      listeners: new Set(),
      statusListeners: new Set(),
      status: { isConnected: false, error: null, reconnectAttempts: 0 },
      reconnectTimer: null,
      closeTimer: null,
      refCount: 0,
    };
    connections.set(url, conn);
    connect(conn);
  }
  conn.refCount += 1;
  if (conn.closeTimer) {
    clearTimeout(conn.closeTimer);
    conn.closeTimer = null;
  }
  return conn;
}

function release(conn: SharedConnection) {
  conn.refCount -= 1;
  if (conn.refCount > 0) return;

  // Grace period before closing: StrictMode remounts and brief component
  // swaps drop to zero and immediately re-subscribe
  conn.closeTimer = window.setTimeout(() => {
    if (conn.refCount > 0) return;
    conn.es?.close();
    if (conn.reconnectTimer) {
      clearTimeout(conn.reconnectTimer);
    }
    connections.delete(conn.url);
  }, 1000);
}

export const useSSE = (url: string): UseSSEReturn => {
  const [lastMessage, setLastMessage] = useState<SSEMessage | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>({
    isConnected: false,
    error: null,
    reconnectAttempts: 0,
  });

  const listenersRef = useRef<Array<(msg: SSEMessage) => void>>([]);

  const registerListener = useCallback((cb: (msg: SSEMessage) => void) => {
    listenersRef.current.push(cb);
    return () => {
      listenersRef.current = listenersRef.current.filter(l => l !== cb);
    };
  }, []);

  useEffect(() => {
    const conn = acquire(url);

    const onMessage = (msg: SSEMessage) => {
      setLastMessage(msg);
      listenersRef.current.forEach(cb => cb(msg));
    };
    const onStatus = () => setStatus({ ...conn.status });

    conn.listeners.add(onMessage);
    conn.statusListeners.add(onStatus);
    onStatus(); // sync with the connection's current state

    return () => {
      conn.listeners.delete(onMessage);
      conn.statusListeners.delete(onStatus);
      release(conn);
    };
  }, [url]);

  return {
    lastMessage,
    isConnected: status.isConnected,
    error: status.error,
    reconnectAttempts: status.reconnectAttempts,
    registerListener,
  };
};
