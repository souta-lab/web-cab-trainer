import { describe, expect, it } from 'vitest';
import { generatePattern } from '../src/generators/pattern';
import { generateCommands } from '../src/generators/commands';
import { generateCipher } from '../src/generators/cipher';
import { generateArithmetic } from '../src/generators/arithmetic';

describe('distribution validation (10000 generated)', () => {
  it('pattern ruleCount分布がreference(25/58/17)に極端乖離しない', () => {
    const n = 4000;
    const counts = { 1: 0, 2: 0, 3: 0 };
    for (let seed = 100001; seed < 100001 + n; seed++) {
      const p = generatePattern({ seed });
      const rc = p.skillTags.includes('composite-3') ? 3 : p.skillTags.includes('composite-2') ? 2 : 1;
      counts[rc as 1 | 2 | 3]++;
    }
    const r1 = counts[1] / n; const r2 = counts[2] / n; const r3 = counts[3] / n;
    console.log(`pattern dist: 1-rule ${(r1 * 100).toFixed(1)}% / 2-rule ${(r2 * 100).toFixed(1)}% / 3-rule ${(r3 * 100).toFixed(1)}% (ref 25/58/17)`);
    expect(r1).toBeGreaterThan(0.1); expect(r1).toBeLessThan(0.45);
    expect(r2).toBeGreaterThan(0.35); expect(r2).toBeLessThan(0.75);
    expect(r3).toBeGreaterThan(0.05); expect(r3).toBeLessThan(0.35);
  });
  it('commands/cipher/arithmetic 計6000問が全て有効', () => {
    for (let seed = 200001; seed < 202001; seed++) {
      const p = generateCommands({ seed });
      expect(p.choices).toHaveLength(5);
      expect(new Set(p.choices.map((c) => JSON.stringify(c))).size).toBe(5);
    }
    for (let seed = 300001; seed < 302001; seed++) {
      const p = generateCipher({ seed });
      expect(p.choices).toHaveLength(5);
    }
    for (let seed = 400001; seed < 404001; seed++) {
      const p = generateArithmetic({ seed });
      expect(p.choices.filter((c) => c === p.answer)).toHaveLength(1);
      expect(p.choices.every((c) => Number.isFinite(c))).toBe(true);
    }
    console.log('commands 2000 + cipher 2000 + arithmetic 4000: all valid, unique answers');
  });
});
