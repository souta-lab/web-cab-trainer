// Shared distractor machinery for the figure generators.
//
// Two answer choices may never look identical, so candidates are deduped by
// `visualKey` (render appearance) and never by `figureKey` (which keeps fields a
// symmetric shape ignores). `visiblePerturbations` guarantees that four visually
// distinct states always exist for ANY main shape:
//   - `toggleFill` changes fill, visible for every shape;
//   - `moveMarker` applied 1/2/3 times lands on three different corners, visible
//     for every shape;
//   - `rotate90`/`rotate270` add two more candidates for arrow/triangle and
//     collapse into the answer for square/circle, where `visualKey` dedupes them.
// The six results are pairwise visually distinct and differ from the answer.

import type { Rng } from '../domain/rng';
import { applyPrimitives, visualKey } from '../domain/figure';
import type { FigState } from '../domain/types';

export const DISTRACTOR_COUNT = 4;

/** Visually distinct perturbations of `answer` that work for every shape. */
export function visiblePerturbations(answer: FigState): FigState[] {
  return [
    applyPrimitives(answer, [{ op: 'toggleFill' }]),
    applyPrimitives(answer, [{ op: 'moveMarker', delta: 1 }]),
    applyPrimitives(answer, [
      { op: 'moveMarker', delta: 1 },
      { op: 'moveMarker', delta: 1 },
    ]),
    applyPrimitives(answer, [
      { op: 'moveMarker', delta: 1 },
      { op: 'moveMarker', delta: 1 },
      { op: 'moveMarker', delta: 1 },
    ]),
    applyPrimitives(answer, [{ op: 'rotate', deg: 90 }]),
    applyPrimitives(answer, [{ op: 'rotate', deg: 270 }]),
  ];
}

/**
 * Shuffle the rule-grounded `primary` candidates and the visible fallback, then
 * take the first `DISTRACTOR_COUNT` states that are distinct from the answer and
 * from each other by `visualKey`.
 */
export function pickDistractors(rng: Rng, answer: FigState, primary: readonly FigState[]): FigState[] {
  const seen = new Set<string>([visualKey(answer)]);
  const distractors: FigState[] = [];
  for (const candidate of [...rng.shuffle(primary), ...rng.shuffle(visiblePerturbations(answer))]) {
    if (distractors.length === DISTRACTOR_COUNT) break;
    const key = visualKey(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    distractors.push(candidate);
  }
  return distractors;
}
