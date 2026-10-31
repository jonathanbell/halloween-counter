import { isDecoy, type PopKind, type Verdict } from './protocol';
import type { LabelTone } from './GraveyardScene';

// Faster than this and the label goes green
const GREAT_MS = 300;

// What floats above a grave after a bonk, on the phone and the garage door.
// The phone knows the reaction time before the server answers; the points
// join the label when the verdict arrives.
export function bonkLabel(kind: PopKind, ms: number, verdict?: Verdict, points?: number): { lines: string[]; tone: LabelTone } {
  const pts = points === undefined ? [] : [points > 0 ? `+${points}` : String(points)];

  if (isDecoy(kind)) return { tone: 'bad', lines: ['OOPS!', ...pts] };
  if (verdict === 'too_fast') return { tone: 'meh', lines: ['TOO FAST', '🤨'] };
  if (verdict === 'escaped') return { tone: 'meh', lines: ['TOO SLOW'] };

  const tone = kind === 'golden' || ms < GREAT_MS ? 'great' : 'good';
  return { tone, lines: ['BONK!', `${ms}ms`, ...pts] };
}
