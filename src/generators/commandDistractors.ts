// Distractors for 命令表: each wrong choice replays a MUTATED command plan on
// the real start column, so every distractor is a plan-level error the solver
// can make (researched error patterns), never a cosmetic perturbation.
//
// Mutations: double-blank (delete twice), unapplied-flip, wrong-permutation,
// post-cancel-flip (cancel ignored), wrong-neighbour (delete direction), and
// axis-swap (V↔H). Infeasible mutations return `null`; `pickDistractors`
// backstops the rare plan with fewer than four distinct replays.

import type { FigState } from '../domain/types';
import { figureKey, visualKey } from '../domain/figure';
import type { Rng } from '../domain/rng';
import type { CommandStep } from './commandPlan';
import { executeCommandPlan, resolveCommandPlan } from './commandPlan';
import { pickDistractors } from './distractors';

export interface PlanMutation {
  readonly kind: string;
  readonly mutate: (steps: readonly CommandStep[]) => readonly CommandStep[] | null;
}

type Cmd = CommandStep['command'];

const REORDER_VARIANTS: Record<string, readonly Cmd[]> = {
  ReorderR: ['ReorderS', 'ReorderJ'],
  ReorderS: ['ReorderR', 'ReorderJ'],
  ReorderJ: ['ReorderR', 'ReorderS'],
};

function isFlip(command: Cmd): boolean {
  return command === 'FlipV' || command === 'FlipH' || command === 'Flip180';
}

function isCancel(command: Cmd): boolean {
  return command === 'CancelPrevCommand' || command === 'CancelNextCommand';
}

function isDelete(command: Cmd): boolean {
  return command === 'DeletePrev' || command === 'DeleteNext';
}

function isReorder(command: Cmd): boolean {
  return command === 'ReorderR' || command === 'ReorderS' || command === 'ReorderJ';
}

function withCommand(step: CommandStep, command: Cmd): CommandStep {
  return { ...step, command };
}

function indexOfCommand(steps: readonly CommandStep[], predicate: (command: Cmd) => boolean): number {
  return steps.findIndex((step) => predicate(step.command));
}

function replaceAt(
  steps: readonly CommandStep[],
  index: number,
  command: Cmd,
): readonly CommandStep[] | null {
  const step = steps[index];
  if (step === undefined) return null;
  return steps.map((candidate, i) => (i === index ? withCommand(candidate, command) : candidate));
}

export const PLAN_MUTATIONS: readonly PlanMutation[] = [
  {
    kind: 'double-blank',
    mutate: (steps) => {
      const index = indexOfCommand(steps, isDelete);
      if (index < 0) return null;
      const step = steps[index];
      if (step === undefined) return null;
      const next = steps[index + 1];
      if (next === undefined) return null;
      const duplicate: CommandStep = { ...next, command: step.command };
      return steps.map((candidate, i) => (i === index + 1 ? duplicate : candidate));
    },
  },
  {
    kind: 'unapplied-flip',
    mutate: (steps) => {
      const index = indexOfCommand(steps, isFlip);
      if (index < 0) return null;
      const filtered = steps.filter((_, i) => i !== index);
      return filtered.length > 0 ? filtered : null;
    },
  },
  {
    kind: 'wrong-permutation',
    mutate: (steps) => {
      const index = indexOfCommand(steps, isReorder);
      if (index < 0) return null;
      const step = steps[index];
      if (step === undefined) return null;
      const replacement = REORDER_VARIANTS[step.command]?.[0];
      if (replacement === undefined) return null;
      return replaceAt(steps, index, replacement);
    },
  },
  {
    kind: 'post-cancel-flip',
    mutate: (steps) => {
      const cancelIndex = indexOfCommand(steps, isCancel);
      if (cancelIndex < 0) return null;
      const cancelledFlip = resolveCommandPlan(steps).cancelled.some((index) => {
        const step = steps[index];
        return step !== undefined && isFlip(step.command);
      });
      return replaceAt(steps, cancelIndex, cancelledFlip ? 'Flip180' : 'SwapPrev');
    },
  },
  {
    kind: 'wrong-neighbour',
    mutate: (steps) => {
      const prevIndex = indexOfCommand(steps, (command) => command === 'DeletePrev');
      if (prevIndex >= 0) return replaceAt(steps, prevIndex, 'DeleteNext');
      const nextIndex = indexOfCommand(steps, (command) => command === 'DeleteNext');
      if (nextIndex >= 0) return replaceAt(steps, nextIndex, 'DeletePrev');
      return null;
    },
  },
  {
    kind: 'axis-swap',
    mutate: (steps) => {
      const vIndex = indexOfCommand(steps, (command) => command === 'FlipV');
      if (vIndex >= 0) return replaceAt(steps, vIndex, 'FlipH');
      const hIndex = indexOfCommand(steps, (command) => command === 'FlipH');
      if (hIndex >= 0) return replaceAt(steps, hIndex, 'FlipV');
      return null;
    },
  },
];

function replay(state: FigState, steps: readonly CommandStep[]): FigState {
  return executeCommandPlan(state, resolveCommandPlan(steps).active);
}

/**
 * Replay distinct mutated plans on `state`, deduped by `visualKey` against the
 * answer and each other; `pickDistractors` supplies look-distinct fallbacks.
 */
export function mutatedDistractors(
  rng: Rng,
  state: FigState,
  answer: FigState,
  steps: readonly CommandStep[],
): FigState[] {
  const seen = new Set<string>([visualKey(answer)]);
  const candidates: FigState[] = [];
  for (const mutation of rng.shuffle(PLAN_MUTATIONS)) {
    const mutated = mutation.mutate(steps);
    if (mutated === null) continue;
    const candidate = replay(state, mutated);
    if (figureKey(candidate) === figureKey(answer)) continue;
    const key = visualKey(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(candidate);
  }
  return pickDistractors(rng, answer, candidates);
}
