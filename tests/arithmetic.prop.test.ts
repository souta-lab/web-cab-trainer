import { describe, expect, it } from 'vitest';
import { validateProblem } from '../src/domain/invariants';
import { render, solve, verifyArith } from '../src/domain/recipe';
import { DIFFICULTIES } from '../src/domain/types';
import { generateArithmetic } from '../src/generators/arithmetic';

const SEEDS = 2000;
const TIMEOUT_MS = 60_000;

const label = (seed: number, difficulty: number): string => `seed=${seed} difficulty=${difficulty}`;

describe('generateArithmetic property checks', () => {
  it('produces invariant-clean problems for seeds 1..2000 at every difficulty', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      for (const difficulty of DIFFICULTIES) {
        const problem = generateArithmetic({ seed, difficulty });
        expect(validateProblem(problem), label(seed, difficulty)).toEqual([]);
      }
    }
  }, TIMEOUT_MS);

  it('is deterministic: same seed and difficulty regenerate a deep-equal problem', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      for (const difficulty of DIFFICULTIES) {
        const first = generateArithmetic({ seed, difficulty });
        const second = generateArithmetic({ seed, difficulty });
        expect(second, label(seed, difficulty)).toEqual(first);
      }
    }
  }, TIMEOUT_MS);

  it('records the requested seed unchanged, including the default-difficulty path', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      expect(generateArithmetic({ seed }).seed).toBe(seed);
      for (const difficulty of DIFFICULTIES) {
        expect(generateArithmetic({ seed, difficulty }).seed).toBe(seed);
      }
    }
  }, TIMEOUT_MS);

  it('has exactly 5 finite pairwise-distinct choices with the answer exactly once', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      for (const difficulty of DIFFICULTIES) {
        const problem = generateArithmetic({ seed, difficulty });
        const tag = label(seed, difficulty);
        expect(problem.choices, tag).toHaveLength(5);
        expect(new Set(problem.choices).size, tag).toBe(5);
        expect(problem.choices.every((choice) => Number.isFinite(choice)), tag).toBe(true);
        expect(problem.choices.filter((choice) => choice === problem.answer), tag).toHaveLength(1);
        expect(problem.choices[problem.correctIndex], tag).toBe(problem.answer);
        expect(Math.abs(problem.answer) <= 10000, tag).toBe(true);
      }
    }
  }, TIMEOUT_MS);

  it('derives display and answer from the recipe (render + solve + verifyArith)', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      for (const difficulty of DIFFICULTIES) {
        const problem = generateArithmetic({ seed, difficulty });
        const tag = label(seed, difficulty);
        expect(verifyArith(problem.recipe).ok, tag).toBe(true);
        expect(solve(problem.recipe), tag).toBe(problem.answer);
        expect(render(problem.recipe), tag).toBe(problem.display);
      }
    }
  }, TIMEOUT_MS);
});
