// Pattern generator: builds a visible 5-frame sequence from DISTINCT rules and
// exposes one step as the question. Every frame comes from `applyPrimitives`,
// which is also the answer checker, so generation and grading cannot diverge.
//
// Shape/rule visibility: square and circle are rotation- and mirror-symmetric,
// so their only visible pattern rules are `move` and `fill-toggle`. The sampled
// rule count therefore selects the shape among those able to render that many
// distinct visible rules; capping the count instead would shift the rule-count
// distribution that `tests/pattern.prop.test.ts` asserts.

import type {
  Difficulty,
  FigObj,
  FigState,
  FigureProblem,
  Primitive,
  RotSlot,
  SkillTag,
} from '../domain/types';
import { Rng } from '../domain/rng';
import { CORNERS, applyPrimitives, figureKey } from '../domain/figure';
import { expandPatternRule, sequenceOps } from '../domain/recipe';
import type { PatternRule } from '../domain/recipe';
import { resolveDifficulty, samplePatternRuleCount } from './policy';
import { pickDistractors } from './distractors';

export interface PatternOpts {
  seed: number;
  difficulty?: Difficulty;
}

type RuleType = PatternRule['type'];
type MainShape = Extract<FigObj['shape'], 'circle' | 'square' | 'triangle' | 'arrow'>;

const ROT_DEGREES: readonly (90 | 180 | 270)[] = [90, 180, 270];
const MOVE_CYCLES: readonly ('corners-clockwise' | 'corners-counter')[] = [
  'corners-clockwise',
  'corners-counter',
];
const FLIP_AXES: readonly ('h' | 'v')[] = ['h', 'v'];
const MAIN_SHAPES: readonly MainShape[] = ['circle', 'square', 'triangle', 'arrow'];
/** Only the rules that visibly change each shape (see `visualKey` in figure.ts). */
const RULES_BY_SHAPE: Record<MainShape, readonly RuleType[]> = {
  arrow: ['rotate', 'move', 'fill-toggle', 'flip'],
  triangle: ['rotate', 'move', 'fill-toggle'],
  square: ['move', 'fill-toggle'],
  circle: ['move', 'fill-toggle'],
};
const SLOTS: readonly RotSlot[] = [0, 1, 2, 3];
const ROTATION_INVERSE: Record<90 | 180 | 270, 90 | 180 | 270> = {
  90: 270,
  180: 180,
  270: 90,
};
const FRAME_COUNT = 5;
const PROMPT = '空欄に入る図形を選べ';

function assertNever(x: never): never {
  throw new Error(`unexpected value: ${String(x)}`);
}

function makeRule(rng: Rng, type: RuleType): PatternRule {
  switch (type) {
    case 'rotate':
      return { type: 'rotate', degreesPerStep: rng.pick(ROT_DEGREES) };
    case 'move':
      return { type: 'move', cycle: rng.pick(MOVE_CYCLES) };
    case 'fill-toggle':
      return { type: 'fill-toggle' };
    case 'flip':
      return { type: 'flip', axis: rng.pick(FLIP_AXES) };
    default:
      return assertNever(type);
  }
}

/** One main shape sitting on a corner + one center dot; markerPos is that corner. */
function buildStart(rng: Rng, shape: MainShape): FigState {
  const markerPos = rng.pick(SLOTS);
  const corner = CORNERS[markerPos];
  const main: FigObj = {
    shape,
    x: corner.x,
    y: corner.y,
    rot: 0,
    fill: rng.chance(0.5),
    size: 22,
    flipH: false,
  };
  const dot: FigObj = { shape: 'dot', x: 60, y: 60, rot: 0, fill: true, size: 5, flipH: false };
  return { objects: [main, dot], markerPos };
}

function ruleTags(rules: readonly PatternRule[]): SkillTag[] {
  const tags: SkillTag[] = [];
  for (const rule of rules) {
    switch (rule.type) {
      case 'rotate':
        tags.push('rotation');
        break;
      case 'move':
        tags.push('movement');
        break;
      case 'fill-toggle':
        tags.push('fill-toggle');
        break;
      case 'flip':
        tags.push('reflection');
        break;
      default:
        return assertNever(rule);
    }
  }
  if (rules.length === 2) tags.push('composite-2');
  if (rules.length === 3) tags.push('composite-3');
  return tags;
}

function describeRule(rule: PatternRule): string {
  switch (rule.type) {
    case 'rotate':
      return `${rule.degreesPerStep}°回転`;
    case 'move':
      return rule.cycle === 'corners-counter' ? '反時計回りの位置移動' : '時計回りの位置移動';
    case 'fill-toggle':
      return '塗りの反転';
    case 'flip':
      return rule.axis === 'h' ? '左右反転' : '上下反転';
    default:
      return assertNever(rule);
  }
}

/** The step's rotation replayed in the opposite direction; 180° is its own inverse. */
function inverseRotationOps(rules: readonly PatternRule[]): Primitive[] {
  for (const rule of rules) {
    if (rule.type === 'rotate') {
      return [{ op: 'rotate', deg: ROTATION_INVERSE[rule.degreesPerStep] }];
    }
  }
  return [{ op: 'rotate', deg: 180 }];
}

export function generatePattern(opts: PatternOpts): FigureProblem {
  const rng = new Rng(opts.seed);
  const difficulty = resolveDifficulty(rng, opts.difficulty);
  const sampledRuleCount = samplePatternRuleCount(rng, difficulty);
  // A step applies `sampledRuleCount` DISTINCT rules, so the shape must own that
  // many visible rules. Sampling the count at the same point with the same
  // weights and choosing among eligible shapes keeps the distribution exact.
  const eligibleShapes = MAIN_SHAPES.filter(
    (shape) => RULES_BY_SHAPE[shape].length >= sampledRuleCount,
  );
  const shape = rng.pick(eligibleShapes);
  const ruleTypes = RULES_BY_SHAPE[shape];
  const ruleCount = Math.min(sampledRuleCount, ruleTypes.length);
  const rules = rng
    .shuffle(ruleTypes)
    .slice(0, ruleCount)
    .map((type) => makeRule(rng, type));
  const ops = sequenceOps(rules, expandPatternRule);

  const frames: FigState[] = [buildStart(rng, shape)];
  for (let i = 1; i < FRAME_COUNT; i++) frames.push(applyPrimitives(frames[i - 1], ops));

  const missingIndex = rng.int(1, 3);
  const answer = frames[missingIndex];
  const start = frames[missingIndex - 1];
  const answerKey = figureKey(answer);

  // Rule-grounded distractors. `pickDistractors` dedupes by visualKey and its
  // visible fallback guarantees four look-distinct choices for every shape.
  const primary: FigState[] = [
    applyPrimitives(start, sequenceOps(rules.slice(0, 1), expandPatternRule)),
    start,
    frames[missingIndex + 1],
    applyPrimitives(answer, inverseRotationOps(rules)),
  ];
  const distractors = pickDistractors(rng, answer, primary);

  const choices = rng.shuffle([answer, ...distractors]);
  return {
    seed: opts.seed,
    subject: 'pattern',
    difficulty,
    skillTags: ruleTags(rules),
    explanation: `各ステップで ${rules
      .map(describeRule)
      .join(' と ')} を同時に適用する。前後の図から変化を1つずつ確かめる。`,
    fingerprint: JSON.stringify(['pattern', difficulty, start, ops, choices]),
    prompt: PROMPT,
    start,
    ops,
    choices,
    correctIndex: choices.findIndex((choice) => figureKey(choice) === answerKey),
    frames,
    missingIndex,
  };
}
