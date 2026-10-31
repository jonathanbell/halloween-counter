import type { DecoyKind } from './protocol';

export type DecoyTally = Record<DecoyKind, number>;

export const emptyTally = (): DecoyTally => ({ grandma: 0, cat: 0, kevin: 0 });

// Fastest first: the first threshold your average beats names you
const SPEED_TITLES: Array<{ underMs: number; title: string }> = [
  { underMs: 350, title: 'Literally The Flash' },
  { underMs: 450, title: 'Certified Zombie Bonker' },
  { underMs: 550, title: 'Ninja Trick-or-Treater' },
  { underMs: 700, title: 'Pretty Spooky' },
  { underMs: 900, title: 'Sleepy Vampire' },
];
const SLOWEST_TITLE = 'Sleepy Sloth';
const NO_BONKS_TITLE = 'Zombie Pacifist';

// Two or more decoy bonks earns a roast instead of a speed title. Ties go
// to Grandma, then Kevin, then the cat
const DECOY_ROAST_AT = 2;
const DECOY_TITLES: Array<{ kind: DecoyKind; title: string }> = [
  { kind: 'grandma', title: "Grandma's Worst Nightmare" },
  { kind: 'kevin', title: "Kevin's Mom Wants a Word" },
  { kind: 'cat', title: 'The Cat Will Remember This' },
];

export function gameTitle(avgMs: number | null, decoys: DecoyTally): string {
  const totalDecoys = decoys.grandma + decoys.cat + decoys.kevin;
  if (totalDecoys >= DECOY_ROAST_AT) {
    const worst = DECOY_TITLES.reduce((a, b) => (decoys[b.kind] > decoys[a.kind] ? b : a));
    return worst.title;
  }

  if (avgMs === null) return NO_BONKS_TITLE;
  return SPEED_TITLES.find(t => avgMs < t.underMs)?.title ?? SLOWEST_TITLE;
}

// Shouted on the phone and the garage door when a decoy gets bonked
export const DECOY_BANNERS: Record<DecoyKind, string> = {
  grandma: 'YOU BONKED GRANDMA! 😱',
  cat: 'NOT THE CAT! 🙀',
  kevin: "THAT'S JUST KEVIN! 🙄",
};
