import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

const CANDY_OPTIONS = [
  { id: 'snickers', label: 'Snickers', emoji: '🍫' },
  { id: 'm&ms', label: "M&M's", emoji: '🟤' },
  { id: 'twix', label: 'Twix', emoji: '🍪' },
];

interface HistogramPoint {
  minute: string;
  count: number;
}

interface StatsData {
  total: number;
  votes: Record<string, number>;
  histogram: HistogramPoint[];
  gameScores: Array<{ score: number; timestamp: string }>;
}

const YEAR_NOW = 2026;
const YEAR_LAST = 2025;
const SYNTHETIC_TIMESTAMP = '2025-10-31T18:00:00-07:00';

export const StatsPage = () => {
  const [current, setCurrent] = useState<StatsData | null>(null);
  const [lastYear, setLastYear] = useState<StatsData | null>(null);
  const [showLastYear, setShowLastYear] = useState(false);
  const [voted, setVoted] = useState<string | null>(
    () => localStorage.getItem('halloweenVote2026') || null
  );
  const [badgeCopied, setBadgeCopied] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/stats?year=${YEAR_NOW}`).then(r => r.json()),
      fetch(`/api/stats?year=${YEAR_LAST}`).then(r => r.json()),
    ]).then(([now, last]) => {
      setCurrent(now);

      // Synthesize last year's histogram: one bucket at 6pm PDT
      if (last.total > 0) {
        last.histogram = [{ minute: SYNTHETIC_TIMESTAMP, count: last.total }];
      }
      setLastYear(last);
    }).catch(err => console.error('stats fetch failed:', err));
  }, []);

  const vote = async (candyType: string) => {
    try {
      await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: 2026, candyType }),
      });
      setVoted(candyType);
      localStorage.setItem('halloweenVote2026', candyType);

      const refresh = await fetch(`/api/stats?year=${YEAR_NOW}`).then(r => r.json());
      setCurrent(refresh);
    } catch (err) {
      console.error('Vote failed:', err);
    }
  };

  const copyBadgeLink = async () => {
    const url = `${window.location.origin}/stats`;
    try {
      await navigator.clipboard.writeText(url);
      setBadgeCopied(true);
      setTimeout(() => setBadgeCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const active = showLastYear ? lastYear : current;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      color: '#fff',
      padding: '24px',
      fontFamily: 'monospace',
    }}>
      <h1 style={{ textAlign: 'center', marginBottom: '24px' }}>🎃 Halloween Candy Stats</h1>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '24px' }}>
        <button
          onClick={() => setShowLastYear(false)}
          style={{
            padding: '10px 20px',
            background: !showLastYear ? '#e67e22' : '#333',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          {YEAR_NOW}
        </button>
        <button
          onClick={() => setShowLastYear(true)}
          style={{
            padding: '10px 20px',
            background: showLastYear ? '#e67e22' : '#333',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          {YEAR_LAST}
        </button>
      </div>

      {active && (
        <div>
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '24px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '14px', color: '#aaa' }}>TOTAL CANDIES</div>
            <div style={{ fontSize: '56px', fontWeight: 'bold' }}>{active.total}</div>
            <button
              onClick={copyBadgeLink}
              style={{
                marginTop: '12px',
                padding: '8px 16px',
                background: badgeCopied ? '#27ae60' : '#e67e22',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              {badgeCopied ? 'Copied!' : '📋 Share Badge'}
            </button>
          </div>

          {active.histogram.length > 0 ? (
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '24px',
            }}>
              <h3 style={{ marginBottom: '16px' }}>Handout rate (per minute)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={active.histogram}>
                  <XAxis
                    dataKey="minute"
                    tick={{ fill: '#fff', fontSize: 10 }}
                    tickFormatter={(v) => {
                      try { return new Date(String(v)).toLocaleTimeString(); }
                      catch { return String(v); }
                    }}
                  />
                  <YAxis tick={{ fill: '#fff' }} />
                  <Tooltip
                    contentStyle={{ background: '#333', border: 'none' }}
                    labelFormatter={(v) => {
                      try { return new Date(String(v)).toLocaleString(); }
                      catch { return String(v); }
                    }}
                  />
                  <Bar dataKey="count" fill="#e67e22" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '24px',
              textAlign: 'center',
              color: '#888',
            }}>
              No per-minute data for {showLastYear ? YEAR_LAST : YEAR_NOW}
            </div>
          )}

          <div style={{
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '20px',
          }}>
            <h3 style={{ marginBottom: '16px' }}>Favorite candy votes</h3>
            {Object.entries(active.votes).length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={Object.entries(active.votes).map(([name, count]) => ({ name, count }))}>
                  <XAxis dataKey="name" tick={{ fill: '#fff' }} />
                  <YAxis tick={{ fill: '#fff' }} />
                  <Tooltip contentStyle={{ background: '#333', border: 'none' }} />
                  <Bar dataKey="count" fill="#9b59b6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ color: '#888' }}>No votes yet</div>
            )}
          </div>

          {active.gameScores && active.gameScores.length > 0 && (
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '20px',
              marginTop: '24px',
            }}>
              <h3 style={{ marginBottom: '12px' }}>🎮 Game scores</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
                {active.gameScores.map((gs, i) => (
                  <div key={i} style={{
                    background: 'rgba(230,126,34,0.2)',
                    border: '1px solid rgba(230,126,34,0.3)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    textAlign: 'center',
                    minWidth: '80px',
                  }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#e67e22' }}>
                      {gs.score}
                    </div>
                    <div style={{ fontSize: '11px', color: '#888' }}>
                      {new Date(gs.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!showLastYear && (
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
          padding: '16px', marginTop: '12px', flexWrap: 'wrap',
        }}>
          <span style={{ color: '#aaa', fontSize: '14px' }}>Vote for favorite candy:</span>
          {CANDY_OPTIONS.map(option => (
            <button
              key={option.id}
              onClick={() => vote(option.id)}
              disabled={!!voted}
              style={{
                padding: '8px 14px',
                background: voted === option.id ? '#9b59b6' : 'rgba(255,255,255,0.15)',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '13px',
                cursor: voted ? 'default' : 'pointer',
                opacity: voted ? 1 : 0.9,
              }}
            >
              {option.emoji} {option.label}
            </button>
          ))}
          {voted && <span style={{ color: '#9b59b6', fontSize: '12px' }}>Vote recorded!</span>}
        </div>
      )}

      <div style={{ marginTop: '24px', textAlign: 'center' }}>
        <a href="/" style={{ color: '#e67e22' }}>← Back to counter</a>
      </div>
    </div>
  );
};
