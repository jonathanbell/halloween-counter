import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Counter } from '../components/Counter';

// .glitching is what runs the CRT animation. It lands on every well at once,
// and never on a page that has simply loaded.
const glitching = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('.digit-container')).map(el =>
    el.classList.contains('glitching'),
  );

describe('Counter', () => {
  it('renders a settled readout on first paint', () => {
    const { container } = render(<Counter count={128} isAnimating={false} />);

    expect(glitching(container)).toEqual([false, false, false]);
  });

  it('glitches all three wells on an increment', () => {
    const { container, rerender } = render(
      <Counter count={128} isAnimating={false} />,
    );
    rerender(<Counter count={129} isAnimating={true} />);

    expect(glitching(container)).toEqual([true, true, true]);
  });

  it('remounts the wells on a change so a rapid second hit restarts', () => {
    const { container, rerender } = render(
      <Counter count={129} isAnimating={true} />,
    );
    const first = container.querySelector('.digit-container');

    rerender(<Counter count={130} isAnimating={true} />);

    expect(container.querySelector('.digit-container')).not.toBe(first);
    expect(glitching(container)).toEqual([true, true, true]);
  });

  it('rolls a different glitch for every well', () => {
    const { container } = render(<Counter count={222} isAnimating={true} />);

    // Same digit in all three wells, so any difference is the roll, not the
    // value. --split-dir is two-valued and may legitimately collide.
    const rolled = Array.from(container.querySelectorAll('.digit-container'))
      .map(el => (el as HTMLElement).style.cssText.replace(/--split-dir[^;]*;/, ''));

    expect(new Set(rolled).size).toBe(3);
  });

  it('carries the digit on data-digit for the split channels', () => {
    const { container } = render(<Counter count={7} isAnimating={false} />);

    const values = Array.from(container.querySelectorAll('.digit')).map(el =>
      el.getAttribute('data-digit'),
    );
    expect(values).toEqual(['0', '0', '7']);
  });
});
