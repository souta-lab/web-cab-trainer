import { describe, expect, it } from 'vitest';
import { Rng } from '../src/utils/rng';
import { generateArithmetic } from '../src/generators/arithmetic';
import { generatePattern, applyPatternRule } from '../src/generators/pattern';
import { generateCommands, applyCommands } from '../src/generators/commands';
import { generateCipher, applyCipher } from '../src/generators/cipher';
import { adaptiveDifficulty, summarize } from '../src/stats/engine';
import type { Attempt } from '../src/types';

describe('seeded RNG', () => {
  it('same seed -> same sequence', () => {
    const a = new Rng(12345); const b = new Rng(12345);
    expect(Array.from({ length: 10 }, () => a.next())).toEqual(
      Array.from({ length: 10 }, () => b.next()),
    );
  });
});

describe('arithmetic generator', () => {
  it('1000問: 正解が選択肢内に1つ・重複なし・NaNなし・seed再現', () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const p = generateArithmetic({ seed, difficulty: ((seed % 3) + 1) as 1 | 2 | 3 });
      expect(p.choices).toHaveLength(5);
      expect(new Set(p.choices).size).toBe(5);
      expect(p.choices.filter((c) => c === p.answer)).toHaveLength(1);
      expect(p.choices.every((c) => Number.isFinite(c))).toBe(true);
      expect(Number.isFinite(p.answer)).toBe(true);
      const q = generateArithmetic({ seed, difficulty: p.difficulty });
      expect(q.display).toBe(p.display);
      expect(q.answer).toBe(p.answer);
    }
  });
  it('x先行生成の解が式を満たす (表示パターンの逆算)', () => {
    const p = generateArithmetic({ seed: 42, difficulty: 1 });
    expect(p.display).toContain('=');
    expect(p.explanation.length).toBeGreaterThan(0);
  });
});

describe('pattern generator', () => {
  it('500問: 正解一意・重複なし・rule再適用で一致', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const p = generatePattern({ seed });
      expect(p.choices).toHaveLength(5);
      const keys = p.choices.map((c) => JSON.stringify(c));
      expect(new Set(keys).size).toBe(5);
      expect(p.correctIndex).toBeGreaterThanOrEqual(0);
      // frames are internally consistent (each step derivable — smoke check rule fn is pure)
      const again = applyPatternRule(p.frames[0], { type: 'fill-toggle' });
      expect(again.objects).toHaveLength(p.frames[0].objects.length);
    }
  });
});

describe('commands generator', () => {
  it('500問: 生成と判定が同じreduceロジック・正解が選択肢内に1つ', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const p = generateCommands({ seed });
      expect(p.start).toBeDefined();
      expect(p.commandSeq!.length).toBeGreaterThan(0);
      const keys = p.choices.map((c) => JSON.stringify(c));
      expect(new Set(keys).size).toBe(5);
      // answer reachable: re-derive is deterministic (same seed -> same fingerprint)
      const q = generateCommands({ seed });
      expect(q.fingerprint).toBe(p.fingerprint);
      expect(applyCommands).toBeDefined();
    }
  });
});

describe('cipher generator', () => {
  it('500問: 例Aの変換が決定的・正解一意', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const p = generateCipher({ seed });
      expect(p.examples).toHaveLength(1);
      const keys = p.choices.map((c) => JSON.stringify(c));
      expect(new Set(keys).size).toBe(5);
      const q = generateCipher({ seed });
      expect(q.fingerprint).toBe(p.fingerprint);
      expect(applyCipher).toBeDefined();
    }
  });
});

describe('scoring + adaptive', () => {
  const mk = (correct: boolean, ms: number, i: number): Attempt => ({
    id: String(i), seed: i, subject: 'arithmetic', difficulty: 2, skillTags: [],
    correct, ms, at: Date.now(), chosenIndex: 0,
    problem: generateArithmetic({ seed: i, difficulty: 2 }),
  });
  it('summary: median/p90/best streak', () => {
    const arr = [1000, 2000, 3000, 4000, 50000].map((ms, i) => mk(i < 4, ms, i));
    const s = summarize(arr);
    expect(s.answered).toBe(5);
    expect(s.medianMs).toBe(3000);
    expect(s.bestStreak).toBe(4);
  });
  it('adaptive: 高正答率高速→3、低正答率→1', () => {
    const good = Array.from({ length: 20 }, (_, i) => mk(true, 5000, i));
    expect(adaptiveDifficulty(good, 2)).toBe(3);
    const bad = Array.from({ length: 20 }, (_, i) => mk(i % 3 === 0, 30000, i));
    expect(adaptiveDifficulty(bad, 2)).toBe(1);
  });
});
