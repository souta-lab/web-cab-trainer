import { describe, expect, it } from 'vitest';
import { applyPrimitives, figureKey } from '../src/domain/figure';
import { validateProblem } from '../src/domain/invariants';
import { CMD_LABEL } from '../src/domain/recipe';
import type { CmdName } from '../src/domain/recipe';
import { DIFFICULTIES } from '../src/domain/types';
import type { Difficulty, FigureProblem } from '../src/domain/types';
import { generateCommands } from '../src/generators/commands';
import { expectedShares } from '../src/generators/policy';
import type { CommandLengthBucket } from '../src/generators/policy';

const SEEDS = 2000;
const REACHABILITY_PROBLEMS = 5000;
const DISTRIBUTION_DRAWS = 50_000;
const TIMEOUT_MS = 120_000;

const ALL_COMMANDS: readonly CmdName[] = [
  'Rotate90',
  'Rotate180',
  'FlipH',
  'FlipV',
  'ToggleFill',
  'SwapPos',
  'MoveMarker',
  'AddDot',
  'RemoveDot',
];

const label = (seed: number, difficulty: number): string => `seed=${seed} difficulty=${difficulty}`;

function bucketOf(problem: FigureProblem): CommandLengthBucket {
  const count = problem.commandLabels?.length ?? problem.ops.length;
  if (count <= 2) return '1-2';
  if (count <= 4) return '3-4';
  return '5+';
}

describe('generateCommands property checks', () => {
  it('produces invariant-clean problems for seeds 1..2000 at every difficulty', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      for (const difficulty of DIFFICULTIES) {
        const problem = generateCommands({ seed, difficulty });
        expect(validateProblem(problem), label(seed, difficulty)).toEqual([]);
      }
    }
  }, TIMEOUT_MS);

  it('is deterministic: same seed and difficulty regenerate a deep-equal problem', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      for (const difficulty of DIFFICULTIES) {
        const first = generateCommands({ seed, difficulty });
        const second = generateCommands({ seed, difficulty });
        expect(second, label(seed, difficulty)).toEqual(first);
      }
    }
  }, TIMEOUT_MS);

  it('records the requested seed unchanged, including the default-difficulty path', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      expect(generateCommands({ seed }).seed).toBe(seed);
      for (const difficulty of DIFFICULTIES) {
        expect(generateCommands({ seed, difficulty }).seed).toBe(seed);
      }
    }
  }, TIMEOUT_MS);

  it('has exactly 5 choices pairwise distinct by figureKey', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      for (const difficulty of DIFFICULTIES) {
        const problem = generateCommands({ seed, difficulty });
        const tag = label(seed, difficulty);
        expect(problem.choices, tag).toHaveLength(5);
        expect(new Set(problem.choices.map(figureKey)).size, tag).toBe(5);
      }
    }
  }, TIMEOUT_MS);

  it('links start/ops, correctIndex and the answer exactly once', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      for (const difficulty of DIFFICULTIES) {
        const problem = generateCommands({ seed, difficulty });
        const tag = label(seed, difficulty);
        expect(problem.prompt, tag).toBe('命令列を適用した最終図形を選べ');
        expect(problem.correctIndex >= 0 && problem.correctIndex < problem.choices.length, tag).toBe(
          true,
        );
        const solved = figureKey(applyPrimitives(problem.start, problem.ops));
        expect(solved, tag).toBe(figureKey(problem.choices[problem.correctIndex]));
        expect(problem.choices.filter((choice) => figureKey(choice) === solved), tag).toHaveLength(1);
      }
    }
  }, TIMEOUT_MS);

  it('exposes one label per command and a fingerprint over the content tuple', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      for (const difficulty of DIFFICULTIES) {
        const problem = generateCommands({ seed, difficulty });
        const tag = label(seed, difficulty);
        const labels = problem.commandLabels ?? [];
        expect(labels.length, tag).toBe(problem.ops.length);
        const knownLabels = new Set(Object.values(CMD_LABEL));
        expect(labels.every((commandLabel) => knownLabels.has(commandLabel)), tag).toBe(true);
        expect(problem.fingerprint, tag).toBe(
          JSON.stringify(['commands', problem.difficulty, problem.start, problem.ops, problem.choices]),
        );
      }
    }
  }, TIMEOUT_MS);

  it('reaches all nine commands (including AddDot/RemoveDot) over 5000 problems', () => {
    const seen = new Set<string>();
    const perDifficulty = new Map<Difficulty, Set<string>>();
    for (const difficulty of DIFFICULTIES) perDifficulty.set(difficulty, new Set());

    let generated = 0;
    for (let seed = 1; seed <= REACHABILITY_PROBLEMS; seed++) {
      for (const difficulty of DIFFICULTIES) {
        const problem = generateCommands({ seed, difficulty });
        const bucket = perDifficulty.get(difficulty);
        if (bucket === undefined) throw new Error(`unreachable difficulty: ${difficulty}`);
        for (const commandLabel of problem.commandLabels ?? []) {
          seen.add(commandLabel);
          bucket.add(commandLabel);
        }
        generated += 1;
      }
    }

    expect(generated).toBe(REACHABILITY_PROBLEMS * DIFFICULTIES.length);
    expect(seen.size).toBe(ALL_COMMANDS.length);
    for (const command of ALL_COMMANDS) {
      expect(seen.has(CMD_LABEL[command]), `command=${command}`).toBe(true);
      for (const difficulty of DIFFICULTIES) {
        expect(
          perDifficulty.get(difficulty)?.has(CMD_LABEL[command]),
          `difficulty=${difficulty} command=${command}`,
        ).toBe(true);
      }
    }
  }, TIMEOUT_MS);

  it('matches expected command-length shares over 50k uniform-difficulty draws (±3pp)', () => {
    const counts: Record<CommandLengthBucket, number> = { '1-2': 0, '3-4': 0, '5+': 0 };
    for (let i = 0; i < DISTRIBUTION_DRAWS; i++) {
      const difficulty = DIFFICULTIES[i % DIFFICULTIES.length];
      counts[bucketOf(generateCommands({ seed: i + 1, difficulty }))] += 1;
    }
    const expected = expectedShares().commandLength;
    const buckets: readonly CommandLengthBucket[] = ['1-2', '3-4', '5+'];
    for (const bucket of buckets) {
      const observed = counts[bucket] / DISTRIBUTION_DRAWS;
      expect(Math.abs(observed - expected[bucket]), `bucket=${bucket}`).toBeLessThanOrEqual(0.03);
    }
  }, TIMEOUT_MS);
});
