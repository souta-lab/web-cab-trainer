import { describe, expect, it } from 'vitest';
import { applyPrimitives, figureKey } from '../src/domain/figure';
import { validateProblem } from '../src/domain/invariants';
import type { CipherRule } from '../src/domain/recipe';
import { DIFFICULTIES } from '../src/domain/types';
import type { Difficulty, FigureProblem, Primitive } from '../src/domain/types';
import { generateCipher } from '../src/generators/cipher';
import { expectedShares } from '../src/generators/policy';
import type { CipherComposition } from '../src/generators/policy';

const SEEDS = 2000;
const REACHABILITY_PROBLEMS = 5000;
const DISTRIBUTION_DRAWS = 50_000;
const TIMEOUT_MS = 120_000;

type CipherRuleType = CipherRule['type'];

const ALL_RULE_TYPES: readonly CipherRuleType[] = [
  'rotation',
  'fill',
  'flip',
  'inside-outside',
  'move',
  'add-dot',
];

const label = (seed: number, difficulty: number): string => `seed=${seed} difficulty=${difficulty}`;

/** Inverse of `expandCipherRule`: one primitive back to its rule type. */
function ruleTypeOf(op: Primitive): CipherRuleType | undefined {
  switch (op.op) {
    case 'rotate':
      return 'rotation';
    case 'toggleFill':
      return 'fill';
    case 'flipH':
    case 'flipV':
      return 'flip';
    case 'swapObjects':
      return 'inside-outside';
    case 'moveMarker':
      return 'move';
    case 'addDot':
      return 'add-dot';
    default:
      return undefined;
  }
}

function compositionOf(problem: FigureProblem): CipherComposition {
  return problem.ops.length === 1 ? 'single' : 'multi';
}

describe('generateCipher property checks', () => {
  it('produces invariant-clean problems for seeds 1..2000 at every difficulty', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      for (const difficulty of DIFFICULTIES) {
        const problem = generateCipher({ seed, difficulty });
        expect(validateProblem(problem), label(seed, difficulty)).toEqual([]);
      }
    }
  }, TIMEOUT_MS);

  it('is deterministic: same seed and difficulty regenerate a deep-equal problem', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      for (const difficulty of DIFFICULTIES) {
        const first = generateCipher({ seed, difficulty });
        const second = generateCipher({ seed, difficulty });
        expect(second, label(seed, difficulty)).toEqual(first);
      }
    }
  }, TIMEOUT_MS);

  it('records the requested seed unchanged, including the default-difficulty path', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      expect(generateCipher({ seed }).seed).toBe(seed);
      for (const difficulty of DIFFICULTIES) {
        expect(generateCipher({ seed, difficulty }).seed).toBe(seed);
      }
    }
  }, TIMEOUT_MS);

  it('has exactly 5 choices pairwise distinct by figureKey', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      for (const difficulty of DIFFICULTIES) {
        const problem = generateCipher({ seed, difficulty });
        const tag = label(seed, difficulty);
        expect(problem.choices, tag).toHaveLength(5);
        expect(new Set(problem.choices.map(figureKey)).size, tag).toBe(5);
      }
    }
  }, TIMEOUT_MS);

  it('links example, start/ops and the correct choice through applyPrimitives', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      for (const difficulty of DIFFICULTIES) {
        const problem = generateCipher({ seed, difficulty });
        const tag = label(seed, difficulty);
        expect(problem.prompt, tag).toBe('例と同じ変換を入力Bに適用した図形を選べ');
        expect(problem.correctIndex >= 0 && problem.correctIndex < problem.choices.length, tag).toBe(
          true,
        );

        const examples = problem.examples ?? [];
        expect(examples, tag).toHaveLength(1);
        const example = examples[0];
        if (example === undefined) throw new Error(`missing example: ${tag}`);

        // Input B differs from Input A, and applying ops to A yields the shown output.
        expect(figureKey(problem.start) === figureKey(example.input), tag).toBe(false);
        expect(figureKey(applyPrimitives(example.input, problem.ops)), tag).toBe(
          figureKey(example.output),
        );
        expect(figureKey(example.input) === figureKey(example.output), tag).toBe(false);

        // Answer of input B, and it must differ from B itself.
        const solved = figureKey(applyPrimitives(problem.start, problem.ops));
        expect(solved === figureKey(problem.start), tag).toBe(false);
        expect(solved, tag).toBe(figureKey(problem.choices[problem.correctIndex]));
        expect(problem.choices.filter((choice) => figureKey(choice) === solved), tag).toHaveLength(1);
      }
    }
  }, TIMEOUT_MS);

  it('expresses every op as a known rule type and fingerprints its content', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      for (const difficulty of DIFFICULTIES) {
        const problem = generateCipher({ seed, difficulty });
        const tag = label(seed, difficulty);
        const unknown = problem.ops.filter((op) => ruleTypeOf(op) === undefined);
        expect(unknown, tag).toEqual([]);
        expect(problem.fingerprint, tag).toBe(
          JSON.stringify(['cipher', problem.difficulty, problem.start, problem.ops, problem.choices]),
        );
      }
    }
  }, TIMEOUT_MS);

  it('reaches all six rule types (including add-dot) over 5000 problems', () => {
    const seen = new Set<CipherRuleType>();
    const perDifficulty = new Map<Difficulty, Set<CipherRuleType>>();
    for (const difficulty of DIFFICULTIES) perDifficulty.set(difficulty, new Set());

    let generated = 0;
    for (let seed = 1; seed <= REACHABILITY_PROBLEMS; seed++) {
      for (const difficulty of DIFFICULTIES) {
        const problem = generateCipher({ seed, difficulty });
        const bucket = perDifficulty.get(difficulty);
        if (bucket === undefined) throw new Error(`unreachable difficulty: ${difficulty}`);
        for (const op of problem.ops) {
          const type = ruleTypeOf(op);
          if (type === undefined) throw new Error(`unknown op: ${op.op}`);
          seen.add(type);
          bucket.add(type);
        }
        generated += 1;
      }
    }

    expect(generated).toBe(REACHABILITY_PROBLEMS * DIFFICULTIES.length);
    expect(seen.size).toBe(ALL_RULE_TYPES.length);
    for (const type of ALL_RULE_TYPES) {
      expect(seen.has(type), `ruleType=${type}`).toBe(true);
      for (const difficulty of DIFFICULTIES) {
        expect(
          perDifficulty.get(difficulty)?.has(type),
          `difficulty=${difficulty} ruleType=${type}`,
        ).toBe(true);
      }
    }
  }, TIMEOUT_MS);

  it('matches expected cipher composition shares over 50k uniform-difficulty draws (±3pp)', () => {
    const counts: Record<CipherComposition, number> = { single: 0, multi: 0 };
    for (let i = 0; i < DISTRIBUTION_DRAWS; i++) {
      const difficulty = DIFFICULTIES[i % DIFFICULTIES.length];
      counts[compositionOf(generateCipher({ seed: i + 1, difficulty }))] += 1;
    }
    const expected = expectedShares().cipherComposition;
    const compositions: readonly CipherComposition[] = ['single', 'multi'];
    for (const composition of compositions) {
      const observed = counts[composition] / DISTRIBUTION_DRAWS;
      expect(Math.abs(observed - expected[composition]), `composition=${composition}`).toBeLessThanOrEqual(
        0.03,
      );
    }
  }, TIMEOUT_MS);
});
