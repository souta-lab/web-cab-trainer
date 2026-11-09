import { describe, expect, it } from 'vitest';
import { Rng, pickWeighted } from '../src/domain/rng';
import {
  applyPrimitives,
  figureKey,
  figuresEqual,
  normalizeRot,
  normalizeSlot,
} from '../src/domain/figure';
import {
  containsUnknown,
  evaluate,
  expandCipherRule,
  expandCommand,
  expandPatternRule,
  render,
  solve,
  verifyArith,
} from '../src/domain/recipe';
import type { ArithNode, ArithRecipe } from '../src/domain/recipe';
import { validateProblem } from '../src/domain/invariants';
import { DIFFICULTIES } from '../src/domain/types';
import type { ArithmeticProblem, FigState, FigureProblem, Primitive } from '../src/domain/types';
import {
  ARITHMETIC_DECIMAL_WEIGHTS,
  CIPHER_COMPOSITION_WEIGHTS,
  COMMAND_COUNT_WEIGHTS,
  COMMAND_FIGURE_COUNT_WEIGHTS,
  PATTERN_RULE_COUNT_WEIGHTS,
  aggregateTable,
  expectedShares,
  sampleArithmeticDecimal,
  sampleCipherComposition,
  sampleCommandCount,
  sampleCommandFigureCount,
  samplePatternRuleCount,
} from '../src/generators/policy';
import type { CipherComposition, CommandFigureCount, RuleCount, WeightedTable } from '../src/generators/policy';

const num = (value: number): ArithNode => ({ kind: 'num', value });
const unknownNode: ArithNode = { kind: 'unknown' };
const bin = (op: '+' | '-' | '×' | '÷', left: ArithNode, right: ArithNode): ArithNode => ({
  kind: 'bin',
  op,
  left,
  right,
});
const group = (inner: ArithNode): ArithNode => ({ kind: 'group', inner });

const codes = (violations: { code: string }[]): string[] => violations.map((v) => v.code);

const share = <T>(map: Map<T, number>, key: T): number => map.get(key) ?? 0;

const stringKeyed = (table: WeightedTable<RuleCount>): WeightedTable<string> =>
  table.map(([value, weight]): readonly [string, number] => [String(value), weight]);

const baseFigure = (): FigState => ({
  objects: [
    { shape: 'square', x: 30, y: 30, rot: 0, fill: false, size: 22, flipH: false },
    { shape: 'dot', x: 60, y: 60, rot: 0, fill: true, size: 5, flipH: false },
  ],
  markerPos: 0,
});

const ALL_PRIMITIVES: readonly Primitive[] = [
  { op: 'rotate', deg: 90 },
  { op: 'rotate', deg: 180 },
  { op: 'rotate', deg: 270 },
  { op: 'flipH' },
  { op: 'flipV' },
  { op: 'toggleFill' },
  { op: 'move', dx: 5, dy: -7 },
  { op: 'moveMarker', delta: 1 },
  { op: 'moveMarker', delta: -1 },
  { op: 'swapObjects' },
  { op: 'addDot', x: 60, y: 60 },
  { op: 'removeDot' },
  { op: 'flipVAt', index: 1 },
  { op: 'flipHAt', index: 1 },
  { op: 'flip180At', index: 1 },
  { op: 'deleteAt', index: 0 },
  { op: 'swapWithPrevAt', index: 1 },
  { op: 'reorder', order: [1, 0] },
];

function freezeFigure(s: FigState): FigState {
  for (const o of s.objects) Object.freeze(o);
  return Object.freeze(s);
}

describe('normalizeRot / normalizeSlot', () => {
  it('is total over integers, idempotent, and returns only quarter turns', () => {
    const valid = new Set([0, 90, 180, 270]);
    for (let n = -1080; n <= 1080; n++) {
      const r = normalizeRot(n);
      expect(valid.has(r)).toBe(true);
      expect(normalizeRot(r)).toBe(r);
    }
  });

  it('matches ((n % 360) + 360) % 360 for multiples of 90', () => {
    for (let n = -1440; n <= 1440; n += 90) {
      expect(normalizeRot(n)).toBe(((n % 360) + 360) % 360);
    }
  });

  it('normalizeSlot wraps into 0..3', () => {
    const valid = new Set([0, 1, 2, 3]);
    for (let n = -20; n <= 20; n++) expect(valid.has(normalizeSlot(n))).toBe(true);
  });
});

describe('applyPrimitives', () => {
  it('is pure: frozen input is unchanged and output is reproducible', () => {
    const start = freezeFigure(baseFigure());
    const before = figureKey(start);
    const out = applyPrimitives(start, ALL_PRIMITIVES);
    expect(figureKey(start)).toBe(before);
    expect(figuresEqual(out, applyPrimitives(baseFigure(), ALL_PRIMITIVES))).toBe(true);
  });

  it('is total on a main-less figure (no throw)', () => {
    const empty = freezeFigure({ objects: [], markerPos: 0 });
    expect(() => applyPrimitives(empty, ALL_PRIMITIVES)).not.toThrow();
  });
});

describe('position-aware primitives', () => {
  const column = (): FigState => ({
    objects: [
      { shape: 'arrow', x: 60, y: 18, rot: 0, fill: true, size: 22, flipH: false },
      { shape: 'triangle', x: 60, y: 44, rot: 90, fill: false, size: 22, flipH: false },
      { shape: 'square', x: 60, y: 70, rot: 0, fill: true, size: 22, flipH: false },
    ],
    markerPos: 0,
  });

  it('flipVAt mirrors one object: rot +180 and flipH toggled, others untouched', () => {
    const out = applyPrimitives(column(), [{ op: 'flipVAt', index: 1 }]);
    expect(out.objects[1]?.rot).toBe(270);
    expect(out.objects[1]?.flipH).toBe(true);
    expect(out.objects[0]?.rot).toBe(0);
    expect(out.objects[0]?.flipH).toBe(false);
  });

  it('flipHAt mirrors one object horizontally only', () => {
    const out = applyPrimitives(column(), [{ op: 'flipHAt', index: 1 }]);
    expect(out.objects[1]?.rot).toBe(90);
    expect(out.objects[1]?.flipH).toBe(true);
    expect(out.objects[0]?.flipH).toBe(false);
  });

  it('flip180At rotates one object in place', () => {
    const out = applyPrimitives(column(), [{ op: 'flip180At', index: 1 }]);
    expect(out.objects[1]?.rot).toBe(270);
    expect(out.objects[1]?.flipH).toBe(false);
  });

  it('deleteAt removes one object and shifts later objects up', () => {
    const out = applyPrimitives(column(), [{ op: 'deleteAt', index: 0 }]);
    expect(out.objects).toHaveLength(2);
    expect(out.objects[0]?.shape).toBe('triangle');
    expect(out.objects[1]?.shape).toBe('square');
  });

  it('swapWithPrevAt swaps positions and keeps shapes with their objects', () => {
    const out = applyPrimitives(column(), [{ op: 'swapWithPrevAt', index: 2 }]);
    expect(out.objects[2]?.shape).toBe('square');
    expect(out.objects[2]?.y).toBe(44);
    expect(out.objects[1]?.shape).toBe('triangle');
    expect(out.objects[1]?.y).toBe(70);
    expect(out.objects[0]?.y).toBe(18);
  });

  it('reorder takes the old object at order[i] into slot i', () => {
    const out = applyPrimitives(column(), [{ op: 'reorder', order: [2, 1, 0] }]);
    expect(out.objects[0]?.shape).toBe('square');
    expect(out.objects[0]?.y).toBe(18);
    expect(out.objects[0]?.fill).toBe(true);
    expect(out.objects[2]?.shape).toBe('arrow');
    expect(out.objects[2]?.y).toBe(70);
    expect(out.objects[2]?.fill).toBe(true);
  });

  it('is total and pure for out-of-range indices and frozen input', () => {
    const start = freezeFigure(column());
    const before = figureKey(start);
    const outOfRange: readonly Primitive[] = [
      { op: 'flipVAt', index: -1 },
      { op: 'flipHAt', index: 9 },
      { op: 'flip180At', index: 3 },
      { op: 'deleteAt', index: 3 },
      { op: 'deleteAt', index: -1 },
      { op: 'swapWithPrevAt', index: 0 },
      { op: 'swapWithPrevAt', index: 7 },
    ];
    expect(() => applyPrimitives(start, outOfRange)).not.toThrow();
    expect(figureKey(applyPrimitives(start, outOfRange))).toBe(before);
    expect(figureKey(start)).toBe(before);
  });

  it('treats a length-mismatched or out-of-range reorder as a no-op', () => {
    const start = freezeFigure(column());
    const before = figureKey(start);
    const invalid: readonly Primitive[] = [
      { op: 'reorder', order: [0, 1] },
      { op: 'reorder', order: [] },
      { op: 'reorder', order: [0, 1, 7] },
      { op: 'reorder', order: [-1, 0, 1] },
    ];
    expect(() => applyPrimitives(start, invalid)).not.toThrow();
    expect(figureKey(applyPrimitives(start, invalid))).toBe(before);
    expect(figureKey(start)).toBe(before);
  });

  it('keeps a duplicate-index reorder total (never throws, never reuses a slot)', () => {
    const start = freezeFigure(column());
    const out = applyPrimitives(start, [{ op: 'reorder', order: [0, 0, 1] }]);
    expect(out.objects).toHaveLength(3);
    expect(figureKey(start)).toBe(figureKey(column()));
  });
});

describe('figureKey', () => {
  it('distinguishes flipH, size, markerPos and object order', () => {
    const a: FigState = {
      objects: [{ shape: 'circle', x: 30, y: 30, rot: 0, fill: false, size: 22, flipH: false }],
      markerPos: 0,
    };
    const flip: FigState = { objects: [{ ...a.objects[0], flipH: true }], markerPos: 0 };
    const sized: FigState = { objects: [{ ...a.objects[0], size: 25 }], markerPos: 0 };
    const moved: FigState = { objects: a.objects, markerPos: 1 };
    expect(figureKey(a)).not.toBe(figureKey(flip));
    expect(figureKey(a)).not.toBe(figureKey(sized));
    expect(figureKey(a)).not.toBe(figureKey(moved));

    const two: FigState = {
      objects: [a.objects[0], { shape: 'dot', x: 60, y: 60, rot: 0, fill: true, size: 5, flipH: false }],
      markerPos: 0,
    };
    const swapped: FigState = { objects: [...two.objects].reverse(), markerPos: 0 };
    expect(figureKey(two)).not.toBe(figureKey(swapped));
  });
});

describe('Rng', () => {
  it('is deterministic for the same seed', () => {
    const a = new Rng(98765);
    const b = new Rng(98765);
    expect(Array.from({ length: 32 }, () => a.next())).toEqual(
      Array.from({ length: 32 }, () => b.next()),
    );
  });

  it('pickWeighted respects weights', () => {
    const rng = new Rng(24680);
    const n = 50000;
    let weightedB = 0;
    for (let i = 0; i < n; i++) {
      if (pickWeighted<'a' | 'b'>(rng, [['a', 30], ['b', 70]]) === 'b') weightedB++;
    }
    expect(Math.abs(weightedB / n - 0.7)).toBeLessThan(0.03);
  });
});

describe('policy distribution', () => {
  it('per-difficulty tables aggregate to the research targets', () => {
    const expected = expectedShares();
    const pattern = aggregateTable([
      stringKeyed(PATTERN_RULE_COUNT_WEIGHTS[1]),
      stringKeyed(PATTERN_RULE_COUNT_WEIGHTS[2]),
      stringKeyed(PATTERN_RULE_COUNT_WEIGHTS[3]),
    ]);
    const patternKeys: readonly RuleCount[] = [1, 2, 3];
    for (const key of patternKeys) {
      expect(Math.abs(share(pattern, String(key)) - expected.patternRuleCount[key])).toBeLessThan(0.02);
    }

    const figures = aggregateTable([
      COMMAND_FIGURE_COUNT_WEIGHTS[1],
      COMMAND_FIGURE_COUNT_WEIGHTS[2],
      COMMAND_FIGURE_COUNT_WEIGHTS[3],
    ]);
    const figureKeys: readonly CommandFigureCount[] = [2, 3, 4];
    for (const key of figureKeys) {
      expect(Math.abs(share(figures, key) - expected.commandFigureCount[key])).toBeLessThan(0.02);
    }

    const overflow = aggregateTable([
      COMMAND_COUNT_WEIGHTS[1],
      COMMAND_COUNT_WEIGHTS[2],
      COMMAND_COUNT_WEIGHTS[3],
    ]);
    expect(Math.abs(share(overflow, true) - expected.commandOverflow)).toBeLessThan(0.02);

    const cipher = aggregateTable([
      CIPHER_COMPOSITION_WEIGHTS[1],
      CIPHER_COMPOSITION_WEIGHTS[2],
      CIPHER_COMPOSITION_WEIGHTS[3],
    ]);
    expect(Math.abs(share(cipher, 'single') - expected.cipherComposition.single)).toBeLessThan(0.02);
    expect(Math.abs(share(cipher, 'multi') - expected.cipherComposition.multi)).toBeLessThan(0.02);

    const decimal = aggregateTable([
      ARITHMETIC_DECIMAL_WEIGHTS[1],
      ARITHMETIC_DECIMAL_WEIGHTS[2],
      ARITHMETIC_DECIMAL_WEIGHTS[3],
    ]);
    expect(Math.abs(share(decimal, 'decimal') - expected.arithmeticDecimal)).toBeLessThan(0.02);
  });

  it('samplers match expectedShares over 50k uniform-difficulty draws', () => {
    const rng = new Rng(20240912);
    const n = 50000;
    const pattern: Record<RuleCount, number> = { 1: 0, 2: 0, 3: 0 };
    const figures: Record<CommandFigureCount, number> = { 2: 0, 3: 0, 4: 0 };
    let overflow = 0;
    const cipher: Record<CipherComposition, number> = { single: 0, multi: 0 };
    let decimal = 0;
    for (let i = 0; i < n; i++) {
      const difficulty = rng.pick(DIFFICULTIES);
      pattern[samplePatternRuleCount(rng, difficulty)]++;
      const figureCount = sampleCommandFigureCount(rng, difficulty);
      figures[figureCount]++;
      if (sampleCommandCount(rng, difficulty, figureCount) === figureCount + 1) overflow++;
      cipher[sampleCipherComposition(rng, difficulty)]++;
      if (sampleArithmeticDecimal(rng, difficulty)) decimal++;
    }
    const expected = expectedShares();
    expect(Math.abs(pattern[1] / n - expected.patternRuleCount[1])).toBeLessThan(0.03);
    expect(Math.abs(pattern[2] / n - expected.patternRuleCount[2])).toBeLessThan(0.03);
    expect(Math.abs(pattern[3] / n - expected.patternRuleCount[3])).toBeLessThan(0.03);
    expect(Math.abs(figures[2] / n - expected.commandFigureCount[2])).toBeLessThan(0.03);
    expect(Math.abs(figures[3] / n - expected.commandFigureCount[3])).toBeLessThan(0.03);
    expect(Math.abs(figures[4] / n - expected.commandFigureCount[4])).toBeLessThan(0.03);
    expect(Math.abs(overflow / n - expected.commandOverflow)).toBeLessThan(0.03);
    expect(Math.abs(cipher.single / n - expected.cipherComposition.single)).toBeLessThan(0.03);
    expect(Math.abs(decimal / n - expected.arithmeticDecimal)).toBeLessThan(0.03);
  });
});

describe('arithmetic recipe', () => {
  it('evaluate/solve/render round-trip (multiply-add)', () => {
    const recipe: ArithRecipe = { root: bin('+', bin('×', unknownNode, num(3)), num(2)), unknownValue: 4 };
    expect(containsUnknown(recipe.root)).toBe(true);
    expect(evaluate(recipe.root, 4)).toBe(14);
    expect(solve(recipe)).toBe(4);
    expect(render(recipe)).toBe('? × 3 + 2 = 14');
    expect(verifyArith(recipe)).toEqual({ ok: true });
  });

  it('inverts division on both sides', () => {
    const left: ArithRecipe = { root: bin('÷', num(12), unknownNode), unknownValue: 5 };
    expect(solve(left)).toBe(5);
    expect(render(left)).toBe('12 ÷ ? = 2.4');
    expect(verifyArith(left).ok).toBe(true);

    const right: ArithRecipe = { root: bin('÷', unknownNode, num(4)), unknownValue: 3 };
    expect(solve(right)).toBe(3);
    expect(render(right)).toBe('? ÷ 4 = 0.75');
    expect(verifyArith(right).ok).toBe(true);
  });

  it('detects division by zero', () => {
    const bad: ArithRecipe = { root: bin('÷', num(1), num(0)), unknownValue: 1 };
    const result = verifyArith(bad);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('divide-by-zero');
  });

  it('handles a grouped multi-op recipe', () => {
    const recipe: ArithRecipe = {
      root: bin('-', group(bin('×', group(bin('+', unknownNode, num(3))), num(2))), num(4)),
      unknownValue: 6,
    };
    expect(solve(recipe)).toBe(6);
    expect(verifyArith(recipe).ok).toBe(true);
    expect(render(recipe)).toContain('?');
    expect(render(recipe)).toContain('= 14');
  });
});

describe('rule expansion', () => {
  it('expands position-aware commands against the given index and figure count', () => {
    expect(expandCommand('FlipV', 1, 4)).toEqual([{ op: 'flipVAt', index: 1 }]);
    expect(expandCommand('FlipH', 3, 4)).toEqual([{ op: 'flipHAt', index: 3 }]);
    expect(expandCommand('Flip180', 0, 4)).toEqual([{ op: 'flip180At', index: 0 }]);
    expect(expandCommand('SwapPrev', 2, 4)).toEqual([{ op: 'swapWithPrevAt', index: 2 }]);
    expect(expandCommand('DeletePrev', 0, 4)).toEqual([]);
    expect(expandCommand('DeletePrev', 1, 4)).toEqual([{ op: 'deleteAt', index: 0 }]);
    expect(expandCommand('DeleteNext', 3, 4)).toEqual([]);
    expect(expandCommand('DeleteNext', 2, 4)).toEqual([{ op: 'deleteAt', index: 3 }]);
    expect(expandCommand('CancelPrevCommand', 1, 4)).toEqual([]);
    expect(expandCommand('CancelNextCommand', 2, 4)).toEqual([]);
  });

  it('expands reorder commands to permutations of the current figure count', () => {
    expect(expandCommand('ReorderR', 0, 4)).toEqual([{ op: 'reorder', order: [3, 2, 1, 0] }]);
    expect(expandCommand('ReorderS', 0, 4)).toEqual([{ op: 'reorder', order: [2, 3, 0, 1] }]);
    expect(expandCommand('ReorderJ', 0, 4)).toEqual([{ op: 'reorder', order: [1, 0, 3, 2] }]);
    expect(expandCommand('ReorderJ', 0, 3)).toEqual([{ op: 'reorder', order: [1, 0, 2] }]);
    expect(expandCommand('ReorderS', 0, 2)).toEqual([{ op: 'reorder', order: [1, 0] }]);
  });

  it('expands pattern and cipher rules', () => {
    expect(expandPatternRule({ type: 'move', cycle: 'corners-counter' })).toEqual([
      { op: 'moveMarker', delta: -1 },
    ]);
    expect(expandCipherRule({ type: 'inside-outside' })).toEqual([{ op: 'swapObjects' }]);
    expect(expandCipherRule({ type: 'add-dot' })).toEqual([{ op: 'addDot', x: 60, y: 85 }]);
  });
});

describe('validateProblem', () => {
  const goodRecipe: ArithRecipe = { root: bin('+', bin('×', unknownNode, num(3)), num(2)), unknownValue: 4 };
  const goodArith: ArithmeticProblem = {
    seed: 1,
    subject: 'arithmetic',
    difficulty: 2,
    skillTags: ['linear-basic'],
    explanation: '説明',
    fingerprint: 'arith|1',
    display: render(goodRecipe),
    recipe: goodRecipe,
    answer: 4,
    choices: [4, 5, 6, 7, 8],
    correctIndex: 0,
  };

  it('accepts a valid arithmetic problem', () => {
    expect(validateProblem(goodArith)).toEqual([]);
  });

  it('flags duplicate choices and out-of-range correctIndex', () => {
    expect(codes(validateProblem({ ...goodArith, choices: [4, 4, 6, 7, 8] }))).toContain('duplicate-choice');
    expect(codes(validateProblem({ ...goodArith, correctIndex: 9 }))).toContain('correct-index-range');
  });

  const buildFigure = (): FigureProblem => {
    const start: FigState = {
      objects: [{ shape: 'triangle', x: 40, y: 50, rot: 0, fill: false, size: 22, flipH: false }],
      markerPos: 0,
    };
    const ops: Primitive[] = [{ op: 'rotate', deg: 90 }];
    const choices: FigState[] = [
      applyPrimitives(start, ops),
      applyPrimitives(start, [{ op: 'rotate', deg: 180 }]),
      applyPrimitives(start, [{ op: 'flipH' }]),
      applyPrimitives(start, [{ op: 'toggleFill' }]),
      applyPrimitives(start, [{ op: 'rotate', deg: 270 }]),
    ];
    return {
      seed: 2,
      subject: 'cipher',
      difficulty: 2,
      skillTags: ['cipher-single'],
      explanation: '説明',
      fingerprint: 'cipher|2',
      prompt: '選べ',
      start,
      ops,
      choices,
      correctIndex: 0,
    };
  };

  it('accepts a valid figure problem', () => {
    expect(validateProblem(buildFigure())).toEqual([]);
  });

  it('flags duplicated figure choices and recipe mismatch', () => {
    const figure = buildFigure();
    const duplicated = {
      ...figure,
      choices: figure.choices.map((c, i) => (i === 4 ? figure.choices[0] : c)),
    };
    expect(codes(validateProblem(duplicated))).toContain('duplicate-choice');
    expect(codes(validateProblem({ ...figure, correctIndex: 1 }))).toContain('correct-index-mismatch');
  });
});
