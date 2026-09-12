import { Rng } from '../utils/rng';
import type { Difficulty, FigObj, FigState, FigureProblem, SkillTag } from '../types';

export type CmdName =
  | 'Rotate90' | 'Rotate180' | 'FlipH' | 'FlipV'
  | 'ToggleFill' | 'SwapPos' | 'MoveMarker' | 'AddDot' | 'RemoveDot';

export const CMD_LABEL: Record<CmdName, string> = {
  Rotate90: '◐90°', Rotate180: '◑180°', FlipH: '⇋反転', FlipV: '⇅反転',
  ToggleFill: '◉塗替', SwapPos: '⇄交換', MoveMarker: '↻移動',
  AddDot: '＋点', RemoveDot: '－点',
};

export function applyCommand(s: FigState, cmd: CmdName): FigState {
  const objects = s.objects.map((o) => ({ ...o }));
  const main = objects[0];
  const next: FigState = { objects, markerPos: s.markerPos };
  switch (cmd) {
    case 'Rotate90':
      main.rot = (((main.rot + 90) % 360) as FigObj['rot']);
      break;
    case 'Rotate180':
      main.rot = (((main.rot + 180) % 360) as FigObj['rot']);
      break;
    case 'FlipH':
      main.flipH = !main.flipH;
      break;
    case 'FlipV':
      main.rot = (((main.rot + 180) % 360) as FigObj['rot']);
      main.flipH = !main.flipH;
      break;
    case 'ToggleFill':
      main.fill = !main.fill;
      break;
    case 'SwapPos': {
      if (objects.length >= 2) {
        const [ax, ay] = [objects[0].x, objects[0].y];
        objects[0].x = objects[1].x; objects[0].y = objects[1].y;
        objects[1].x = ax; objects[1].y = ay;
      }
      break;
    }
    case 'MoveMarker':
      next.markerPos = ((next.markerPos ?? 0) + 1) % 4;
      break;
    case 'AddDot':
      objects.push({ shape: 'dot', x: 60, y: 60, rot: 0, fill: true, size: 5 });
      break;
    case 'RemoveDot': {
      const i = objects.findIndex((o) => o.shape === 'dot');
      if (i >= 0) objects.splice(i, 1);
      break;
    }
  }
  return next;
}

export function applyCommands(s: FigState, cmds: CmdName[]): FigState {
  return cmds.reduce((acc, c) => applyCommand(acc, c), s);
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function stateKey(s: FigState): string {
  return s.objects.map((o) => `${o.shape},${o.x},${o.y},${o.rot},${o.fill},${o.flipH ? 1 : 0}`).join('|') + `#${s.markerPos}:${s.objects.length}`;
}

function cmdTags(cmds: CmdName[]): SkillTag[] {
  const tags = new Set<SkillTag>();
  for (const c of cmds) {
    if (c === 'Rotate90' || c === 'Rotate180') tags.add('cmd-rotate');
    else if (c === 'FlipH' || c === 'FlipV') tags.add('cmd-flip');
    else if (c === 'ToggleFill') tags.add('cmd-toggle');
    else if (c === 'MoveMarker' || c === 'SwapPos') tags.add('cmd-move');
    else tags.add('count');
  }
  if (cmds.length >= 3) tags.add('composite-2');
  if (cmds.length >= 5) tags.add('composite-3');
  return [...tags];
}

export function generateCommands(opts: { seed: number; difficulty?: Difficulty }): FigureProblem {
  const rng = new Rng(opts.seed);
  const difficulty = opts.difficulty ?? ((rng.int(1, 3)) as Difficulty);
  const cmdLen = difficulty === 1 ? rng.int(1, 2) : difficulty === 2 ? rng.int(3, 4) : rng.int(4, 5);
  const pool: CmdName[] = difficulty === 1
    ? ['Rotate90', 'ToggleFill', 'MoveMarker', 'FlipH']
    : ['Rotate90', 'Rotate180', 'FlipH', 'FlipV', 'ToggleFill', 'SwapPos', 'MoveMarker', 'AddDot'];
  const cmds: CmdName[] = [];
  for (let i = 0; i < cmdLen; i++) cmds.push(rng.pick(pool));
  const start: FigState = {
    objects: [
      { shape: rng.pick(['circle', 'square', 'triangle', 'arrow'] as const), x: 40, y: 50, rot: 0, fill: rng.chance(0.5), size: 22 },
      { shape: 'dot', x: 80, y: 50, rot: 0, fill: true, size: 5 },
    ],
    markerPos: 0,
  };
  const answer = applyCommands(clone(start), cmds);
  // distractors: single-command, reverse order, forgot-toggle, prev-state
  const cands: FigState[] = [];
  cands.push(applyCommands(clone(start), cmds.slice(0, Math.max(1, cmds.length - 1))));
  cands.push(applyCommands(clone(start), [...cmds].reverse()));
  cands.push(clone(start));
  // forgot last toggle/rotate
  const partial = cmds.filter((c, i) => !(i === cmds.length - 1 && (c === 'ToggleFill' || c === 'Rotate90')));
  cands.push(applyCommands(clone(start), partial.length ? partial : cmds.slice(0, -1)));
  // wrong rotation direction
  const wrong = clone(answer);
  if (wrong.objects[0]) wrong.objects[0].rot = (((wrong.objects[0].rot + 90) % 360) as FigObj['rot']);
  cands.push(wrong);
  // next-state (apply first cmd twice)
  cands.push(applyCommand(clone(answer), cmds[0]));

  const seen = new Set([stateKey(answer)]);
  const choices: FigState[] = [];
  for (const c of rng.shuffle(cands)) {
    const k = stateKey(c);
    if (seen.has(k)) continue;
    seen.add(k);
    choices.push(c);
    if (choices.length === 4) break;
  }
  let guard = 0;
  while (choices.length < 4 && guard++ < 40) {
    const v = clone(answer);
    v.objects[0].x = (answer.objects[0].x + guard * 13) % 110 + 5;
    v.objects[0].rot = (((answer.objects[0].rot + guard * 90) % 360) as FigObj['rot']);
    v.objects[0].fill = guard % 2 === 0 ? !answer.objects[0].fill : answer.objects[0].fill;
    v.markerPos = ((answer.markerPos ?? 0) + guard) % 4;
    const k = stateKey(v);
    if (seen.has(k)) continue;
    seen.add(k);
    choices.push(v);
  }
  const all = rng.shuffle([answer, ...choices]);
  return {
    seed: opts.seed, subject: 'commands', difficulty, skillTags: cmdTags(cmds),
    explanation: `命令を上から順に適用: ${cmds.map((c) => CMD_LABEL[c]).join(' → ')}。逆順・省略が典型誤答。`,
    fingerprint: `commands|${cmds.join(',')}`,
    frames: [start, answer], missingIndex: 1, choices: all,
    correctIndex: all.indexOf(answer),
    prompt: '命令列を適用した最終図形を選べ',
    commandSeq: cmds.map((c) => CMD_LABEL[c]),
    start,
  };
}
