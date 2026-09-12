// Commands generator: a start figure plus an ordered command list.
//
// The answer AND every distractor state come from `applyPrimitives`, the only
// interpreter of `Primitive`. Commands are drawn only from the pool whose effect
// is VISIBLE for the sampled main shape (square/circle ignore rotate and flip,
// triangle ignores flip), so every command in a problem changes the render. The
// `arrow` pool holds all nine `CmdName`s; all nine stay reachable across seeds at
// every difficulty.
//
// Distractor guarantee: `pickDistractors` dedupes by `visualKey` and falls back
// to toggleFill + moveMarker 1/2/3 slots (visible for every shape), so four
// distractors always exist even when the command list is a round trip and the
// answer equals `start` (e.g. Rotate180 applied twice).

import type { CmdName } from '../domain/recipe';
import { CMD_LABEL, expandCommand, sequenceOps } from '../domain/recipe';
import type { Difficulty, FigObj, FigureProblem, FigState, Rot, SkillTag } from '../domain/types';
import { Rng } from '../domain/rng';
import { applyPrimitives, figureKey } from '../domain/figure';
import { resolveDifficulty, sampleCommandLength } from './policy';
import { pickDistractors } from './distractors';

export interface CommandsOpts {
  seed: number;
  difficulty?: Difficulty;
}

type MainShape = Extract<FigObj['shape'], 'circle' | 'square' | 'triangle' | 'arrow'>;

const MAIN_SHAPES: readonly MainShape[] = ['circle', 'square', 'triangle', 'arrow'];
/** Commands that visibly change each shape (see `visualKey` in figure.ts). */
const COMMANDS_BY_SHAPE: Record<MainShape, readonly CmdName[]> = {
  arrow: [
    'Rotate90',
    'Rotate180',
    'FlipH',
    'FlipV',
    'ToggleFill',
    'SwapPos',
    'MoveMarker',
    'AddDot',
    'RemoveDot',
  ],
  triangle: ['Rotate90', 'Rotate180', 'ToggleFill', 'SwapPos', 'MoveMarker', 'AddDot', 'RemoveDot'],
  square: ['ToggleFill', 'SwapPos', 'MoveMarker', 'AddDot', 'RemoveDot'],
  circle: ['ToggleFill', 'SwapPos', 'MoveMarker', 'AddDot', 'RemoveDot'],
};

const START_ROTS: readonly Rot[] = [0, 90, 180, 270];
const PROMPT = '命令列を適用した最終図形を選べ';

function assertNever(x: never): never {
  throw new Error(`unexpected value: ${String(x)}`);
}

function commandCount(rng: Rng, difficulty: Difficulty): number {
  const bucket = sampleCommandLength(rng, difficulty);
  switch (bucket) {
    case '1-2':
      return rng.int(1, 2);
    case '3-4':
      return rng.int(3, 4);
    case '5+':
      return 5;
    default:
      return assertNever(bucket);
  }
}

function pickCommands(rng: Rng, difficulty: Difficulty, shape: MainShape): CmdName[] {
  const count = commandCount(rng, difficulty);
  const pool = COMMANDS_BY_SHAPE[shape];
  const commands: CmdName[] = [];
  for (let i = 0; i < count; i++) commands.push(rng.pick(pool));
  return commands;
}

/** Main shape near the left edge + one dot near the right, marker in slot 0. */
function buildStart(rng: Rng, shape: MainShape): FigState {
  const main: FigObj = {
    shape,
    x: 40,
    y: 50,
    rot: rng.pick(START_ROTS),
    fill: rng.chance(0.5),
    size: 22,
    flipH: false,
  };
  const dot: FigObj = { shape: 'dot', x: 80, y: 50, rot: 0, fill: true, size: 5, flipH: false };
  return { objects: [main, dot], markerPos: 0 };
}

function commandTags(commands: readonly CmdName[]): SkillTag[] {
  const tags = new Set<SkillTag>();
  for (const command of commands) {
    switch (command) {
      case 'Rotate90':
      case 'Rotate180':
        tags.add('cmd-rotate');
        break;
      case 'FlipH':
      case 'FlipV':
        tags.add('cmd-flip');
        break;
      case 'ToggleFill':
        tags.add('cmd-toggle');
        break;
      case 'SwapPos':
      case 'MoveMarker':
        tags.add('cmd-move');
        break;
      case 'AddDot':
      case 'RemoveDot':
        tags.add('count');
        break;
      default:
        return assertNever(command);
    }
  }
  if (commands.length >= 3) tags.add('composite-2');
  if (commands.length >= 5) tags.add('composite-3');
  return [...tags];
}

/**
 * Rule-grounded distractors, deduped by `visualKey` against the answer and each
 * other. The visible fallback perturbations always supply four states.
 */
function chooseDistractors(
  rng: Rng,
  start: FigState,
  answer: FigState,
  commands: readonly CmdName[],
): FigState[] {
  const primary: FigState[] = [
    // Whole list applied in reverse order.
    applyPrimitives(start, sequenceOps([...commands].reverse(), expandCommand)),
    // Last command dropped.
    applyPrimitives(start, sequenceOps(commands.slice(0, -1), expandCommand)),
    // The untouched start (typical "did nothing" error).
    applyPrimitives(start, []),
    // Correct sequence but rotated the wrong way.
    applyPrimitives(answer, [{ op: 'rotate', deg: 270 }]),
    // First command applied one extra time.
    applyPrimitives(answer, expandCommand(commands[0])),
  ];
  return pickDistractors(rng, answer, primary);
}

export function generateCommands(opts: CommandsOpts): FigureProblem {
  const rng = new Rng(opts.seed);
  const difficulty = resolveDifficulty(rng, opts.difficulty);
  const shape = rng.pick(MAIN_SHAPES);
  const commands = pickCommands(rng, difficulty, shape);
  const start = buildStart(rng, shape);
  const ops = sequenceOps(commands, expandCommand);
  const answer = applyPrimitives(start, ops);
  const choices = rng.shuffle([answer, ...chooseDistractors(rng, start, answer, commands)]);
  return {
    seed: opts.seed,
    subject: 'commands',
    difficulty,
    skillTags: commandTags(commands),
    explanation: `命令を上から順に適用する: ${commands
      .map((command) => CMD_LABEL[command])
      .join(' → ')}。逆順・一部省略・回転方向の誤りが典型的な誤答。`,
    fingerprint: JSON.stringify(['commands', difficulty, start, ops, choices]),
    prompt: PROMPT,
    start,
    ops,
    choices,
    correctIndex: choices.findIndex((choice) => figureKey(choice) === figureKey(answer)),
    commandLabels: commands.map((command) => CMD_LABEL[command]),
  };
}
