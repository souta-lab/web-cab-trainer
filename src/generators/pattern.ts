import { Rng } from '../utils/rng';
import type { Difficulty, FigObj, FigState, FigureProblem, SkillTag } from '../types';

export type PatternRule =
  | { type: 'rotate'; degreesPerStep: 90 | 180 | 270 }
  | { type: 'move'; cycle: 'corners-clockwise' | 'corners-counter' | 'horizontal' }
  | { type: 'fill-toggle' }
  | { type: 'flip'; axis: 'h' | 'v' };

const CORNERS: [number, number][] = [[30, 30], [90, 30], [90, 90], [30, 90]];

function baseState(rng: Rng): FigState {
  const shape = rng.pick(['circle', 'square', 'triangle', 'arrow'] as const);
  const ci = rng.int(0, 3);
  const [x, y] = CORNERS[ci];
  const objs: FigObj[] = [
    { shape, x, y, rot: 0, fill: rng.chance(0.5), size: 22 },
    { shape: 'dot', x: 60, y: 60, rot: 0, fill: true, size: 5 },
  ];
  return { objects: objs, markerPos: ci };
}

export function applyPatternRule(s: FigState, rule: PatternRule): FigState {
  const objects = s.objects.map((o) => ({ ...o }));
  const main = objects[0];
  const next: FigState = { objects, markerPos: s.markerPos };
  if (rule.type === 'rotate') {
    main.rot = (((main.rot + rule.degreesPerStep) % 360) as FigObj['rot']);
  } else if (rule.type === 'move') {
    let ci = next.markerPos ?? 0;
    if (rule.cycle === 'corners-clockwise') ci = (ci + 1) % 4;
    else if (rule.cycle === 'corners-counter') ci = (ci + 3) % 4;
    else ci = ci % 2 === 0 ? ci + 1 : ci - 1;
    next.markerPos = ci;
    const [x, y] = CORNERS[ci];
    main.x = x; main.y = y;
  } else if (rule.type === 'fill-toggle') {
    main.fill = !main.fill;
  } else if (rule.type === 'flip') {
    if (rule.axis === 'h') main.flipH = !main.flipH;
    else main.rot = (((main.rot + 180) % 360) as FigObj['rot']);
  }
  return next;
}

function pickRules(rng: Rng, difficulty: Difficulty): PatternRule[] {
  // research distribution: 1-rule 25% / 2-rule 58% / 3-rule 17%
  const r = rng.next();
  let n = 2;
  if (difficulty === 1) n = r < 0.55 ? 1 : 2;
  else if (difficulty === 2) n = r < 0.2 ? 1 : r < 0.8 ? 2 : 3;
  else n = r < 0.1 ? 1 : r < 0.6 ? 2 : 3;
  const pool: PatternRule[] = [
    { type: 'rotate', degreesPerStep: rng.pick([90, 90, 180, 270] as const) },
    { type: 'move', cycle: rng.pick(['corners-clockwise', 'corners-counter', 'horizontal'] as const) },
    { type: 'fill-toggle' },
    { type: 'flip', axis: rng.pick(['h', 'v'] as const) },
  ];
  return rng.shuffle(pool).slice(0, n);
}

function ruleTags(rules: PatternRule[]): SkillTag[] {
  const tags: SkillTag[] = [];
  for (const r of rules) {
    if (r.type === 'rotate') tags.push('rotation');
    else if (r.type === 'move') tags.push('movement');
    else if (r.type === 'fill-toggle') tags.push('fill-toggle');
    else tags.push('reflection');
  }
  if (rules.length >= 3) tags.push('composite-3');
  else if (rules.length === 2) tags.push('composite-2');
  return tags;
}

function stateKey(s: FigState): string {
  return s.objects.map((o) => `${o.shape},${o.x},${o.y},${o.rot},${o.fill},${o.flipH ? 1 : 0}`).join('|') + `#${s.markerPos}`;
}

export function generatePattern(opts: { seed: number; difficulty?: Difficulty }): FigureProblem {
  const rng = new Rng(opts.seed);
  const difficulty = opts.difficulty ?? ((rng.int(1, 3)) as Difficulty);
  const rules = pickRules(rng, difficulty);
  const frames: FigState[] = [baseState(rng)];
  for (let i = 1; i < 5; i++) {
    let s = frames[i - 1];
    for (const r of rules) s = applyPatternRule(s, r);
    frames.push(s);
  }
  const missingIndex = rng.int(1, 3);
  const answer = frames[missingIndex];
  // distractors: plausible human errors
  const candPool: FigState[] = [];
  // 1-step off (prev/next state)
  candPool.push(frames[Math.max(0, missingIndex - 1)]);
  candPool.push(frames[Math.min(4, missingIndex + 1)]);
  // partial rule: apply only first rule to prev frame
  let partial = frames[missingIndex - 1] ?? frames[0];
  partial = applyPatternRule(structuredCloneFallback(partial), rules[0]);
  candPool.push(partial);
  // reverse rotation variant
  const rev = structuredCloneFallback(answer);
  if (rev.objects[0]) rev.objects[0].rot = (((rev.objects[0].rot + 180) % 360) as FigObj['rot']);
  candPool.push(rev);
  // fill-forgot variant
  const nofill = structuredCloneFallback(answer);
  if (nofill.objects[0]) nofill.objects[0].fill = !nofill.objects[0].fill;
  candPool.push(nofill);
  // wrong position variant
  const wrongPos = structuredCloneFallback(answer);
  if (wrongPos.objects[0]) {
    wrongPos.objects[0].x = wrongPos.objects[0].x === 30 ? 90 : 30;
    wrongPos.markerPos = ((wrongPos.markerPos ?? 0) + 2) % 4;
  }
  candPool.push(wrongPos);
  const seen = new Set([stateKey(answer)]);
  const choices: FigState[] = [];
  for (const c of rng.shuffle(candPool)) {
    const k = stateKey(c);
    if (seen.has(k)) continue;
    seen.add(k);
    choices.push(c);
    if (choices.length === 4) break;
  }
  while (choices.length < 4) {
    const v = structuredCloneFallback(answer);
    v.objects[0].size += 3 + choices.length;
    const k = stateKey(v) + choices.length;
    if (seen.has(k)) continue;
    seen.add(k);
    choices.push(v);
  }
  const all = rng.shuffle([answer, ...choices]);
  const correctIndex = all.indexOf(answer);
  const ruleDesc = rules.map((r) => r.type === 'rotate' ? `${r.degreesPerStep}°回転` : r.type === 'move' ? '位置循環' : r.type === 'fill-toggle' ? '塗り反転' : '反転').join('＋');
  return {
    seed: opts.seed, subject: 'pattern', difficulty, skillTags: ruleTags(rules),
    explanation: `各ステップで${ruleDesc}が同時に適用される。前後図を比べて変化軸を分離する。`,
    fingerprint: `pattern|${rules.map((r) => r.type).join('+')}|${missingIndex}`,
    frames, missingIndex, choices: all, correctIndex,
    prompt: '空欄に入る図形を選べ',
  };
}

function structuredCloneFallback<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
