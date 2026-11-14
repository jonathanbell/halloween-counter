import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { colors } from '../theme';
import { useSSE } from '../hooks/useSSE';
import { fiveMinuteBuckets } from '../hooks/useStats';
import { PageShell } from './PageShell';
import { HallOfFame } from './HallOfFame';
import { CURRENT_YEAR, FIRST_YEAR } from '../year';
import './StatsPage.css';

interface HistogramPoint {
  minute: string;
  count: number;
}

interface StatsData {
  total: number;
  histogram: HistogramPoint[];
}

// Every Halloween on record, oldest first: 2025, 2026, ... this year
const YEARS = Array.from({ length: CURRENT_YEAR - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i);

// The first year has a total but no taps: draw it as one bar at 6pm PDT
const SYNTHETIC_TIMESTAMP = `${FIRST_YEAR}-10-31T18:00:00-07:00`;

const fetchStats = (year: number): Promise<StatsData> =>
  fetch(`/api/stats?year=${year}`)
    .then(r => r.json())
    .then((stats: StatsData) => year === FIRST_YEAR && stats.total > 0
      ? { ...stats, histogram: [{ minute: SYNTHETIC_TIMESTAMP, count: stats.total }] }
      : stats);

export const StatsPage = () => {
  const [byYear, setByYear] = useState<Record<number, StatsData>>({});
  const [year, setYear] = useState(CURRENT_YEAR);
  const { lastMessage } = useSSE('/api/events');

  useEffect(() => {
    Promise.all(YEARS.map(fetchStats))
      .then(all => setByYear(Object.fromEntries(YEARS.map((y, i) => [y, all[i]]))))
      .catch(err => console.error('stats fetch failed:', err));
  }, []);

  // Refetch so admin total overrides land correctly too.
  useEffect(() => {
    if (lastMessage?.type !== 'increment') return;
    if (lastMessage.year !== CURRENT_YEAR) return;

    fetchStats(CURRENT_YEAR)
      .then(stats => setByYear(prev => ({ ...prev, [CURRENT_YEAR]: stats })))
      .catch(err => console.error('stats refresh failed:', err));
  }, [lastMessage]);

  const active = byYear[year];
  const loaded = YEARS.every(y => byYear[y]);

  return (
    <PageShell active="stats" title="🎃 Candy Stats">
      <div className="stats-page">
        <HallOfFame year={year} />

        {loaded && (
          <div className="card">
            <h3>Total trick-or-treaters by year</h3>
            <p className="card-desc">How many customers served year over year</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={YEARS.map(y => ({ year: String(y), total: byYear[y].total }))}>
                <XAxis dataKey="year" tick={{ fill: colors.textDim }} />
                <YAxis tick={{ fill: colors.textDim }} />
                <Tooltip contentStyle={{ background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 8 }} />
                <Bar dataKey="total" fill={colors.accent} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="year-toggle">
          {[...YEARS].reverse().map(y => (
            <button
              key={y}
              className={`btn btn-ghost year-btn ${y === year ? 'selected' : ''}`}
              onClick={() => setYear(y)}
            >
              {y}
            </button>
          ))}
        </div>

        {active && (
          <>
            <div className="card stats-total">
              <div className="stats-total-label">{year} Count</div>
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

          </>
        )}
      </div>
    </PageShell>
  );
};
