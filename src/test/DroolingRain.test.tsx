import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DroolingRain } from '../components/DroolingRain';

// Rain arrives after mount, as an SSE event bumping the trigger
const rainWith = (count: number) => {
  const { container, rerender } = render(<DroolingRain isActive={false} count={count} />);
  rerender(<DroolingRain isActive={false} externalTrigger={1} count={count} />);

  return container.querySelectorAll('.drooling-emoji');
};

describe('DroolingRain', () => {
  it('drops one emoji per trick-or-treater', () => {
    expect(rainWith(5)).toHaveLength(5);
  });

  it('caps a late-night wave at 200', () => {
    expect(rainWith(500)).toHaveLength(200);
  });
});
