import { describe, expect, it } from 'vitest';
import {
  COMMAND_COUNT_WEIGHTS,
  COMMAND_FIGURE_COUNT_WEIGHTS,
  aggregateTable,
  expectedShares,
  sampleCommandCount,
} from '../src/generators/policy';
import type { CommandStep } from '../src/generators/commandPlan';
import { resolveCommandPlan } from '../src/generators/commandPlan';
import { Rng } from '../src/domain/rng';

const step = (command: CommandStep['command'], plannedIndex: number): CommandStep => ({
  command,
  plannedIndex,
  figureSlot: plannedIndex,
});

const commandsOf = (steps: readonly CommandStep[]): string[] => steps.map((s) => s.command);

describe('resolveCommandPlan', () => {
  it('CancelPrevCommand cancels the preceding command and stays active itself', () => {
    const resolved = resolveCommandPlan([step('FlipV', 0), step('CancelPrevCommand', 1)]);
    expect(commandsOf(resolved.active)).toEqual(['CancelPrevCommand']);
    expect(resolved.cancelled).toEqual([0]);
  });

  it('CancelNextCommand cancels the following command', () => {
    const resolved = resolveCommandPlan([step('FlipV', 0), step('CancelNextCommand', 1), step('DeleteNext', 2)]);
    expect(commandsOf(resolved.active)).toEqual(['FlipV', 'CancelNextCommand']);
    expect(resolved.cancelled).toEqual([2]);
  });

  it('cancelling a cancel restores the original command (chaining)', () => {
    const resolved = resolveCommandPlan([
      step('FlipV', 0),
      step('CancelPrevCommand', 1),
      step('CancelNextCommand', 2),
    ]);
    expect(commandsOf(resolved.active)).toEqual(['FlipV', 'CancelPrevCommand', 'CancelNextCommand']);
    expect(resolved.cancelled).toEqual([]);
  });

  it('cancel effects are released when their canceller is itself cancelled', () => {
    const resolved = resolveCommandPlan([
      step('FlipV', 0),
      step('CancelNextCommand', 1),
      step('DeleteNext', 2),
      step('CancelPrevCommand', 3),
    ]);
    expect(commandsOf(resolved.active)).toEqual(['FlipV', 'CancelPrevCommand']);
    expect(resolved.cancelled).toEqual([1, 2]);
  });

  it('mutually-cancelling cancels take no effect', () => {
    const resolved = resolveCommandPlan([
      step('CancelNextCommand', 0),
      step('CancelPrevCommand', 1),
      step('FlipV', 2),
    ]);
    expect(commandsOf(resolved.active)).toEqual(['CancelNextCommand', 'CancelPrevCommand', 'FlipV']);
    expect(resolved.cancelled).toEqual([]);
  });

  it('is deterministic and never cancels an already-cancelled step twice', () => {
    const steps = [
      step('FlipV', 0),
      step('CancelNextCommand', 1),
      step('DeleteNext', 2),
      step('CancelPrevCommand', 3),
      step('SwapPrev', 4),
    ];
    const first = resolveCommandPlan(steps);
    const second = resolveCommandPlan(steps);
    expect(second).toEqual(first);
    expect(new Set(first.cancelled).size).toBe(first.cancelled.length);
  });

  it('leaves plans without cancels untouched', () => {
    const steps = [step('FlipV', 0), step('SwapPrev', 1), step('ReorderR', 2)];
    const resolved = resolveCommandPlan(steps);
    expect(resolved.active).toEqual(steps);
    expect(resolved.cancelled).toEqual([]);
  });
});

describe('command count policy', () => {
  it('samples figureCount+1 or figureCount, never below 2', () => {
    const rng = new Rng(7);
    for (const figureCount of [2, 3, 4] as const) {
      for (let i = 0; i < 200; i++) {
        const count = sampleCommandCount(rng, 2, figureCount);
        expect(count === figureCount || count === figureCount + 1).toBe(true);
        expect(count).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('consumes exactly one rng draw regardless of the sampled branch', () => {
    const probe = new Rng(999);
    sampleCommandCount(probe, 2, 4);
    const reference = new Rng(999);
    reference.next();
    expect(probe.next()).toBe(reference.next());
  });

  it('per-difficulty tables aggregate to the expectedShares targets', () => {
    const expected = expectedShares();
    const figures = aggregateTable([
      COMMAND_FIGURE_COUNT_WEIGHTS[1],
      COMMAND_FIGURE_COUNT_WEIGHTS[2],
      COMMAND_FIGURE_COUNT_WEIGHTS[3],
    ]);
    for (const count of [2, 3, 4] as const) {
      expect(Math.abs((figures.get(count) ?? 0) - expected.commandFigureCount[count])).toBeLessThan(0.02);
    }

    const overflow = aggregateTable([
      COMMAND_COUNT_WEIGHTS[1],
      COMMAND_COUNT_WEIGHTS[2],
      COMMAND_COUNT_WEIGHTS[3],
    ]);
    expect(Math.abs((overflow.get(true) ?? 0) - expected.commandOverflow)).toBeLessThan(0.02);
  });
});
