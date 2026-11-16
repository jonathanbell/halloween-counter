import { Fragment, useEffect, useState } from 'react';
import './FreezeCountdown.css';

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

// The whole page any day but Halloween. Set like the countdown spoken in
// Donnie Darko: numbers on one side of a centre axis, units on the other,
// over a sky that is slowly opening.
//
//        351 days
//          0 hours
//         49 minutes
//         12 seconds
//   That is when Halloween begins.
export const FreezeCountdown = ({ opensAt }: { opensAt: number }) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), SECOND_MS);
    return () => window.clearInterval(timer);
  }, []);

  // Clamped: a phone clock running fast reaches zero before the server
  // opens, and must wait there rather than count into negatives
  const left = Math.max(0, opensAt - now);

  const parts = [
    { unit: 'day', value: Math.floor(left / DAY_MS) },
    { unit: 'hour', value: Math.floor((left % DAY_MS) / HOUR_MS) },
    { unit: 'minute', value: Math.floor((left % HOUR_MS) / MINUTE_MS) },
    { unit: 'second', value: Math.floor((left % MINUTE_MS) / SECOND_MS) },
  ];

  return (
    <section className="freeze">
      <div className="freeze-vortex" aria-hidden="true" />

      {/* role="timer" is not read out every second, unlike a live region */}
      <div className="freeze-clock" role="timer">
        {parts.map(({ unit, value }) => (
          <Fragment key={unit}>
            <span className="freeze-number">
              {/* Creepster's digits differ in width: a cell each, or the
                  number shivers sideways every second */}
              {[...String(value)].map((digit, place) => (
                <span key={place} className="freeze-digit">{digit}</span>
              ))}
            </span>
            {' '}
            <span className="freeze-unit">{value === 1 ? unit : `${unit}s`}</span>
            {' '}
          </Fragment>
        ))}
      </div>

      <p className="freeze-omen">That is when Halloween begins.</p>
    </section>
  );
};
