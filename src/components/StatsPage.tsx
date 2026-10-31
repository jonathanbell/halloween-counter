import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { colors } from '../theme';
import { useSSE } from '../hooks/useSSE';
import { fiveMinuteBuckets } from '../hooks/useStats';
import { useVote } from '../hooks/useVote';
import { CandyVote } from './CandyVote';
import { PageShell } from './PageShell';
import { HallOfFame } from './HallOfFame';
import './StatsPage.css';

interface HistogramPoint {
  minute: string;
  count: number;
}

interface StatsData {
  total: number;
  votes: Record<string, number>;
  histogram: HistogramPoint[];
}

const YEAR_NOW = 2026;
const YEAR_LAST = 2025;
const SYNTHETIC_TIMESTAMP = '2025-10-31T18:00:00-07:00';

// Horizontal vote bars: one row per candy, so 20+ options still read on a phone
const VOTE_ROW_PX = 32;
const VOTE_CHART_MIN_PX = 120;
const VOTE_LABEL_PX = 110;

export const StatsPage = () => {
  const [current, setCurrent] = useState<StatsData | null>(null);
  const [lastYear, setLastYear] = useState<StatsData | null>(null);
  const [showLastYear, setShowLastYear] = useState(false);
  const { options, voted, recorded, vote } = useVote();
  const { lastMessage } = useSSE('/api/events');

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

  // Live tallies: refetch this year's stats on every increment or vote.
  // Refetch, not patch, so admin total overrides land correctly too.
  // shortcut: one /api/stats call per message per viewer, debounce if the box ever strains
  useEffect(() => {
    if (lastMessage?.type !== 'increment' && lastMessage?.type !== 'vote') return;
    if (lastMessage.year !== YEAR_NOW) return;

    fetch(`/api/stats?year=${YEAR_NOW}`)
      .then(r => r.json())
      .then(setCurrent)
      .catch(err => console.error('stats refresh failed:', err));
  }, [lastMessage]);

  const active = showLastYear ? lastYear : current;
  const year = showLastYear ? YEAR_LAST : YEAR_NOW;

  // Labels come from this year's options; anything else (2025, a removed
  // option) falls back to the raw id
  const voteRows = Object.entries(active?.votes ?? {})
    .map(([id, count]) => ({ name: options.find(o => o.id === id)?.label ?? id, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <PageShell active="stats" title="🎃 Candy Stats">
      <div className="stats-page">
        <HallOfFame year={year} />

        {current && lastYear && (
          <div className="card">
            <h3>Total trick-or-treaters by year</h3>
            <p className="card-desc">How many customers served year over year</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={[
                { year: String(YEAR_LAST), total: lastYear.total },
                { year: String(YEAR_NOW), total: current.total },
              ]}>
                <XAxis dataKey="year" tick={{ fill: colors.textDim }} />
                <YAxis tick={{ fill: colors.textDim }} />
                <Tooltip contentStyle={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 8 }} />
                <Bar dataKey="total" fill={colors.accent} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="year-toggle">
          <button
            className={`btn btn-ghost year-btn ${!showLastYear ? 'selected' : ''}`}
            onClick={() => setShowLastYear(false)}
          >
            {YEAR_NOW}
          </button>
          <button
            className={`btn btn-ghost year-btn ${showLastYear ? 'selected' : ''}`}
            onClick={() => setShowLastYear(true)}
          >
            {YEAR_LAST}
          </button>
        </div>

        {active && (
          <>
            <div className="card stats-total">
              <div className="stats-total-label">Current {year} Count</div>
              <div className="stats-total-value readout">{active.total}</div>
            </div>

            {active.histogram.length > 0 ? (
              <div className="card">
                <h3>Customers served over time</h3>
                <p className="card-desc">Candies given out every 5 minutes.</p>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={fiveMinuteBuckets(active.histogram)}>
                    <XAxis
                      dataKey="minute"
                      tick={{ fill: colors.textDim, fontSize: 11 }}
                      tickFormatter={(v) => {
                        try { return new Date(String(v)).toLocaleTimeString(); }
                        catch { return String(v); }
                      }}
                    />
                    <YAxis tick={{ fill: colors.textDim }} />
                    <Tooltip
                      contentStyle={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 8 }}
                      labelFormatter={(v) => {
                        try { return new Date(String(v)).toLocaleString(); }
                        catch { return String(v); }
                      }}
                    />
                    <Bar dataKey="count" fill={colors.accent} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="card stats-empty">
                No handout data for {year}
              </div>
            )}

            <div className="card">
              <h3>Favorite candy votes</h3>
              <p className="card-desc"><strong>Everyone's pick for best candy. Cast yours below!</strong></p>
              {voteRows.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(VOTE_CHART_MIN_PX, voteRows.length * VOTE_ROW_PX)}>
                  <BarChart data={voteRows} layout="vertical">
                    <XAxis type="number" allowDecimals={false} tick={{ fill: colors.textDim }} />
                    <YAxis type="category" dataKey="name" width={VOTE_LABEL_PX} tick={{ fill: colors.textDim }} />
                    <Tooltip contentStyle={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 8 }} />
                    <Bar dataKey="count" fill={colors.vote} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="stats-empty">No votes yet</div>
              )}
            </div>
          </>
        )}

        {!showLastYear && options.length > 0 && (
          <div className="card stats-vote-row">
            <span className="vote-label">Vote for favorite candy:</span>
            <CandyVote options={options} voted={voted} onVote={vote} />
            {recorded && <span className="vote-recorded">Your vote has been recorded.</span>}
          </div>
        )}
      </div>
    </PageShell>
  );
};
