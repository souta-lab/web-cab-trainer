// Arithmetic recipe AST + figure rule → Primitive expansion.
//
// The arithmetic `recipe` fully determines BOTH the display and the answer:
//   display = render(recipe)
//   answer  = solve(recipe)  (independent algebraic inversion, not a lookup)
// The figure rule types are the rich, human-level description; `expand*` maps
// them to the shared `Primitive` ops interpreted by figure.ts. Generation and
// tests both use these expanders, so they cannot diverge.

import type { Primitive } from './types';

// ---------------------------------------------------------------------------
// Arithmetic
// ---------------------------------------------------------------------------

export type ArithNode =
  | { kind: 'num'; value: number }
  | { kind: 'unknown' }
  | { kind: 'bin'; op: '+' | '-' | '×' | '÷'; left: ArithNode; right: ArithNode }
  | { kind: 'group'; inner: ArithNode };

export interface ArithRecipe {
  root: ArithNode;
  /** The intended answer. `solve` must independently recover this. */
  unknownValue: number;
}

export const round2 = (n: number): number => Math.round(n * 100) / 100;

export const fmtNum = (n: number): string =>
  Number.isInteger(n) ? String(n) : String(round2(n));

export type ArithEvalErrorCode =
  | 'divide-by-zero'
  | 'non-finite'
  | 'no-unknown'
  | 'multiple-unknowns'
  | 'unsolvable';

export class ArithEvalError extends Error {
  readonly code: ArithEvalErrorCode;

  constructor(code: ArithEvalErrorCode, message: string) {
    super(message);
    this.name = 'ArithEvalError';
    this.code = code;
  }
}

function assertNever(x: never): never {
  throw new Error(`unexpected node: ${JSON.stringify(x)}`);
}

function applyOp(op: '+' | '-' | '×' | '÷', left: number, right: number): number {
  switch (op) {
    case '+':
      return left + right;
    case '-':
      return left - right;
    case '×':
      return left * right;
    case '÷':
      if (right === 0) throw new ArithEvalError('divide-by-zero', 'division by zero');
      return left / right;
    default:
      return assertNever(op);
  }
}

/** Exact recursive evaluation; throws typed errors on ÷0 or non-finite results. */
export function evaluate(node: ArithNode, unknown: number): number {
  switch (node.kind) {
    case 'num':
      return node.value;
    case 'unknown':
      return unknown;
    case 'group':
      return evaluate(node.inner, unknown);
    case 'bin': {
      const value = applyOp(node.op, evaluate(node.left, unknown), evaluate(node.right, unknown));
      if (!Number.isFinite(value)) {
        throw new ArithEvalError('non-finite', `non-finite result for ${node.op}`);
      }
      return value;
    }
    default:
      return assertNever(node);
  }
}

export function containsUnknown(node: ArithNode): boolean {
  switch (node.kind) {
    case 'num':
      return false;
    case 'unknown':
      return true;
    case 'group':
      return containsUnknown(node.inner);
    case 'bin':
      return containsUnknown(node.left) || containsUnknown(node.right);
    default:
      return assertNever(node);
  }
}

type ArithBin = Extract<ArithNode, { kind: 'bin' }>;

/**
 * Recover the unknown by algebraic inversion: walk from the root value down to
 * the unknown node, inverting each operation. Throws on ill-formed recipes.
 */
export function solve(recipe: ArithRecipe): number {
  if (!containsUnknown(recipe.root)) {
    throw new ArithEvalError('no-unknown', 'recipe contains no unknown');
  }
  const target = evaluate(recipe.root, recipe.unknownValue);
  return round2(invert(recipe.root, target));
}

function invert(node: ArithNode, target: number): number {
  switch (node.kind) {
    case 'num':
      throw new ArithEvalError('no-unknown', 'reached a constant while inverting');
    case 'unknown':
      return target;
    case 'group':
      return invert(node.inner, target);
    case 'bin':
      return invertBin(node, target);
    default:
      return assertNever(node);
  }
}

function invertBin(node: ArithBin, target: number): number {
  const leftHas = containsUnknown(node.left);
  const rightHas = containsUnknown(node.right);
  if (leftHas && rightHas) {
    throw new ArithEvalError('multiple-unknowns', 'recipe contains more than one unknown');
  }
  if (!leftHas && !rightHas) {
    throw new ArithEvalError('no-unknown', 'binary node has no unknown');
  }
  const leftVal = leftHas ? NaN : evaluate(node.left, 0);
  const rightVal = rightHas ? NaN : evaluate(node.right, 0);
  switch (node.op) {
    case '+':
      return leftHas ? invert(node.left, target - rightVal) : invert(node.right, target - leftVal);
    case '-':
      return leftHas ? invert(node.left, target + rightVal) : invert(node.right, leftVal - target);
    case '×':
      if (leftHas) {
        if (rightVal === 0) throw new ArithEvalError('unsolvable', 'multiply by zero');
        return invert(node.left, target / rightVal);
      }
      if (leftVal === 0) throw new ArithEvalError('unsolvable', 'multiply by zero');
      return invert(node.right, target / leftVal);
    case '÷':
      if (leftHas) return invert(node.left, target * rightVal);
      if (target === 0) throw new ArithEvalError('unsolvable', 'division yields zero target');
      return invert(node.right, leftVal / target);
    default:
      return assertNever(node.op);
  }
}

function opSymbol(op: '+' | '-' | '×' | '÷'): string {
  switch (op) {
    case '+':
      return '+';
    case '-':
      return '−';
    case '×':
      return '×';
    case '÷':
      return '÷';
    default:
      return assertNever(op);
  }
}

function renderNode(node: ArithNode): string {
  switch (node.kind) {
    case 'num':
      return fmtNum(node.value);
    case 'unknown':
      return '?';
    case 'group':
      return `(${renderNode(node.inner)})`;
    case 'bin':
      return `${renderNode(node.left)} ${opSymbol(node.op)} ${renderNode(node.right)}`;
    default:
      return assertNever(node);
  }
}

/** Deterministic Japanese-style display, e.g. `(? + 3) × 2 − 4 = 14`. */
export function render(recipe: ArithRecipe): string {
  const target = round2(evaluate(recipe.root, recipe.unknownValue));
  return `${renderNode(recipe.root)} = ${fmtNum(target)}`;
}

/** Self-check: display is satisfiable, solve independently recovers the answer. */
export function verifyArith(recipe: ArithRecipe): { ok: boolean; reason?: string } {
  try {
    const value = evaluate(recipe.root, recipe.unknownValue);
    if (!Number.isFinite(value)) return { ok: false, reason: 'non-finite' };
    const solved = solve(recipe);
    if (round2(solved) !== round2(recipe.unknownValue)) {
      return { ok: false, reason: `solve mismatch: ${solved} !== ${recipe.unknownValue}` };
    }
    return { ok: true };
  } catch (error) {
    if (error instanceof ArithEvalError) return { ok: false, reason: `${error.code}: ${error.message}` };
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Figure rules (rich descriptions) → Primitive expansion
// ---------------------------------------------------------------------------

export type PatternRule =
  | { type: 'rotate'; degreesPerStep: 90 | 180 | 270 }
  | { type: 'move'; cycle: 'corners-clockwise' | 'corners-counter' }
  | { type: 'fill-toggle' }
  | { type: 'flip'; axis: 'h' | 'v' };

export type CmdName =
  | 'Rotate90'
  | 'Rotate180'
  | 'FlipH'
  | 'FlipV'
  | 'ToggleFill'
  | 'SwapPos'
  | 'MoveMarker'
  | 'AddDot'
  | 'RemoveDot';

export type CipherRule =
  | { type: 'rotation'; degrees: 90 | 180 | 270 }
  | { type: 'fill' }
  | { type: 'flip'; axis: 'h' | 'v' }
  | { type: 'inside-outside' }
  | { type: 'move' }
  | { type: 'add-dot' };

/** Human-readable labels for the commands subject. */
export const CMD_LABEL: Record<CmdName, string> = {
  Rotate90: '◐90°',
  Rotate180: '◑180°',
  FlipH: '⇋反転',
  FlipV: '⇅反転',
  ToggleFill: '◉塗替',
  SwapPos: '⇄交換',
  MoveMarker: '↻移動',
  AddDot: '＋点',
  RemoveDot: '－点',
};

export function expandPatternRule(rule: PatternRule): Primitive[] {
  switch (rule.type) {
    case 'rotate':
      return [{ op: 'rotate', deg: rule.degreesPerStep }];
    case 'move':
      return [{ op: 'moveMarker', delta: rule.cycle === 'corners-counter' ? -1 : 1 }];
    case 'fill-toggle':
      return [{ op: 'toggleFill' }];
    case 'flip':
      return rule.axis === 'h' ? [{ op: 'flipH' }] : [{ op: 'flipV' }];
    default:
      return assertNever(rule);
  }
}

export function expandCommand(cmd: CmdName): Primitive[] {
  switch (cmd) {
    case 'Rotate90':
      return [{ op: 'rotate', deg: 90 }];
    case 'Rotate180':
      return [{ op: 'rotate', deg: 180 }];
    case 'FlipH':
      return [{ op: 'flipH' }];
    case 'FlipV':
      return [{ op: 'flipV' }];
    case 'ToggleFill':
      return [{ op: 'toggleFill' }];
    case 'SwapPos':
      return [{ op: 'swapObjects' }];
    case 'MoveMarker':
      return [{ op: 'moveMarker', delta: 1 }];
    case 'AddDot':
      return [{ op: 'addDot', x: 60, y: 60 }];
    case 'RemoveDot':
      return [{ op: 'removeDot' }];
    default:
      return assertNever(cmd);
  }
}

export function expandCipherRule(rule: CipherRule): Primitive[] {
  switch (rule.type) {
    case 'rotation':
      return [{ op: 'rotate', deg: rule.degrees }];
    case 'fill':
      return [{ op: 'toggleFill' }];
    case 'flip':
      return rule.axis === 'h' ? [{ op: 'flipH' }] : [{ op: 'flipV' }];
    case 'inside-outside':
      return [{ op: 'swapObjects' }];
    case 'move':
      return [{ op: 'moveMarker', delta: 1 }];
    case 'add-dot':
      return [{ op: 'addDot', x: 60, y: 85 }];
    default:
      return assertNever(rule);
  }
}

/** Flatten items into a single ordered Primitive[] using the given expander. */
export function sequenceOps<T>(items: readonly T[], expand: (item: T) => Primitive[]): Primitive[] {
  const out: Primitive[] = [];
  for (const item of items) out.push(...expand(item));
  return out;
}
