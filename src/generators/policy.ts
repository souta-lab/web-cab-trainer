// Generation distribution policy — the single source of truth for weights.
//
// Tests and `scripts/research-stats.mjs` must assert against these tables /
// `expectedShares()`, never against hard-coded numbers in the README.
//
// Aggregation assumption: difficulties are equally likely (1/3 each), so the
// global share of a bucket is the average of its per-difficulty weight. The
// per-difficulty tables below are chosen so that average equals the research
// targets (pattern 25/58/17, commands 30/50/20, cipher 65/35, decimals 13%).

import { pickWeighted } from '../domain/rng';
import type { Rng } from '../domain/rng';
import { DIFFICULTIES } from '../domain/types';
import type { Difficulty } from '../domain/types';

export type RuleCount = 1 | 2 | 3;
export type CommandFigureCount = 2 | 3 | 4;
export type CipherComposition = 'single' | 'multi';
export type ArithmeticFlavor = 'decimal' | 'integer';

export type WeightedTable<T> = readonly (readonly [T, number])[];

/** pattern rule count per difficulty. Aggregate = 25 / 58 / 17. */
export const PATTERN_RULE_COUNT_WEIGHTS: Record<Difficulty, WeightedTable<RuleCount>> = {
  1: [
    [1, 60],
    [2, 40],
  ],
  2: [
    [1, 15],
    [2, 74],
    [3, 11],
  ],
  3: [
    [2, 60],
    [3, 40],
  ],
};

/** commands column height per difficulty. Aggregate ≈ 3% / 9% / 88%. */
export const COMMAND_FIGURE_COUNT_WEIGHTS: Record<Difficulty, WeightedTable<CommandFigureCount>> = {
  1: [
    [4, 85],
    [3, 12],
    [2, 3],
  ],
  2: [
    [4, 90],
    [3, 8],
    [2, 2],
  ],
  3: [
    [4, 93],
    [3, 6],
    [2, 1],
  ],
};

/**
 * Probability that a column carries `figureCount + 1` commands, one of them the
 * appended global reorder. Aggregate = 80% (research: figures+1 is typical).
 */
export const COMMAND_COUNT_WEIGHTS: Record<Difficulty, readonly [boolean, number][]> = {
  1: [
    [true, 72],
    [false, 28],
  ],
  2: [
    [true, 80],
    [false, 20],
  ],
  3: [
    [true, 88],
    [false, 12],
  ],
};

/** cipher single/multi composition per difficulty. Aggregate = 65 / 35. */
export const CIPHER_COMPOSITION_WEIGHTS: Record<Difficulty, WeightedTable<CipherComposition>> = {
  1: [
    ['single', 85],
    ['multi', 15],
  ],
  2: [
    ['single', 65],
    ['multi', 35],
  ],
  3: [
    ['single', 45],
    ['multi', 55],
  ],
};

/** arithmetic decimal-template usage per difficulty. Aggregate ≈ 13%. */
export const ARITHMETIC_DECIMAL_WEIGHTS: Record<Difficulty, WeightedTable<ArithmeticFlavor>> = {
  1: [['integer', 100]],
  2: [
    ['decimal', 25],
    ['integer', 75],
  ],
  3: [
    ['decimal', 15],
    ['integer', 85],
  ],
};

/**
 * Resolve a problem's difficulty, ALWAYS consuming one `rng.pick` draw even
 * when an explicit difficulty is supplied. This keeps the downstream RNG
 * stream identical for `generateProblem(s, seed)` and
 * `generateProblem(s, seed, d)`, so a recorded `(seed, difficulty)` always
 * regenerates the exact same problem (required by mistake review).
 */
export function resolveDifficulty(rng: Rng, explicit: Difficulty | undefined): Difficulty {
  const rolled = rng.pick(DIFFICULTIES);
  return explicit ?? rolled;
}

export function samplePatternRuleCount(rng: Rng, difficulty: Difficulty): RuleCount {
  return pickWeighted(rng, PATTERN_RULE_COUNT_WEIGHTS[difficulty]);
}

export function sampleCommandFigureCount(rng: Rng, difficulty: Difficulty): CommandFigureCount {
  return pickWeighted(rng, COMMAND_FIGURE_COUNT_WEIGHTS[difficulty]);
}

/** Commands are `figureCount + 1` (reorder appended) or `figureCount`, never fewer than 2. */
export function sampleCommandCount(rng: Rng, difficulty: Difficulty, figureCount: number): number {
  const overflow = pickWeighted(rng, COMMAND_COUNT_WEIGHTS[difficulty]);
  return Math.max(2, overflow ? figureCount + 1 : figureCount);
}

export function sampleCipherComposition(rng: Rng, difficulty: Difficulty): CipherComposition {
  return pickWeighted(rng, CIPHER_COMPOSITION_WEIGHTS[difficulty]);
}

export function sampleArithmeticDecimal(rng: Rng, difficulty: Difficulty): boolean {
  return pickWeighted(rng, ARITHMETIC_DECIMAL_WEIGHTS[difficulty]) === 'decimal';
}

export interface ExpectedShares {
  patternRuleCount: Record<RuleCount, number>;
  commandFigureCount: Record<CommandFigureCount, number>;
  /** Share of columns with a global reorder command appended (figureCount+1). */
  commandOverflow: number;
  cipherComposition: Record<CipherComposition, number>;
  arithmeticDecimal: number;
}

/** Research targets. Tests compare sampled/aggregated shares against these. */
export const EXPECTED_SHARES: ExpectedShares = {
  patternRuleCount: { 1: 0.25, 2: 0.58, 3: 0.17 },
  commandFigureCount: { 2: 0.02, 3: 0.08667, 4: 0.89333 },
  commandOverflow: 0.8,
  cipherComposition: { single: 0.65, multi: 0.35 },
  arithmeticDecimal: 0.13,
};

export function expectedShares(): ExpectedShares {
  return EXPECTED_SHARES;
}

/**
 * Average a weight table across the three difficulties (uniform difficulty).
 * Used by tests to prove the tables actually aggregate to the targets.
 */
export function aggregateTable<T>(tables: readonly WeightedTable<T>[]): Map<T, number> {
  const sums = new Map<T, number>();
  for (const table of tables) {
    const total = table.reduce((sum, [, weight]) => sum + weight, 0);
    for (const [value, weight] of table) {
      sums.set(value, (sums.get(value) ?? 0) + weight / total);
    }
  }
  const averaged = new Map<T, number>();
  for (const [value, share] of sums) averaged.set(value, share / tables.length);
  return averaged;
}
