// 命令表 plan model: command steps carry their figure slot, cancels are
// resolved first (processing order: cancels → deletes → flips → swaps →
// reorder), then the surviving steps are executed against a live object array.
//
// Index emission: `plannedIndex` is the step's ORIGINAL figure slot. Deletes
// shrink the array, so `executePlan` tracks slot → current index and emits the
// index valid at that moment. This module is pure and total.

import type { CmdName, ReorderCmd } from '../domain/recipe';
import { CMD_LABEL, reorderOrder } from '../domain/recipe';
import type { FigObj, FigState, Primitive } from '../domain/types';
import { normalizeRot } from '../domain/figure';

export interface CommandStep {
  readonly command: CmdName;
  /** Figure slot the command acts on right now (global reorder steps use 0). */
  readonly plannedIndex: number;
  /** Figure this command is drawn under; `null` for the global reorder. */
  readonly figureSlot?: number | null;
}

export interface ResolvedCommandPlan {
  readonly active: readonly CommandStep[];
  /** Steps removed by a cancel; kept so the UI can explain them. */
  readonly cancelled: readonly number[];
}

function assertNever(x: never): never {
  throw new Error(`unexpected command: ${JSON.stringify(x)}`);
}

function cancelsPrevious(command: CmdName): boolean {
  return command === 'CancelPrevCommand';
}

function cancelsNext(command: CmdName): boolean {
  return command === 'CancelNextCommand';
}

function previousActiveIndex(index: number, cancelled: ReadonlySet<number>): number {
  for (let i = index - 1; i >= 0; i--) {
    if (!cancelled.has(i)) return i;
  }
  return -1;
}

/**
 * Resolve cancels to a fixed point. Each pass recomputes the whole cancelled
 * set from the previous pass, so cancelling a cancel RELEASES what that cancel
 * removed (classic 取り消し chaining) instead of leaving targets permanently
 * cancelled. Deterministic and terminating (at most `steps.length` passes).
 */
export function resolveCommandPlan(steps: readonly CommandStep[]): ResolvedCommandPlan {
  let cancelled = new Set<number>();
  let stable = false;
  for (let pass = 0; pass <= steps.length && !stable; pass++) {
    const next = new Set<number>();
    for (let i = 0; i < steps.length; i++) {
      if (cancelled.has(i)) continue;
      const step = steps[i];
      if (step === undefined) continue;
      if (cancelsPrevious(step.command)) {
        const target = previousActiveIndex(i, cancelled);
        if (target >= 0) next.add(target);
      } else if (cancelsNext(step.command) && i + 1 < steps.length) {
        next.add(i + 1);
      }
    }
    stable = next.size === cancelled.size && [...next].every((index) => cancelled.has(index));
    cancelled = next;
  }
  const active: CommandStep[] = [];
  const cancelledView: number[] = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step === undefined) continue;
    if (cancelled.has(i)) cancelledView.push(i);
    else active.push(step);
  }
  return { active, cancelled: cancelledView };
}

/** Current array index of a figure slot, or `null` once that figure is deleted. */
export function currentIndexOf(slot: number, slotToIndex: readonly (number | null)[]): number | null {
  const index = slotToIndex[slot];
  return index === undefined || index === null ? null : index;
}

export interface PlanExecution {
  readonly ops: readonly Primitive[];
  readonly finalObjects: readonly FigObj[];
  readonly slotToIndex: readonly (number | null)[];
}

function isReorder(command: CmdName): command is ReorderCmd {
  return command === 'ReorderR' || command === 'ReorderS' || command === 'ReorderJ';
}

function applyDelete(
  current: FigObj[],
  slotToIndex: readonly (number | null)[],
  index: number,
): readonly (number | null)[] {
  current.splice(index, 1);
  return slotToIndex.map((mapped) => {
    if (mapped === null) return null;
    if (mapped === index) return null;
    return mapped > index ? mapped - 1 : mapped;
  });
}

function applyReorder(
  current: readonly FigObj[],
  slotToIndex: readonly (number | null)[],
  order: readonly number[],
): { readonly objects: FigObj[]; readonly slotToIndex: readonly (number | null)[] } {
  const reordered: FigObj[] = [];
  for (let target = 0; target < order.length; target++) {
    const source = current[order[target]];
    const slot = current[target];
    if (source === undefined || slot === undefined) return { objects: [...current], slotToIndex };
    reordered.push({ ...source, x: slot.x, y: slot.y });
  }
  const nextSlots = slotToIndex.map(() => null as number | null);
  for (let target = 0; target < order.length; target++) {
    const sourceIndex = order[target];
    const slot = slotToIndex.findIndex((mapped) => mapped === sourceIndex);
    if (slot >= 0) nextSlots[slot] = target;
  }
  return { objects: reordered, slotToIndex: nextSlots };
}

/**
 * Execute active steps top-to-bottom on a live array. `plannedIndex` is the
 * step's original figure slot; deletes shrink the array, so the emitted
 * primitives carry the index valid at that moment (the grader replays exactly
 * these ops). Reorders are built from the CURRENT length, never the start's.
 */
export function executePlan(objects: readonly FigObj[], steps: readonly CommandStep[]): PlanExecution {
  let current: FigObj[] = objects.map((o) => ({ ...o }));
  let slotToIndex: readonly (number | null)[] = Array.from({ length: current.length }, (_, i) => i);
  const ops: Primitive[] = [];
  for (const step of steps) {
    if (isReorder(step.command)) {
      const order = reorderOrder(step.command, current.length);
      ops.push({ op: 'reorder', order });
      const applied = applyReorder(current, slotToIndex, order);
      current = applied.objects;
      slotToIndex = applied.slotToIndex;
      continue;
    }
    const index = currentIndexOf(step.plannedIndex, slotToIndex);
    if (index === null) continue;
    const target = current[index];
    switch (step.command) {
      case 'FlipV':
        ops.push({ op: 'flipVAt', index });
        if (target !== undefined) {
          target.rot = normalizeRot(target.rot + 180);
          target.flipH = !target.flipH;
        }
        break;
      case 'FlipH':
        ops.push({ op: 'flipHAt', index });
        if (target !== undefined) target.flipH = !target.flipH;
        break;
      case 'Flip180':
        ops.push({ op: 'flip180At', index });
        if (target !== undefined) target.rot = normalizeRot(target.rot + 180);
        break;
      case 'DeletePrev':
        if (index - 1 >= 0) {
          ops.push({ op: 'deleteAt', index: index - 1 });
          slotToIndex = applyDelete(current, slotToIndex, index - 1);
        }
        break;
      case 'DeleteNext':
        if (index + 1 < current.length) {
          ops.push({ op: 'deleteAt', index: index + 1 });
          slotToIndex = applyDelete(current, slotToIndex, index + 1);
        }
        break;
      case 'SwapPrev': {
        if (index - 1 >= 0) {
          ops.push({ op: 'swapWithPrevAt', index });
          const a = current[index];
          const b = current[index - 1];
          if (a !== undefined && b !== undefined) {
            const ax = a.x;
            const ay = a.y;
            a.x = b.x;
            a.y = b.y;
            b.x = ax;
            b.y = ay;
          }
        }
        break;
      }
      case 'CancelPrevCommand':
      case 'CancelNextCommand':
        break;
      default:
        return assertNever(step.command);
    }
  }
  return { ops, finalObjects: current, slotToIndex };
}

/** Apply a resolved plan to a figure state (grading path). */
export function executeCommandPlan(
  state: FigState,
  steps: readonly CommandStep[],
): FigState {
  const execution = executePlan(state.objects, steps);
  return { objects: execution.finalObjects, markerPos: state.markerPos };
}

/** Per-figure command labels for the UI; `slot: null` is the global reorder. */
export function commandPlanEntries(
  active: readonly CommandStep[],
): readonly { readonly label: string; readonly slot: number | null }[] {
  return active.map((step) => ({
    label: CMD_LABEL[step.command],
    slot: step.figureSlot ?? null,
  }));
}
