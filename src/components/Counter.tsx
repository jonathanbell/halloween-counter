import React, { useMemo } from "react";
import "./Counter.css";

const DIGIT_PLACES = 3;

// Each well is its own screen: same five-stage glitch, but its own offset,
// sweep speed and recovery time, re-rolled on every increment. Ranges are
// consumed as CSS custom properties - see the multipliers in Counter.css.
const WELL_RANGES = {
  "--glitch-jitter": [0, 55, "ms"],
  "--split-scale": [0.45, 1.6, ""],
  "--blank-scale": [0.6, 1.5, ""],
  "--scan-scale": [0.7, 1.45, ""],
  "--surge-scale": [0.75, 1.3, ""],
} as const;

const randIn = (min: number, max: number) => min + Math.random() * (max - min);

const rollWell = (): React.CSSProperties => {
  const vars: Record<string, string> = {};

  for (const [name, [min, max, unit]] of Object.entries(WELL_RANGES)) {
    vars[name] = `${randIn(min, max).toFixed(2)}${unit}`;
  }

  // Which channel leads the split - the cheapest way to stop three wells
  // from tearing in the same direction
  vars["--split-dir"] = Math.random() < 0.5 ? "1" : "-1";

  return vars as React.CSSProperties;
};

interface CounterProps {
  count: number;
  isAnimating: boolean;
  isOutOfCandy?: boolean;
}

export const Counter: React.FC<CounterProps> = React.memo(
  ({ count, isAnimating, isOutOfCandy = false }) => {
    const digits = useMemo(
      () => count.toString().padStart(DIGIT_PLACES, "0").split(""),
      [count],
    );

    // Held per count so a re-render mid-glitch cannot re-roll the offsets
    // under a running animation
    const wells = useMemo(() => digits.map(rollWell), [digits]);

    return (
      <div className="counter-container">
        <div className={`counter-label ${isOutOfCandy ? "out-of-candy" : ""}`}>
          Now serving customer number:
        </div>
        <div className={`counter-display ${isAnimating ? "animating" : ""}`}>
          {digits.map((digit, index) => (
            // Keyed by the count: every well remounts on a change, so a second
            // increment inside the animation window restarts the glitch
            // instead of being swallowed by the class already being there.
            <div
              key={`${index}-${count}`}
              className={`digit-container ${isAnimating ? "glitching" : ""}`}
              style={wells[index]}
            >
              <div className="digit" data-digit={digit}>
                {digit}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },
);
