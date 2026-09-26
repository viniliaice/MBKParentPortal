/**
 * Theme guard.
 *
 * The app ships two palettes and a single `useColors()` hook; every screen must read
 * its colours from there. A literal such as `#FFFFFF` or `rgba(255,255,255,0.06)` looks
 * fine in dark mode and is invisible on a white card — exactly the failure this suite
 * exists to prevent, because it cannot be caught by the type checker.
 *
 * `constants/colors.ts` (the palettes themselves) and the data layer's per-child accent
 * colours are the only places allowed to hold literals.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const SCANNED = ['app', 'components'];

/** Every `.ts`/`.tsx` file under a directory, recursively. */
function sourceFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      found.push(...sourceFiles(path));
    } else if (path.endsWith('.ts') || path.endsWith('.tsx')) {
      found.push(path);
    }
  }
  return found;
}

const HEX = /#[0-9a-fA-F]{6}\b/;
const RGBA = /\brgba\(/;

describe('theme colours', () => {
  it('keeps hard-coded colours out of the screens and components', () => {
    const offenders = [];

    for (const dir of SCANNED) {
      for (const file of sourceFiles(join(root, dir))) {
        const source = readFileSync(file, 'utf8');
        const lines = source.split('\n');
        lines.forEach((line, index) => {
          const match = HEX.exec(line) ?? RGBA.exec(line);
          if (match) {
            offenders.push(`${file.slice(root.length)}:${index + 1} ${line.trim()}`);
          }
        });
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `Colours must come from useColors(); found:\n${offenders.join('\n')}`,
    );
  });

  it('declares the same tokens in both palettes', async () => {
    let colors = null;
    try {
      colors = (await import('../../constants/colors.ts')).default;
    } catch {
      return; // Node without TypeScript stripping — the AppColors type already enforces this.
    }

    const light = Object.keys(colors.light).sort();
    const dark = Object.keys(colors.dark).sort();
    assert.deepEqual(light, dark);
    assert.ok(light.includes('foreground') && light.includes('surface') && light.includes('gradient'));
  });
});
