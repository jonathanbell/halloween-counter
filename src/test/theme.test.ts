import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { colors, fonts } from '../theme';

// Guards the mirror relationship: public/theme.css is the single CSS token
// sheet (linked by both the React app and the static admin pages) and must
// declare every value src/theme.ts hands to JS-side consumers.
// Read from disk: vitest stubs CSS imports to empty strings.
const themeCss = readFileSync(resolve(process.cwd(), 'public/theme.css'), 'utf-8');

describe('theme token parity', () => {
  it.each(Object.entries(colors))('declares colour %s as a CSS variable', (_name, value) => {
    expect(themeCss).toContain(value);
  });

  it.each(Object.entries(fonts))('declares font %s as a CSS variable', (_name, value) => {
    expect(themeCss).toContain(value);
  });

  it('self-hosts Digital-7 so the static admin pages get it too', () => {
    expect(themeCss).toContain('@font-face');
    expect(themeCss).toContain('/fonts/digital-7.ttf');
  });
});
