// 命令表 generator: a vertical column of 2-4 figures, each carrying one
// command, plus an optional global reorder command at the end. Commands execute
// top-to-bottom; the answer is the column after the surviving commands run.
//
// Cancels are resolved first (`resolveCommandPlan`), then the surviving plan is
// simulated on a live array (`simulatePlan`) so every emitted primitive carries
// the index valid at that moment. Distractors replay mutated plans on the real
// start, so each wrong choice is a plan-level error a solver can actually make.
// Weights live in `policy.ts` (`COMMAND_FIGURE_COUNT_WEIGHTS`,
// `COMMAND_COUNT_WEIGHTS`) — the single source of truth for the distribution.

import type { CmdName } from '../domain/recipe';
import { CMD_LABEL, REORDER_CMDS } from '../domain/recipe';
import type { Difficulty, FigObj, FigureProblem, FigState, Rot, ShapeKind, SkillTag } from '../domain/types';
import { Rng } from '../domain/rng';
import { figureKey } from '../domain/figure';
import { pickWeighted } from '../domain/rng';
import {
  commandPlanEntries,
  executeCommandPlan,
  executePlan,
  resolveCommandPlan,
} from './commandPlan';
import type { CommandStep } from './commandPlan';
import { mutatedDistractors } from './commandDistractors';
import { resolveDifficulty, sampleCommandCount, sampleCommandFigureCount } from './policy';

export interface CommandsOpts {
  seed: number;
  difficulty?: Difficulty;
}

const PROMPT = '命令列を適用した最終図形を選べ';
const COLUMN_X = 60;
const COLUMN_Y = 18;
const ROW_STEP = 26;
const FIGURE_SIZE = 22;
/** Asymmetric shapes dominate so flips are visible; squares are the rare case. */
const BASE_SHAPE_WEIGHTS: readonly (readonly [ShapeKind, number])[] = [
  ['arrow', 50],
  ['triangle', 35],
  ['square', 15],
];
const SLOT_ROTS: readonly Rot[] = [0, 90, 180, 270];
const BASE_COMMANDS: readonly CmdName[] = [
  'FlipV',
  'FlipH',
  'Flip180',
  'DeletePrev',
  'DeleteNext',
  'SwapPrev',
  'CancelPrevCommand',
  'CancelNextCommand',
];

function assertNever(x: never): never {
  throw new Error(`unexpected value: ${String(x)}`);
}

function commandTags(steps: readonly CommandStep[]): SkillTag[] {
  const tags = new Set<SkillTag>();
  for (const step of steps) {
    switch (step.command) {
      case 'FlipV':
      case 'FlipH':
      case 'Flip180':
        tags.add('cmd-flip');
        break;
      case 'DeletePrev':
      case 'DeleteNext':
        tags.add('cmd-toggle');
        break;
      case 'SwapPrev':
        tags.add('cmd-move');
        break;
      case 'CancelPrevCommand':
      case 'CancelNextCommand':
        tags.add('cmd-cancel');
        break;
      case 'ReorderR':
      case 'ReorderS':
      case 'ReorderJ':
        tags.add('cmd-move');
        break;
      default:
        return assertNever(step.command);
    }
  }
  if (steps.length >= 3) tags.add('composite-2');
  if (steps.length >= 5) tags.add('composite-3');
  return [...tags];
}

/**
 * Column of distinct-shape figures at fixed slots. Fill and rotation vary per
 * slot so every figure renders differently, which keeps the choices readable.
 */
function buildStart(rng: Rng, figureCount: number): FigState {
  const fillPattern = rng.shuffle([true, false, true, false]).slice(0, figureCount);
  const shape = pickWeighted(rng, BASE_SHAPE_WEIGHTS);
  const rotations = rng.shuffle(SLOT_ROTS).slice(0, figureCount);
  const objects: FigObj[] = [];
  for (let i = 0; i < figureCount; i++) {
    objects.push({
      shape,
      x: COLUMN_X,
      y: COLUMN_Y + i * ROW_STEP,
      rot: rotations[i] ?? 0,
      fill: fillPattern[i] ?? false,
      size: FIGURE_SIZE,
      flipH: false,
    });
  }
  return { objects, markerPos: 0 };
}

function commandPoolAt(slot: number, figureCount: number): readonly CmdName[] {
  return BASE_COMMANDS.filter((command) => {
    switch (command) {
      case 'DeletePrev':
      case 'CancelPrevCommand':
        return slot > 0;
      case 'DeleteNext':
      case 'CancelNextCommand':
        return slot + 1 < figureCount;
      default:
        return true;
    }
  });
}

function samplePlan(rng: Rng, commandCount: number, figureCount: number): readonly CommandStep[] {
  const steps: CommandStep[] = [];
  for (let slot = 0; slot < figureCount; slot++) {
    steps.push({
      command: rng.pick(commandPoolAt(slot, figureCount)),
      plannedIndex: slot,
      figureSlot: slot,
    });
  }
  if (commandCount > figureCount) {
    steps.push({ command: rng.pick(REORDER_CMDS), plannedIndex: 0, figureSlot: null });
  }
  return steps;
}

/** A column of flips/deletes/swaps that all cancel out is a zero-information item. */
function hasVisibleCommand(steps: readonly CommandStep[]): boolean {
  return resolveCommandPlan(steps).active.some(
    (step) => step.command !== 'ReorderR' && step.command !== 'ReorderS' && step.command !== 'ReorderJ',
  );
}

/** Resample deterministically until at least one non-reorder command survives. */
function buildPlan(rng: Rng, commandCount: number, figureCount: number): readonly CommandStep[] {
  let steps = samplePlan(rng, commandCount, figureCount);
  for (let attempt = 0; attempt < 4 && !hasVisibleCommand(steps); attempt++) {
    steps = samplePlan(rng, commandCount, figureCount);
  }
  return steps;
}

function describeSteps(active: readonly CommandStep[], cancelled: readonly number[]): string {
  const sequence = active.map((step) => CMD_LABEL[step.command]).join(' → ');
  const cancelledNote =
    cancelled.length > 0
      ? `「${CMD_LABEL.CancelPrevCommand}」「${CMD_LABEL.CancelNextCommand}」で打ち消された命令は実行しない。`
      : '打ち消された命令は無い。';
  return `各図形の命令を上から順に適用する: ${sequence}。${cancelledNote}図形を消す命令では、下の図形が上へ詰まる。`;
}

export function generateCommands(opts: CommandsOpts): FigureProblem {
  const rng = new Rng(opts.seed);
  const difficulty = resolveDifficulty(rng, opts.difficulty);
  const figureCount = sampleCommandFigureCount(rng, difficulty);
  const commandCount = sampleCommandCount(rng, difficulty, figureCount);
  const start = buildStart(rng, figureCount);
  const steps = buildPlan(rng, commandCount, figureCount);
  const resolved = resolveCommandPlan(steps);
  const execution = executePlan(start.objects, resolved.active);
  const answer = executeCommandPlan(start, resolved.active);
  const answerKey = figureKey(answer);
  const distractors = mutatedDistractors(rng, start, answer, steps);
  const choices = rng.shuffle([answer, ...distractors]);
  const commandLabels = resolved.active.map((step) => CMD_LABEL[step.command]);

  return {
    seed: opts.seed,
    subject: 'commands',
    difficulty,
    skillTags: commandTags(resolved.active),
    explanation: describeSteps(resolved.active, resolved.cancelled),
    fingerprint: JSON.stringify([
      'commands',
      difficulty,
      commandLabels,
      start,
      execution.ops,
      choices.map(figureKey),
    ]),
    prompt: PROMPT,
    start,
    ops: execution.ops,
    choices,
    correctIndex: choices.findIndex((choice) => figureKey(choice) === answerKey),
    commandLabels,
    commandPlan: commandPlanEntries(resolved.active),
  };
}
