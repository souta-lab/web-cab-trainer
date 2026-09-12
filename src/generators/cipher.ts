import { Rng } from '../utils/rng';
import type { Difficulty, FigObj, FigState, FigureProblem, SkillTag } from '../types';

export type CipherRule =
  | { type: 'rotation'; degrees: 90 | 180 | 270 }
  | { type: 'fill' }
  | { type: 'flip'; axis: 'h' | 'v' }
  | { type: 'inside-outside' }
  | { type: 'move' }
  | { type: 'add-dot' };

function clone<T>(v: T): T { return JSON.parse(JSON.stringify(v)) as T; }

export function applyCipher(s: FigState, rules: CipherRule[]): FigState {
  const next = clone(s);
  const main = next.objects[0];
  for (const r of rules) {
    if (r.type === 'rotation') main.rot = (((main.rot + r.degrees) % 360) as FigObj['rot']);
    else if (r.type === 'fill') main.fill = !main.fill;
    else if (r.type === 'flip') {
      if (r.axis === 'h') main.flipH = !main.flipH;
      else main.rot = (((main.rot + 180) % 360) as FigObj['rot']);
    } else if (r.type === 'inside-outside') {
      if (next.objects.length >= 2) {
        const [a, b] = [next.objects[0], next.objects[1]];
        const t = { x: a.x, y: a.y, size: a.size };
        a.x = b.x; a.y = b.y;
        b.x = t.x; b.y = t.y;
      } else {
        main.x = main.x === 40 ? 80 : 40;
      }
    } else if (r.type === 'move') {
      next.markerPos = ((next.markerPos ?? 0) + 1) % 4;
      main.x = main.x === 40 ? 80 : 40;
    } else if (r.type === 'add-dot') {
      next.objects.push({ shape: 'dot', x: 60, y: 85, rot: 0, fill: true, size: 5 });
    }
  }
  return next;
}

function randomInput(rng: Rng): FigState {
  return {
    objects: [
      { shape: rng.pick(['circle', 'square', 'triangle', 'arrow'] as const), x: 40, y: 50, rot: rng.pick([0, 90, 180, 270] as const), fill: rng.chance(0.5), size: 22 },
      { shape: rng.pick(['dot', 'square', 'circle'] as const), x: 80, y: 50, rot: 0, fill: rng.chance(0.5), size: 10 },
    ],
    markerPos: 0,
  };
}

function pickRules(rng: Rng, difficulty: Difficulty): CipherRule[] {
  const multi = difficulty === 1 ? rng.next() < 0.15 : difficulty === 2 ? rng.next() < 0.4 : rng.next() < 0.65;
  const pool: CipherRule[] = [
    { type: 'rotation', degrees: rng.pick([90, 180, 270] as const) },
    { type: 'fill' },
    { type: 'flip', axis: rng.pick(['h', 'v'] as const) },
    { type: 'inside-outside' },
    { type: 'move' },
  ];
  const n = multi ? (difficulty === 3 && rng.chance(0.3) ? 3 : 2) : 1;
  return rng.shuffle(pool).slice(0, n);
}

function stateKey(s: FigState): string {
  return s.objects.map((o) => `${o.shape},${o.x},${o.y},${o.rot},${o.fill}`).join('|');
}

function ruleDesc(rules: CipherRule[]): string {
  return rules.map((r) => r.type === 'rotation' ? `${r.degrees}°回転` : r.type === 'fill' ? '塗り反転' : r.type === 'flip' ? '反転' : r.type === 'inside-outside' ? '内外交換' : '位置移動').join('＋');
}

export function generateCipher(opts: { seed: number; difficulty?: Difficulty }): FigureProblem {
  const rng = new Rng(opts.seed);
  const difficulty = opts.difficulty ?? ((rng.int(1, 3)) as Difficulty);
  const rules = pickRules(rng, difficulty);
  const inA = randomInput(rng);
  const outA = applyCipher(inA, rules);
  let inB = randomInput(rng);
  let guard = 0;
  while (stateKey(inB) === stateKey(inA) && guard++ < 10) inB = randomInput(rng);
  const answer = applyCipher(inB, rules);
  // distractors: partial rule application
  const cands: FigState[] = [];
  if (rules.length > 1) {
    cands.push(applyCipher(inB, rules.slice(0, 1)));
    cands.push(applyCipher(inB, rules.slice(1)));
  }
  cands.push(clone(inB));
  const wrong = clone(answer);
  if (wrong.objects[0]) wrong.objects[0].rot = (((wrong.objects[0].rot + 90) % 360) as FigObj['rot']);
  cands.push(wrong);
  const nofill = clone(answer);
  if (nofill.objects[0]) nofill.objects[0].fill = !nofill.objects[0].fill;
  cands.push(nofill);
  cands.push(applyCipher(inB, [...rules].reverse()));

  const seen = new Set([stateKey(answer)]);
  const choices: FigState[] = [];
  for (const c of rng.shuffle(cands)) {
    const k = stateKey(c);
    if (seen.has(k)) continue;
    seen.add(k);
    choices.push(c);
    if (choices.length === 4) break;
  }
  let g2 = 0;
  while (choices.length < 4 && g2++ < 20) {
    const v = clone(answer);
    v.objects[0].x += g2 * 2;
    const k = stateKey(v) + g2;
    if (seen.has(k)) continue;
    seen.add(k);
    choices.push(v);
  }
  const all = rng.shuffle([answer, ...choices]);
  const tags: SkillTag[] = rules.length > 1 ? ['cipher-multi', 'composite-2'] : ['cipher-single'];
  return {
    seed: opts.seed, subject: 'cipher', difficulty, skillTags: tags,
    explanation: `例Aから規則「${ruleDesc(rules)}」を抽出し、入力Bに同じ変換を適用する。部分適用が典型誤答。`,
    fingerprint: `cipher|${rules.map((r) => r.type).join('+')}`,
    frames: [inB], missingIndex: 0, choices: all,
    correctIndex: all.indexOf(answer),
    prompt: '例と同じ変換を入力Bに適用した図形を選べ',
    examples: [{ input: inA, output: outA }],
    start: inB,
  };
}
