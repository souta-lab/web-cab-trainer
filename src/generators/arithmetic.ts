import { Rng } from '../utils/rng';
import type { ArithmeticProblem, Difficulty, SkillTag } from '../types';

const round2 = (n: number) => Math.round(n * 100) / 100;

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(round2(n));
}

export interface ArithOpts { seed: number; difficulty?: Difficulty; }

export function generateArithmetic(opts: ArithOpts): ArithmeticProblem {
  const rng = new Rng(opts.seed);
  const difficulty = opts.difficulty ?? ((rng.int(1, 3)) as Difficulty);
  for (let attempt = 0; attempt < 50; attempt++) {
    const p = tryBuild(rng, difficulty, opts.seed + attempt * 7919);
    if (p) return p;
  }
  return tryBuild(new Rng(opts.seed + 999), 1, opts.seed) as ArithmeticProblem;
}

function tryBuild(rng: Rng, difficulty: Difficulty, seed: number): ArithmeticProblem | null {
  // x-first: pick answer x, build expression AST, compute value, hide x.
  if (difficulty === 1) {
    // ax + b = c  or  x op a op b = c
    const kind = rng.int(0, 2);
    if (kind === 0) {
      const a = rng.int(2, 9);
      const x = rng.int(2, 12);
      const b = rng.int(1, 20);
      const c = a * x + b;
      const display = `? × ${a} + ${b} = ${c}`;
      return finalize(seed, 1, display, x, ['linear-basic'], `両辺から${b}を引いて${a}で割る: x=(${c}-${b})÷${a}=${x}`);
    } else if (kind === 1) {
      const b = rng.int(2, 9);
      const x = rng.int(2, 12);
      const add = rng.int(1, 15);
      const c = round2(x / b + add);
      if (!Number.isFinite(c)) return null;
      const display = `${fmt(x)} ÷ ? + ${add} = ${fmt(c)}`;
      // solve: x/b + add = c -> x/b = c-add -> ? = x/(c-add)
      const denom = round2(c - add);
      if (denom === 0) return null;
      const ans = round2(x / denom);
      if (!Number.isInteger(ans)) return null;
      return finalize(seed, 1, display, ans, ['linear-basic'], `逆算: ?=${fmt(x)}÷(${fmt(c)}-${add})=${ans}`);
    } else {
      const x = rng.int(2, 15);
      const a = rng.int(1, 9);
      const b = rng.int(2, 5);
      const c = (x + a) * b;
      const display = `(? + ${a}) × ${b} = ${c}`;
      return finalize(seed, 1, display, x, ['linear-parens'], `両辺を${b}で割って${a}を引く: x=${c}÷${b}-${a}=${x}`);
    }
  } else if (difficulty === 2) {
    const kind = rng.int(0, 2);
    if (kind === 0) {
      // (x + a) * b - d = e
      const x = rng.int(2, 12);
      const a = rng.int(1, 9);
      const b = rng.int(2, 6);
      const d = rng.int(1, 15);
      const e = (x + a) * b - d;
      const display = `(? + ${a}) × ${b} − ${d} = ${e}`;
      return finalize(seed, 2, display, x, ['linear-parens'], `逆向きに: x=((${e}+${d})÷${b})-${a}=${x}`);
    } else if (kind === 1) {
      // decimal: x * 1.5 + b = c
      const x = rng.int(2, 20);
      const mult = rng.pick([1.5, 2.5, 0.5, 1.2] as const);
      const b = rng.int(1, 10);
      const c = round2(x * mult + b);
      const display = `? × ${mult} + ${b} = ${fmt(c)}`;
      return finalize(seed, 2, display, x, ['decimal'], `x=(${fmt(c)}-${b})÷${mult}=${x}`);
    } else {
      // 3 ops: a*x - b + d = e
      const x = rng.int(2, 12);
      const a = rng.int(2, 6);
      const b = rng.int(5, 25);
      const d = rng.int(1, 15);
      const e = a * x - b + d;
      const display = `${a} × ? − ${b} + ${d} = ${e}`;
      return finalize(seed, 2, display, x, ['linear-basic'], `x=((${e}-${d})+${b})÷${a}=${x}`);
    }
  } else {
    // L3: unknown in middle, two unknowns shape but single ?, estimation
    const kind = rng.int(0, 1);
    if (kind === 0) {
      const x = rng.int(3, 15);
      const a = rng.int(2, 9);
      const b = rng.int(2, 9);
      const d = rng.int(1, 12);
      const e = a * x + b * d;
      const display = `${a} × ? + ${b} × ${d} = ${e}`;
      return finalize(seed, 3, display, x, ['linear-basic'], `積を先に: x=(${e}-${b}×${d})÷${a}=${x}`);
    } else {
      const x = rng.int(4, 20);
      const div = rng.pick([2, 3, 4, 5] as const);
      const m = rng.int(2, 9);
      const sub = rng.int(1, 20);
      const val = (x * m) / div - sub;
      if (!Number.isInteger(val)) return null;
      const display = `? × ${m} ÷ ${div} − ${sub} = ${val}`;
      return finalize(seed, 3, display, x, ['fraction'], `x=((${val}+${sub})×${div})÷${m}=${x}`);
    }
  }
}

function finalize(seed: number, difficulty: Difficulty, display: string, answer: number, tags: SkillTag[], explanation: string): ArithmeticProblem {
  if (!Number.isFinite(answer) || Math.abs(answer) > 10000) throw new Error('bad');
  const rng = new Rng(seed ^ 0x5bd1e995);
  const set = new Set<number>([answer]);
  const cands: number[] = [];
  const distractors = [answer + 1, answer - 1, answer + 2, answer - 2, -answer, answer + 10, answer - 10, answer * 2, Math.round(answer / 2)];
  for (const d of rng.shuffle(distractors)) {
    if (cands.length >= 4 || set.has(d)) continue;
    if (!Number.isFinite(d)) continue;
    // near-value distractor: keep magnitude sane
    if (Math.abs(d) > 10000) continue;
    set.add(d);
    cands.push(d);
  }
  while (cands.length < 4) {
    const d = answer + rng.int(3, 25) * (rng.chance(0.5) ? 1 : -1);
    if (set.has(d)) continue;
    set.add(d);
    cands.push(d);
  }
  const all = rng.shuffle([answer, ...cands]);
  const correctIndex = all.indexOf(answer);
  return {
    seed, subject: 'arithmetic', difficulty, skillTags: tags, explanation,
    display, answer, choices: all, correctIndex,
    fingerprint: `arith|${display}|${answer}`,
  };
}
