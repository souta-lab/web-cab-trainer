// Arithmetic generator: builds an ArithRecipe with exactly one unknown and
// derives BOTH the display and the answer from the frozen domain contract.
//
// Feasibility is constructed (never retried with a mutated seed): every
// template is always solvable by algebraic inversion, and divisions are placed
// so the unknown is never required to be a divisor of an inexact value.

import type { ArithmeticProblem, Difficulty, SkillTag } from '../domain/types';
import { Rng } from '../domain/rng';
import { fmtNum, render, round2, solve } from '../domain/recipe';
import type { ArithNode, ArithRecipe } from '../domain/recipe';
import { resolveDifficulty, sampleArithmeticDecimal } from './policy';

export interface ArithOpts {
  seed: number;
  difficulty?: Difficulty;
}

interface BuiltRecipe {
  root: ArithNode;
  unknownValue: number;
  tags: SkillTag[];
}

const UNKNOWN: ArithNode = { kind: 'unknown' };
const num = (value: number): ArithNode => ({ kind: 'num', value });
const bin = (op: '+' | '-' | '×' | '÷', left: ArithNode, right: ArithNode): ArithNode => ({
  kind: 'bin',
  op,
  left,
  right,
});
const group = (inner: ArithNode): ArithNode => ({ kind: 'group', inner });

const DECIMAL_MULTS: readonly number[] = [1.5, 2.5, 0.5, 1.2, 0.8, 1.25];
const HALF_MULTS: readonly number[] = [0.5, 0.25, 1.5, 0.5];
const QUARTER_MULTS: readonly number[] = [1.25, 0.75, 2.5, 0.5];
const DIV_DECIMALS: readonly number[] = [0.5, 0.25];

function assertNever(x: never): never {
  throw new Error(`unexpected value: ${String(x)}`);
}

/** Two-operation linear recipes: x always sits in a dividend / multiplicand slot. */
function buildLevel1(rng: Rng): BuiltRecipe {
  switch (rng.int(0, 2)) {
    case 0: {
      const a = rng.int(2, 9);
      const b = rng.int(1, 20);
      return { root: bin('+', bin('×', num(a), UNKNOWN), num(b)), unknownValue: rng.int(2, 12), tags: ['linear-basic'] };
    }
    case 1: {
      const a = rng.int(2, 9);
      const b = rng.int(1, 20);
      return { root: bin('-', bin('×', UNKNOWN, num(a)), num(b)), unknownValue: rng.int(2, 12), tags: ['linear-basic'] };
    }
    default: {
      const a = rng.int(2, 9);
      const b = rng.int(1, 15);
      return { root: bin('+', bin('÷', UNKNOWN, num(a)), num(b)), unknownValue: a * rng.int(2, 9), tags: ['linear-basic'] };
    }
  }
}

/** Three-operation recipes: parentheses appear and the decimal flavor enters. */
function buildLevel2(rng: Rng, decimal: boolean): BuiltRecipe {
  if (decimal) {
    switch (rng.int(0, 1)) {
      case 0: {
        const m = rng.pick(DECIMAL_MULTS);
        const b = rng.int(1, 10);
        return { root: bin('+', bin('×', UNKNOWN, num(m)), num(b)), unknownValue: rng.int(2, 20), tags: ['decimal'] };
      }
      default: {
        const a = rng.int(1, 9);
        const m = rng.pick(HALF_MULTS);
        return { root: bin('×', group(bin('+', UNKNOWN, num(a))), num(m)), unknownValue: rng.int(2, 20), tags: ['decimal', 'linear-parens'] };
      }
    }
  }
  switch (rng.int(0, 2)) {
    case 0: {
      const a = rng.int(1, 9);
      const b = rng.int(2, 6);
      const c = rng.int(1, 15);
      return { root: bin('-', bin('×', group(bin('+', UNKNOWN, num(a))), num(b)), num(c)), unknownValue: rng.int(2, 12), tags: ['linear-parens'] };
    }
    case 1: {
      const a = rng.int(2, 6);
      const b = rng.int(5, 25);
      const c = rng.int(1, 15);
      return { root: bin('+', bin('-', bin('×', UNKNOWN, num(a)), num(b)), num(c)), unknownValue: rng.int(2, 12), tags: ['linear-basic'] };
    }
    default: {
      const a = rng.int(2, 6);
      const b = rng.int(2, 5);
      return { root: bin('×', bin('÷', UNKNOWN, num(a)), num(b)), unknownValue: a * rng.int(2, 8), tags: ['fraction'] };
    }
  }
}

/** Longer chains with nested groups; denominators are chosen so results stay clean. */
function buildLevel3(rng: Rng, decimal: boolean): BuiltRecipe {
  if (decimal) {
    switch (rng.int(0, 1)) {
      case 0: {
        const a = rng.int(1, 9);
        const m = rng.pick(QUARTER_MULTS);
        const b = rng.int(1, 12);
        return { root: bin('-', bin('×', group(bin('+', UNKNOWN, num(a))), num(m)), num(b)), unknownValue: rng.int(2, 20), tags: ['decimal', 'linear-parens'] };
      }
      default: {
        const d = rng.pick(DIV_DECIMALS);
        const a = rng.int(1, 12);
        return { root: bin('+', bin('÷', UNKNOWN, num(d)), num(a)), unknownValue: rng.int(2, 20), tags: ['decimal', 'fraction'] };
      }
    }
  }
  switch (rng.int(0, 2)) {
    case 0: {
      // ((? − a) × b − c0·d) ÷ d = k·b − c0 : both divisions are exact by construction.
      const d = rng.int(2, 6);
      const k = rng.int(2, 10);
      const a = rng.int(1, 9);
      const b = rng.int(2, 5);
      const c0 = rng.int(1, 9);
      const root = bin('÷', bin('-', bin('×', group(bin('-', UNKNOWN, num(a))), num(b)), num(c0 * d)), num(d));
      return { root, unknownValue: a + d * k, tags: ['linear-parens'] };
    }
    case 1: {
      const a = rng.int(2, 9);
      const b = rng.int(2, 9);
      const c = rng.int(2, 9);
      return { root: bin('+', bin('×', num(a), UNKNOWN), bin('×', num(b), num(c))), unknownValue: rng.int(3, 15), tags: ['linear-basic'] };
    }
    default: {
      const a = rng.int(2, 6);
      const x = rng.int(3, 15);
      const b = rng.int(1, x - 1);
      const c = rng.int(1, 15);
      return { root: bin('+', bin('×', num(a), group(bin('-', UNKNOWN, num(b)))), num(c)), unknownValue: x, tags: ['linear-parens'] };
    }
  }
}

function buildRecipe(rng: Rng, difficulty: Difficulty, decimal: boolean): BuiltRecipe {
  switch (difficulty) {
    case 1:
      return buildLevel1(rng);
    case 2:
      return buildLevel2(rng, decimal);
    case 3:
      return buildLevel3(rng, decimal);
    default:
      return assertNever(difficulty);
  }
}

/**
 * Four finite, distinct distractors around `answer`, then shuffled. The answer
 * is inserted exactly once; `correctIndex` is read back after the shuffle.
 */
function buildChoices(rng: Rng, answer: number): number[] {
  const pool: number[] = [
    answer + 1, answer - 1, answer + 2, answer - 2, answer + 5, answer - 5,
    answer + 10, answer - 10, -answer, round2(answer / 2), round2(answer * 2),
  ];
  const seen = new Set<number>([answer]);
  const distractors: number[] = [];
  for (const candidate of rng.shuffle(pool)) {
    if (distractors.length === 4) break;
    if (!Number.isFinite(candidate) || seen.has(candidate) || Math.abs(candidate) > 10000) continue;
    seen.add(candidate);
    distractors.push(candidate);
  }
  for (let step = 3; distractors.length < 4; step++) {
    for (const candidate of [answer + step, answer - step]) {
      if (distractors.length === 4) break;
      if (!Number.isFinite(candidate) || seen.has(candidate) || Math.abs(candidate) > 10000) continue;
      seen.add(candidate);
      distractors.push(candidate);
    }
  }
  return rng.shuffle([answer, ...distractors]);
}

export function generateArithmetic(opts: ArithOpts): ArithmeticProblem {
  const rng = new Rng(opts.seed);
  const difficulty = resolveDifficulty(rng, opts.difficulty);
  const decimal = sampleArithmeticDecimal(rng, difficulty);
  const built = buildRecipe(rng, difficulty, decimal);
  const recipe: ArithRecipe = { root: built.root, unknownValue: built.unknownValue };
  const display = render(recipe);
  const answer = solve(recipe);
  const choices = buildChoices(rng, answer);
  return {
    seed: opts.seed,
    subject: 'arithmetic',
    difficulty,
    skillTags: built.tags,
    explanation: `逆算して ? を求める。式 ${display} の左辺を逆にたどると ? = ${fmtNum(answer)}。`,
    fingerprint: JSON.stringify(['arithmetic', difficulty, recipe, choices]),
    display,
    recipe,
    answer,
    choices,
    correctIndex: choices.indexOf(answer),
  };
}
