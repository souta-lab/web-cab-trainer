import { describe, expect, it } from 'vitest';
import { applyPrimitives, figureKey } from '../src/domain/figure';
import { validateProblem } from '../src/domain/invariants';
import { DIFFICULTIES } from '../src/domain/types';
import type { FigureProblem } from '../src/domain/types';
import { generatePattern } from '../src/generators/pattern';
import { expectedShares } from '../src/generators/policy';
import type { RuleCount } from '../src/generators/policy';

const SEEDS = 2000;
const TIMEOUT_MS = 120_000;

const label = (seed: number, difficulty: number): string => `seed=${seed} difficulty=${difficulty}`;

function ruleCountOf(problem: FigureProblem): RuleCount {
  if (problem.skillTags.includes('composite-3')) return 3;
  if (problem.skillTags.includes('composite-2')) return 2;
  return 1;
}

describe('generatePattern property checks', () => {
  it('produces invariant-clean problems for seeds 1..2000 at every difficulty', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      for (const difficulty of DIFFICULTIES) {
        const problem = generatePattern({ seed, difficulty });
        expect(validateProblem(problem), label(seed, difficulty)).toEqual([]);
      }
    }
  }, TIMEOUT_MS);

  it('is deterministic: same seed and difficulty regenerate a deep-equal problem', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      for (const difficulty of DIFFICULTIES) {
        const first = generatePattern({ seed, difficulty });
        const second = generatePattern({ seed, difficulty });
        expect(second, label(seed, difficulty)).toEqual(first);
      }
    }
  }, TIMEOUT_MS);

  it('records the requested seed unchanged, including the default-difficulty path', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      expect(generatePattern({ seed }).seed).toBe(seed);
      for (const difficulty of DIFFICULTIES) {
        expect(generatePattern({ seed, difficulty }).seed).toBe(seed);
      }
    }
  }, TIMEOUT_MS);

  it('has exactly 5 choices pairwise distinct by figureKey', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      for (const difficulty of DIFFICULTIES) {
        const problem = generatePattern({ seed, difficulty });
        const tag = label(seed, difficulty);
        expect(problem.choices, tag).toHaveLength(5);
        expect(new Set(problem.choices.map(figureKey)).size, tag).toBe(5);
      }
    }
  }, TIMEOUT_MS);

  it('links start/ops, frames, missingIndex and the correct choice to one answer state', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      for (const difficulty of DIFFICULTIES) {
        const problem = generatePattern({ seed, difficulty });
        const tag = label(seed, difficulty);
        expect(problem.prompt, tag).toBe('空欄に入る図形を選べ');
        expect(problem.correctIndex >= 0 && problem.correctIndex < problem.choices.length, tag).toBe(
          true,
        );
        const solved = figureKey(applyPrimitives(problem.start, problem.ops));
        expect(solved, tag).toBe(figureKey(problem.choices[problem.correctIndex]));
        const frames = problem.frames ?? [];
        const missingIndex = problem.missingIndex ?? -1;
        expect(frames, tag).toHaveLength(5);
        expect(missingIndex >= 1 && missingIndex <= 3, tag).toBe(true);
        expect(figureKey(frames[missingIndex]), tag).toBe(solved);
      }
    }
  }, TIMEOUT_MS);

  it('matches expected pattern rule-count shares over 50k uniform-difficulty draws (±3pp)', () => {
    const draws = 50_000;
    const counts: Record<RuleCount, number> = { 1: 0, 2: 0, 3: 0 };
    for (let i = 0; i < draws; i++) {
      const difficulty = DIFFICULTIES[i % DIFFICULTIES.length];
      counts[ruleCountOf(generatePattern({ seed: i + 1, difficulty }))] += 1;
    }
    const expected = expectedShares().patternRuleCount;
    const ruleCounts: readonly RuleCount[] = [1, 2, 3];
    for (const ruleCount of ruleCounts) {
      const observedShare = counts[ruleCount] / draws;
      expect(Math.abs(observedShare - expected[ruleCount]), `ruleCount=${ruleCount}`).toBeLessThanOrEqual(
        0.03,
      );
    }
  }, TIMEOUT_MS);
});
