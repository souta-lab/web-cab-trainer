import type { Attempt, Difficulty, SessionSummary, SkillTag, Subject } from '../types';

export function summarize(attempts: Attempt[]): SessionSummary {
  const answered = attempts.length;
  const correct = attempts.filter((a) => a.correct).length;
  const wrong = answered - correct;
  const ms = [...attempts.map((a) => a.ms)].sort((a, b) => a - b);
  const avgMs = answered ? Math.round(ms.reduce((s, v) => s + v, 0) / answered) : 0;
  const medianMs = answered ? ms[Math.floor((answered - 1) / 2)] : 0;
  const p90Ms = answered ? ms[Math.min(answered - 1, Math.floor(answered * 0.9))] : 0;
  let best = 0; let cur = 0;
  for (const a of attempts) { cur = a.correct ? cur + 1 : 0; best = Math.max(best, cur); }
  return { answered, correct, wrong, accuracy: answered ? correct / answered : 0, avgMs, medianMs, p90Ms, bestStreak: best, vsPaceMs: null, paceDiffMs: null };
}

export function withPace(s: SessionSummary, targetSecPerQ: number): SessionSummary {
  const target = targetSecPerQ * 1000;
  const avg = s.avgMs;
  return { ...s, vsPaceMs: target, paceDiffMs: s.answered ? Math.round(target - avg) : null };
}

export function adaptiveDifficulty(recent: Attempt[], fallback: Difficulty = 2): Difficulty {
  const last = recent.slice(-30);
  if (last.length < 10) return fallback;
  const acc = last.filter((a) => a.correct).length / last.length;
  const avg = last.reduce((s, a) => s + a.ms, 0) / last.length;
  if (acc > 0.9 && avg < 12000) return 3;
  if (acc < 0.65) return 1;
  if (acc > 0.82) return Math.min(3, fallback + 1) as Difficulty;
  return 2;
}

export interface Weakness { tag: SkillTag | Subject; answered: number; accuracy: number; avgMs: number; }

export function weaknesses(attempts: Attempt[]): Weakness[] {
  const groups = new Map<string, Attempt[]>();
  for (const a of attempts) {
    for (const t of [...a.skillTags, a.subject]) {
      const arr = groups.get(t) ?? [];
      arr.push(a);
      groups.set(t, arr);
    }
  }
  const out: Weakness[] = [];
  for (const [tag, arr] of groups) {
    if (arr.length < 5) continue;
    const acc = arr.filter((a) => a.correct).length / arr.length;
    if (acc >= 0.8) continue;
    out.push({ tag: tag as Weakness['tag'], answered: arr.length, accuracy: acc, avgMs: Math.round(arr.reduce((s, a) => s + a.ms, 0) / arr.length) });
  }
  return out.sort((a, b) => a.accuracy - b.accuracy).slice(0, 5);
}

export const PACE_SEC_PER_Q: Record<Subject, number> = {
  arithmetic: 540 / 50, pattern: 720 / 30, commands: 900 / 36, cipher: 960 / 30,
};
