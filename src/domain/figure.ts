// Figure semantics: the SINGLE interpreter of figure operations.
//
// `applyPrimitives` is the only place a `Primitive` is interpreted. Generators
// produce `(start, ops)` and both generation and answer-checking call this
// function, so they can never diverge. Everything here is pure and total.

import type { FigObj, FigState, Primitive, Rot, RotSlot } from './types';

export type { Rot, RotSlot } from './types';

export interface Corner {
  readonly x: number;
  readonly y: number;
}

/** Shared corner table (clockwise from top-left). Marker slots index into it. */
export const CORNERS: readonly [Corner, Corner, Corner, Corner] = [
  { x: 30, y: 30 },
  { x: 90, y: 30 },
  { x: 90, y: 90 },
  { x: 30, y: 90 },
];

const QUARTER_TURNS = [0, 90, 180, 270] as const;
const SLOTS = [0, 1, 2, 3] as const;

/**
 * Normalize any integer to a quarter-turn rotation.
 *
 * For multiples of 90 this equals `((n % 360) + 360) % 360`. Non-multiples are
 * snapped to the nearest quarter turn so the function is TOTAL over integers
 * (it never throws and always returns one of the four `Rot` values).
 */
export function normalizeRot(n: number): Rot {
  const i = ((Math.round(n / 90) % 4) + 4) % 4;
  return QUARTER_TURNS[i];
}

/** Normalize any integer to a marker slot 0..3. */
export function normalizeSlot(n: number): RotSlot {
  const i = ((Math.trunc(n) % 4) + 4) % 4;
  return SLOTS[i];
}

export function cloneFigure(s: FigState): FigState {
  return { objects: s.objects.map((o) => ({ ...o })), markerPos: s.markerPos };
}

/**
 * Canonical structural key over every `FigObj` field, array order and
 * markerPos. Distinct structure yields a distinct key; render-equality is
 * `visualKey`'s job (fields a symmetric shape ignores stay in this key).
 */
export function figureKey(s: FigState): string {
  return JSON.stringify([
    s.objects.map((o) => [o.shape, o.x, o.y, o.rot, o.fill ? 1 : 0, o.size, o.flipH ? 1 : 0]),
    s.markerPos,
  ]);
}

export function figuresEqual(a: FigState, b: FigState): boolean {
  return figureKey(a) === figureKey(b);
}

/**
 * The marker slot that is actually drawn, or `null` when no marker is shown.
 * A slot-0 marker is ambiguous with "absent", so it is shown only when the main
 * object sits on corner 0 (the generators' convention). Shared with Figure.
 */
export function markerSlotShown(s: FigState): RotSlot | null {
  const main = mainObject(s);
  if (!main) return null;
  if (s.markerPos !== 0) return s.markerPos;
  const corner = CORNERS[0];
  return main.x === corner.x && main.y === corner.y ? 0 : null;
}

function objectAppearance(o: FigObj): readonly (string | number)[] {
  switch (o.shape) {
    case 'dot':
      return ['dot', o.x, o.y, o.size];
    case 'circle':
    case 'square':
      return [o.shape, o.x, o.y, o.fill ? 1 : 0, o.size];
    case 'triangle':
      return ['triangle', o.x, o.y, o.fill ? 1 : 0, o.size, o.rot];
    case 'line':
      return ['line', o.x, o.y, o.size, o.rot];
    case 'arrow': {
      const rot = o.flipH ? normalizeRot(o.rot + 180) : o.rot;
      return ['arrow', o.x, o.y, o.fill ? 1 : 0, o.size, rot];
    }
    default:
      return assertNever(o.shape);
  }
}

/**
 * Appearance key: two states render identically iff their visual keys match.
 * It mirrors what Figure draws: fields invisible for a symmetric shape are
 * dropped, `(rot, flip)` is folded to `rot+180`, dot fill is forced, and the
 * rendered marker slot is included.
 */
export function visualKey(s: FigState): string {
  return JSON.stringify([s.objects.map(objectAppearance), markerSlotShown(s)]);
}

export function visuallyEqual(a: FigState, b: FigState): boolean {
  return visualKey(a) === visualKey(b);
}

export function mainObject(s: FigState): FigObj | undefined {
  const [first] = s.objects;
  return first;
}

/**
 * Apply ops left-to-right. Pure and immutable: `s` is never mutated, and an
 * empty `objects` array is valid (main-less ops are no-ops, not errors).
 */
export function applyPrimitives(s: FigState, ops: readonly Primitive[]): FigState {
  let next = cloneFigure(s);
  for (const op of ops) next = applyOne(next, op);
  return next;
}

function applyOne(state: FigState, op: Primitive): FigState {
  const objects: FigObj[] = state.objects.map((o) => ({ ...o }));
  let markerPos = state.markerPos;
  const main: FigObj | undefined = objects[0];
  switch (op.op) {
    case 'rotate':
      if (main) main.rot = normalizeRot(main.rot + op.deg);
      break;
    case 'flipH':
      if (main) main.flipH = !main.flipH;
      break;
    case 'flipV':
      // Vertical flip: 180° rotation + horizontal mirror (matches legacy FlipV).
      if (main) {
        main.rot = normalizeRot(main.rot + 180);
        main.flipH = !main.flipH;
      }
      break;
    case 'toggleFill':
      if (main) main.fill = !main.fill;
      break;
    case 'move':
      if (main) {
        main.x += op.dx;
        main.y += op.dy;
      }
      break;
    case 'moveMarker': {
      markerPos = normalizeSlot(markerPos + op.delta);
      if (main) {
        const corner = CORNERS[markerPos];
        main.x = corner.x;
        main.y = corner.y;
      }
      break;
    }
    case 'swapObjects':
      if (objects.length >= 2) {
        const a = objects[0];
        const b = objects[1];
        const ax = a.x;
        const ay = a.y;
        a.x = b.x;
        a.y = b.y;
        b.x = ax;
        b.y = ay;
      }
      break;
    case 'addDot':
      objects.push({ shape: 'dot', x: op.x, y: op.y, rot: 0, fill: true, size: 5, flipH: false });
      break;
    case 'removeDot': {
      const i = objects.findIndex((o) => o.shape === 'dot');
      if (i >= 0) objects.splice(i, 1);
      break;
    }
    case 'flipVAt': {
      const target = objects[op.index];
      if (target) {
        target.rot = normalizeRot(target.rot + 180);
        target.flipH = !target.flipH;
      }
      break;
    }
    case 'flipHAt': {
      const target = objects[op.index];
      if (target) target.flipH = !target.flipH;
      break;
    }
    case 'flip180At': {
      const target = objects[op.index];
      if (target) target.rot = normalizeRot(target.rot + 180);
      break;
    }
    case 'deleteAt':
      if (op.index >= 0 && op.index < objects.length) objects.splice(op.index, 1);
      break;
    case 'swapWithPrevAt': {
      const a = objects[op.index];
      const b = objects[op.index - 1];
      if (a && b) {
        const ax = a.x;
        const ay = a.y;
        a.x = b.x;
        a.y = b.y;
        b.x = ax;
        b.y = ay;
      }
      break;
    }
    case 'reorder': {
      if (op.order.length !== objects.length) break;
      const reordered: FigObj[] = [];
      for (let i = 0; i < op.order.length; i++) {
        const source = objects[op.order[i]];
        const slot = objects[i];
        if (!source || !slot) break;
        reordered.push({ ...source, x: slot.x, y: slot.y });
      }
      if (reordered.length === objects.length) return { objects: reordered, markerPos };
      break;
    }
    default:
      return assertNever(op);
  }
  return { objects, markerPos };
}

function assertNever(x: never): never {
  throw new Error(`unexpected primitive: ${JSON.stringify(x)}`);
}
