// Figure rules (rich descriptions) → Primitive expansion.
//
// Also re-exports the arithmetic recipe helpers from `./arith`, so
// `domain/recipe` stays the single import site for both halves. The rule types
// are the rich, human-level description; `expand*` maps them to the shared
// `Primitive` ops interpreted by figure.ts. Generation and tests use the same
// expanders, so they cannot diverge.

import type { Primitive } from './types';

export type { ArithEvalErrorCode, ArithNode, ArithRecipe } from './arith';
export {
  ArithEvalError,
  containsUnknown,
  evaluate,
  fmtNum,
  render,
  round2,
  solve,
  verifyArith,
} from './arith';

function assertNever(x: never): never {
  throw new Error(`unexpected value: ${JSON.stringify(x)}`);
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
  | 'FlipV'
  | 'FlipH'
  | 'Flip180'
  | 'DeletePrev'
  | 'DeleteNext'
  | 'SwapPrev'
  | 'CancelPrevCommand'
  | 'CancelNextCommand'
  | 'ReorderR'
  | 'ReorderS'
  | 'ReorderJ';

export type ReorderCmd = Extract<CmdName, 'ReorderR' | 'ReorderS' | 'ReorderJ'>;

export type CipherRule =
  | { type: 'rotation'; degrees: 90 | 180 | 270 }
  | { type: 'fill' }
  | { type: 'flip'; axis: 'h' | 'v' }
  | { type: 'inside-outside' }
  | { type: 'move' }
  | { type: 'add-dot' };

/** Human-readable labels for the commands subject. */
export const CMD_LABEL: Record<CmdName, string> = {
  FlipV: '上下反転',
  FlipH: '左右反転',
  Flip180: '上下左右反転',
  DeletePrev: '前の図形を消す',
  DeleteNext: '次の図形を消す',
  SwapPrev: '前の図形と入れかえ',
  CancelPrevCommand: '前の命令を取り消す',
  CancelNextCommand: '次の命令を取り消す',
  ReorderR: '順序: 逆順',
  ReorderS: '順序: 前半後半入替',
  ReorderJ: '順序: 隣接入替',
};

export const REORDER_CMDS: readonly CmdName[] = ['ReorderR', 'ReorderS', 'ReorderJ'];

/** The permutation each reorder command applies to a column of `n` figures. */
export function reorderOrder(cmd: ReorderCmd, n: number): readonly number[] {
  const order: number[] = [];
  for (let i = 0; i < n; i++) {
    switch (cmd) {
      case 'ReorderR':
        order.push(n - 1 - i);
        break;
      case 'ReorderS':
        order.push(i < n - Math.floor(n / 2) ? i + Math.floor(n / 2) : i - (n - Math.floor(n / 2)));
        break;
      case 'ReorderJ':
        order.push(i % 2 === 0 ? Math.min(i + 1, n - 1) : i - 1);
        break;
      default:
        return assertNever(cmd);
    }
  }
  return order;
}

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

/**
 * Expand a command into position-aware primitives. `index` is the figure the
 * command acts on right now; cancels produce no primitive (the plan resolver
 * removes them first) and reorder needs only the current figure count.
 */
export function expandCommand(cmd: CmdName, index: number, figureCount: number): Primitive[] {
  switch (cmd) {
    case 'FlipV':
      return [{ op: 'flipVAt', index }];
    case 'FlipH':
      return [{ op: 'flipHAt', index }];
    case 'Flip180':
      return [{ op: 'flip180At', index }];
    case 'DeletePrev':
      return index - 1 >= 0 ? [{ op: 'deleteAt', index: index - 1 }] : [];
    case 'DeleteNext':
      return index + 1 < figureCount ? [{ op: 'deleteAt', index: index + 1 }] : [];
    case 'SwapPrev':
      return [{ op: 'swapWithPrevAt', index }];
    case 'CancelPrevCommand':
    case 'CancelNextCommand':
      return [];
    case 'ReorderR':
    case 'ReorderS':
    case 'ReorderJ':
      return [{ op: 'reorder', order: reorderOrder(cmd, figureCount) }];
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
