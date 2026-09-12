// Cipher generator: a worked example (Input A → Output A) plus an unseen
// Input B; the solver must infer the rule and apply it to B.
//
// The rule set is the rich `CipherRule` description; `expandCipherRule` maps it
// to the shared `Primitive` ops, and every state is produced by
// `applyPrimitives`, so generation and grading cannot diverge.
//
// Inputs are CONSTRUCTED so every rule is visible:
//   - two objects at different positions (40,50) and (80,50) make
//     `inside-outside` (swapObjects) always observable;
//   - the marker starts in slot 0 and no rule is a no-op on these inputs, so
//     every composition changes the state: answer !== start is guaranteed.
// Rule types are filtered per main shape (square/circle ignore rotation and
// flip, triangle ignores flip), so every rule in a composition changes the
// render. `inB` is made distinct from `inA` by figureKey with a deterministic,
// seed-derived tweak (no retries that would shift the recorded seed).

import type { CipherRule } from '../domain/recipe';
import { expandCipherRule, sequenceOps } from '../domain/recipe';
import type { Difficulty, FigObj, FigureProblem, FigState, Primitive, Rot, SkillTag } from '../domain/types';
import { Rng } from '../domain/rng';
import { applyPrimitives, figureKey } from '../domain/figure';
import { resolveDifficulty, sampleCipherComposition } from './policy';
import { pickDistractors } from './distractors';

export interface CipherOpts {
  seed: number;
  difficulty?: Difficulty;
}

type CipherRuleType = CipherRule['type'];
type MainShape = Extract<FigObj['shape'], 'circle' | 'square' | 'triangle' | 'arrow'>;

const ROT_DEGREES: readonly (90 | 180 | 270)[] = [90, 180, 270];
const FLIP_AXES: readonly ('h' | 'v')[] = ['h', 'v'];
const MAIN_SHAPES: readonly MainShape[] = ['circle', 'square', 'triangle', 'arrow'];
/** Only the rules that visibly change each shape (see `visualKey` in figure.ts). */
const RULES_BY_SHAPE: Record<MainShape, readonly CipherRuleType[]> = {
  arrow: ['rotation', 'fill', 'flip', 'inside-outside', 'move', 'add-dot'],
  triangle: ['rotation', 'fill', 'inside-outside', 'move', 'add-dot'],
  square: ['fill', 'inside-outside', 'move', 'add-dot'],
  circle: ['fill', 'inside-outside', 'move', 'add-dot'],
};
const SECOND_SHAPES: readonly FigObj['shape'][] = ['dot', 'square'];
const START_ROTS: readonly Rot[] = [0, 90, 180, 270];
const PROMPT = '例と同じ変換を入力Bに適用した図形を選べ';
const MAX_RULES = 3;

function assertNever(x: never): never {
  throw new Error(`unexpected value: ${String(x)}`);
}

function makeRule(rng: Rng, type: CipherRuleType): CipherRule {
  switch (type) {
    case 'rotation':
      return { type: 'rotation', degrees: rng.pick(ROT_DEGREES) };
    case 'fill':
      return { type: 'fill' };
    case 'flip':
      return { type: 'flip', axis: rng.pick(FLIP_AXES) };
    case 'inside-outside':
      return { type: 'inside-outside' };
    case 'move':
      return { type: 'move' };
    case 'add-dot':
      return { type: 'add-dot' };
    default:
      return assertNever(type);
  }
}

function pickRules(rng: Rng, difficulty: Difficulty, ruleTypes: readonly CipherRuleType[]): CipherRule[] {
  const composition = sampleCipherComposition(rng, difficulty);
  const count =
    composition === 'single' ? 1 : difficulty === 3 && rng.chance(0.3) ? MAX_RULES : 2;
  return rng
    .shuffle(ruleTypes)
    .slice(0, count)
    .map((type) => makeRule(rng, type));
}

/** Main object at (40,50) + a second object at (80,50), marker in slot 0. */
function randomInput(rng: Rng, mainShape: MainShape): FigState {
  const main: FigObj = {
    shape: mainShape,
    x: 40,
    y: 50,
    rot: rng.pick(START_ROTS),
    fill: rng.chance(0.5),
    size: 22,
    flipH: false,
  };
  const second: FigObj = {
    shape: rng.pick(SECOND_SHAPES),
    x: 80,
    y: 50,
    rot: 0,
    fill: rng.chance(0.5),
    size: 10,
    flipH: false,
  };
  return { objects: [main, second], markerPos: 0 };
}

/** Same distribution as `randomInput`, guaranteed different from `other`. */
function randomInputDistinctFrom(rng: Rng, other: FigState, mainShape: MainShape): FigState {
  const base = randomInput(rng, mainShape);
  if (figureKey(base) !== figureKey(other)) return base;
  const main = base.objects[0];
  if (main === undefined) return base;
  return { objects: [{ ...main, fill: !main.fill }, ...base.objects.slice(1)], markerPos: base.markerPos };
}

function describeRule(rule: CipherRule): string {
  switch (rule.type) {
    case 'rotation':
      return `${rule.degrees}°回転`;
    case 'fill':
      return '塗りの反転';
    case 'flip':
      return rule.axis === 'h' ? '左右反転' : '上下反転';
    case 'inside-outside':
      return '内外交換';
    case 'move':
      return '位置移動';
    case 'add-dot':
      return '点の追加';
    default:
      return assertNever(rule);
  }
}

/**
 * Rule-grounded distractors: partial replay, reversed replay, the untouched
 * input, wrong rotation and a forgotten fill. Deduped by `visualKey`, with the
 * visible fallback guaranteeing four states for any shape.
 */
function chooseDistractors(
  rng: Rng,
  inB: FigState,
  answer: FigState,
  ops: readonly Primitive[],
): FigState[] {
  const primary: FigState[] = [
    // Only the first rule applied.
    applyPrimitives(inB, ops.slice(0, 1)),
    // All but the last rule applied.
    applyPrimitives(inB, ops.slice(0, -1)),
    // Rules applied in reverse order.
    applyPrimitives(inB, [...ops].reverse()),
    // The untouched input.
    applyPrimitives(inB, []),
    // Correct answer, wrong rotation.
    applyPrimitives(answer, [{ op: 'rotate', deg: 270 }]),
    // Correct answer, forgotten fill toggle.
    applyPrimitives(answer, [{ op: 'toggleFill' }]),
  ];
  return pickDistractors(rng, answer, primary);
}

export function generateCipher(opts: CipherOpts): FigureProblem {
  const rng = new Rng(opts.seed);
  const difficulty = resolveDifficulty(rng, opts.difficulty);
  const mainShape = rng.pick(MAIN_SHAPES);
  const rules = pickRules(rng, difficulty, RULES_BY_SHAPE[mainShape]);
  const ops = sequenceOps(rules, expandCipherRule);

  const inA = randomInput(rng, mainShape);
  const outA = applyPrimitives(inA, ops);
  const inB = randomInputDistinctFrom(rng, inA, mainShape);
  const answer = applyPrimitives(inB, ops);

  const choices = rng.shuffle([answer, ...chooseDistractors(rng, inB, answer, ops)]);

  const tags: SkillTag[] = rules.length > 1 ? ['cipher-multi', 'composite-2'] : ['cipher-single'];
  return {
    seed: opts.seed,
    subject: 'cipher',
    difficulty,
    skillTags: tags,
    explanation: `例A→出力Aの変化から規則「${rules
      .map(describeRule)
      .join('＋')}」を読み取り、入力Bに同じ順序で適用する。一部だけの適用・逆順適用が典型的な誤答。`,
    fingerprint: JSON.stringify(['cipher', difficulty, inB, ops, choices]),
    prompt: PROMPT,
    start: inB,
    ops,
    choices,
    correctIndex: choices.findIndex((choice) => figureKey(choice) === figureKey(answer)),
    examples: [{ input: inA, output: outA }],
  };
}
