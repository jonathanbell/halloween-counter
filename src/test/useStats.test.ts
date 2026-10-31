import { describe, expect, it } from 'vitest';
import { fiveMinuteBuckets } from '../hooks/useStats';

describe('fiveMinuteBuckets', () => {
  it('sums minutes inside one block into one bar', () => {
    expect(fiveMinuteBuckets([
      { minute: '2026-10-31T18:01:00Z', count: 2 },
      { minute: '2026-10-31T18:04:00Z', count: 3 },
    ])).toEqual([{ minute: '2026-10-31T18:00:00.000Z', count: 5 }]);
  });

  it('splits minutes across a block boundary, in order', () => {
    expect(fiveMinuteBuckets([
      { minute: '2026-10-31T18:04:00Z', count: 1 },
      { minute: '2026-10-31T18:05:00Z', count: 4 },
    ])).toEqual([
      { minute: '2026-10-31T18:00:00.000Z', count: 1 },
      { minute: '2026-10-31T18:05:00.000Z', count: 4 },
    ]);
  });
});
