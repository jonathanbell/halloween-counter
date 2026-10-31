import { describe, expect, it } from 'vitest';
import { emptyTally, gameTitle } from '../game/titles';

describe('gameTitle', () => {
  it('names fast players after their average', () => {
    expect(gameTitle(280, emptyTally())).toBe('Literally The Flash');
    expect(gameTitle(400, emptyTally())).toBe('Certified Zombie Bonker');
    expect(gameTitle(1200, emptyTally())).toBe('Sleepy Sloth');
  });

  it('has a title for a game with no bonks at all', () => {
    expect(gameTitle(null, emptyTally())).toBe('Zombie Pacifist');
  });

  it('keeps the speed title after a single decoy slip', () => {
    expect(gameTitle(280, { ...emptyTally(), grandma: 1 })).toBe('Literally The Flash');
  });

  it('roasts two or more decoy bonks, worst offence first', () => {
    expect(gameTitle(280, { grandma: 2, cat: 0, kevin: 0 })).toBe("Grandma's Worst Nightmare");
    expect(gameTitle(280, { grandma: 0, cat: 2, kevin: 1 })).toBe('The Cat Will Remember This');
    expect(gameTitle(280, { grandma: 1, cat: 0, kevin: 1 })).toBe("Grandma's Worst Nightmare");
  });
});
