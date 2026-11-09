import { describe, expect, it } from 'vitest';
import { applyPrimitives, figureKey, visualKey } from '../src/domain/figure';
import { validateProblem } from '../src/domain/invariants';
import { CMD_LABEL } from '../src/domain/recipe';
import type { CmdName } from '../src/domain/recipe';
import { DIFFICULTIES } from '../src/domain/types';
import type { Difficulty, FigureProblem } from '../src/domain/types';
import { generateCommands } from '../src/generators/commands';
import { expectedShares } from '../src/generators/policy';

const SEEDS = 2000;
const REACHABILITY_PROBLEMS = 5000;
const DISTRIBUTION_DRAWS = 30_000;
const TIMEOUT_MS = 120_000;

const ALL_COMMANDS: readonly CmdName[] = [
  'FlipV',
  'FlipH',
  'Flip180',
  'DeletePrev',
  'DeleteNext',
  'SwapPrev',
  'CancelPrevCommand',
  'CancelNextCommand',
  'ReorderR',
  'ReorderS',
  'ReorderJ',
];

const LABEL_TO_COMMAND = new Map<string, CmdName>(
  ALL_COMMANDS.map((command): [string, CmdName] => [CMD_LABEL[command], command]),
);

const label = (seed: number, difficulty: number): string => `seed=${seed} difficulty=${difficulty}`;

const figureCountOf = (problem: FigureProblem): number => problem.start.objects.length;
const commandCountOf = (problem: FigureProblem): number => problem.commandLabels?.length ?? 0;

describe('generateCommands property checks', () => {
  it('produces invariant-clean problems for seeds 1..2000 at every difficulty', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      for (const difficulty of DIFFICULTIES) {
        const problem = generateCommands({ seed, difficulty });
        expect(validateProblem(problem), label(seed, difficulty)).toEqual([]);
      }
    }
  }, TIMEOUT_MS);

  it('is deterministic and reproduces from the recorded seed and difficulty', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const defaulted = generateCommands({ seed });
      for (const difficulty of DIFFICULTIES) {
        const first = generateCommands({ seed, difficulty });
        expect(first, label(seed, difficulty)).toEqual(generateCommands({ seed, difficulty }));
        expect(first.seed, label(seed, difficulty)).toBe(seed);
      }
      expect(defaulted.seed).toBe(seed);
      expect(defaulted).toEqual(generateCommands({ seed, difficulty: defaulted.difficulty }));
    }
  }, TIMEOUT_MS);

  it('has exactly 5 choices distinct by visualKey with the answer appearing once', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      for (const difficulty of DIFFICULTIES) {
        const problem = generateCommands({ seed, difficulty });
        const tag = label(seed, difficulty);
        expect(problem.choices, tag).toHaveLength(5);
        expect(new Set(problem.choices.map(visualKey)).size, tag).toBe(5);
        expect(problem.correctIndex >= 0 && problem.correctIndex < problem.choices.length, tag).toBe(true);
        const solved = figureKey(applyPrimitives(problem.start, problem.ops));
        expect(solved, tag).toBe(figureKey(problem.choices[problem.correctIndex]));
        expect(problem.choices.filter((choice) => figureKey(choice) === solved), tag).toHaveLength(1);
      }
    }
  }, TIMEOUT_MS);

  it('exposes a column of 2-4 figures with unique command slots and one global reorder', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      for (const difficulty of DIFFICULTIES) {
        const problem = generateCommands({ seed, difficulty });
        const tag = label(seed, difficulty);
        const figureCount = figureCountOf(problem);
        const plan = problem.commandPlan ?? [];
        expect(figureCount, tag).toBeGreaterThanOrEqual(2);
        expect(figureCount, tag).toBeLessThanOrEqual(4);
        expect(problem.commandLabels?.length ?? -1, tag).toBe(plan.length);
        for (const entry of plan) {
          expect(LABEL_TO_COMMAND.get(entry.label), tag).toBeDefined();
          if (entry.slot !== null) {
            expect(entry.slot >= 0 && entry.slot < figureCount, tag).toBe(true);
          }
        }
        const figureSlots = plan.map((entry) => entry.slot).filter((slot): slot is number => slot !== null);
        expect(new Set(figureSlots).size, tag).toBe(figureSlots.length);
        const globals = plan.filter((entry) => entry.slot === null).length;
        expect(globals, tag).toBeLessThanOrEqual(1);
        expect(plan.length, tag).toBeLessThanOrEqual(figureCount + 1);
        expect(commandCountOf(problem), tag).toBeGreaterThanOrEqual(1);
        const reordered = plan.filter((entry) => entry.slot === null).length;
        const figureCommands = plan.filter((entry) => entry.slot !== null).length;
        expect(reordered + figureCommands, tag).toBe(plan.length);
      }
    }
  }, TIMEOUT_MS);

  it('keeps ops, start and the answer consistent, with plan labels matchable', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      for (const difficulty of DIFFICULTIES) {
        const problem = generateCommands({ seed, difficulty });
        const tag = label(seed, difficulty);
        const labels = problem.commandLabels ?? [];
        const plan = problem.commandPlan ?? [];
        expect(labels, tag).toEqual(plan.map((entry) => entry.label));
        expect(labels.every((commandLabel) => LABEL_TO_COMMAND.has(commandLabel)), tag).toBe(true);
        const opsAreEmitted = problem.ops.every((op) => {
          switch (op.op) {
            case 'flipVAt':
            case 'flipHAt':
            case 'flip180At':
            case 'deleteAt':
            case 'swapWithPrevAt':
            case 'reorder':
              return true;
            default:
              return false;
          }
        });
        expect(opsAreEmitted, tag).toBe(true);
        expect(problem.fingerprint, tag).toBe(
          JSON.stringify([
            'commands',
            problem.difficulty,
            labels,
            problem.start,
            problem.ops,
            problem.choices.map(figureKey),
          ]),
        );
      }
    }
  }, TIMEOUT_MS);

  it('reaches all eleven commands over 5000 problems at every difficulty', () => {
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

  it('matches the expected figure-count and command-count shares (±4pp)', () => {
    const figures: Record<2 | 3 | 4, number> = { 2: 0, 3: 0, 4: 0 };
    let overflow = 0;
    for (let i = 0; i < DISTRIBUTION_DRAWS; i++) {
      const difficulty = DIFFICULTIES[i % DIFFICULTIES.length];
      const problem = generateCommands({ seed: i + 1, difficulty });
      const figureCount = figureCountOf(problem);
      if (figureCount === 2 || figureCount === 3 || figureCount === 4) figures[figureCount] += 1;
      if ((problem.commandPlan ?? []).some((entry) => entry.slot === null)) overflow += 1;
    }
    const expected = expectedShares();
    for (const count of [2, 3, 4] as const) {
      expect(Math.abs(figures[count] / DISTRIBUTION_DRAWS - expected.commandFigureCount[count])).toBeLessThan(
        0.04,
      );
    }
    expect(Math.abs(overflow / DISTRIBUTION_DRAWS - expected.commandOverflow)).toBeLessThan(0.04);
  }, TIMEOUT_MS);
});
