// Performance analytics over domain `Attempt[]` (attempts carry no `problem`;
// statistics only use seed-independent metadata).
//
// Definitions (documented because callers/tests pin them):
//   - medianMs: LOWER median. For even counts the smaller of the two middle
//     values is returned (index `floor((n - 1) / 2)` on the sorted array).
//   - p90Ms: nearest-rank percentile. `index = ceil(0.9 * n) - 1`, clamped to
//     `[0, n - 1]` (so n=10 -> 9th smallest, n=20 -> 18th smallest).
//   - Empty input -> all zeros, `vsPaceMs`/`paceDiffMs` null.

import type {
  Attempt,
  Difficulty,
  MockPreset,
  SessionSummary,
  SkillTag,
  Subject,
} from '../domain/types';
import { DEFAULT_SETTINGS } from '../domain/defaults';

export function summarize(attempts: readonly Attempt[]): SessionSummary {
  const answered = attempts.length;
  const times: number[] = [];
  let correct = 0;
  let best = 0;
  let cur = 0;
  let total = 0;
  for (const a of attempts) {
    times.push(a.ms);
    total += a.ms;
    if (a.correct) {
      correct += 1;
      cur += 1;
      if (cur > best) best = cur;
    } else {
      cur = 0;
    }
  }
  times.sort((x, y) => x - y);
  const medianMs = answered > 0 ? times[Math.floor((answered - 1) / 2)] : 0;
  const p90Ms = answered > 0
    ? times[Math.min(answered - 1, Math.max(0, Math.ceil(0.9 * answered) - 1))]
    : 0;
  return {
    answered,
    correct,
    wrong: answered - correct,
    accuracy: answered > 0 ? correct / answered : 0,
    avgMs: answered > 0 ? Math.round(total / answered) : 0,
    medianMs,
    p90Ms,
    bestStreak: best,
    vsPaceMs: null,
    paceDiffMs: null,
  };
}

export function withPace(s: SessionSummary, targetSecPerQ: number): SessionSummary {
  const target = targetSecPerQ * 1000;
  return {
    ...s,
    vsPaceMs: target,
    paceDiffMs: s.answered > 0 ? Math.round(target - s.avgMs) : null,
  };
}

/** One-step difficulty bump, clamped to the valid `Difficulty` range (no casts). */
function bump(d: Difficulty): Difficulty {
  switch (d) {
    case 1:
      return 2;
    case 2:
      return 3;
    case 3:
      return 3;
  }
}

/**
 * Difficulty for the next question given recent attempts.
 * < 10 samples -> `fallback`. High accuracy + fast -> 3. Low accuracy -> 1.
 */
export function adaptiveDifficulty(
  recent: readonly Attempt[],
  fallback: Difficulty = 2,
): Difficulty {
  const last = recent.slice(-30);
  if (last.length < 10) return fallback;
  const correct = last.filter((a) => a.correct).length;
  const accuracy = correct / last.length;
  const avg = last.reduce((s, a) => s + a.ms, 0) / last.length;
  if (accuracy > 0.9 && avg < 12000) return 3;
  if (accuracy < 0.65) return 1;
  if (accuracy > 0.82) return bump(fallback);
  return 2;
}

export interface Weakness {
  tag: SkillTag | Subject;
  answered: number;
  accuracy: number;
  avgMs: number;
}

function addTo<K>(map: Map<K, Attempt[]>, key: K, a: Attempt): void {
  const arr = map.get(key);
  if (arr === undefined) map.set(key, [a]);
  else arr.push(a);
}

function collectWeak<K extends SkillTag | Subject>(
  groups: Map<K, Attempt[]>,
  out: Weakness[],
): void {
  for (const [tag, arr] of groups) {
    if (arr.length < 5) continue;
    const correct = arr.filter((a) => a.correct).length;
    const accuracy = correct / arr.length;
    if (accuracy >= 0.8) continue;
    const avgMs = Math.round(arr.reduce((s, a) => s + a.ms, 0) / arr.length);
    out.push({ tag, answered: arr.length, accuracy, avgMs });
  }
}

/** Weak areas: >= 5 answers and accuracy < 0.8, grouped by skill tag and subject. */
export function weaknesses(attempts: readonly Attempt[]): Weakness[] {
  const skillGroups = new Map<SkillTag, Attempt[]>();
  const subjectGroups = new Map<Subject, Attempt[]>();
  for (const a of attempts) {
    for (const tag of a.skillTags) addTo(skillGroups, tag, a);
    addTo(subjectGroups, a.subject, a);
  }
  const out: Weakness[] = [];
  collectWeak(skillGroups, out);
  collectWeak(subjectGroups, out);
  out.sort((a, b) => a.accuracy - b.accuracy);
  return out.slice(0, 5);
}

/** Seconds per question for a subject under a mock preset. */
export function paceSecPerQ(preset: MockPreset, subject: Subject): number {
  const { questions, minutes } = preset[subject];
  return (minutes * 60) / questions;
}

/** Derived once from DEFAULT_SETTINGS (single source of truth for pace). */
export const PACE_SEC_PER_Q: Record<Subject, number> = {
  arithmetic: paceSecPerQ(DEFAULT_SETTINGS.mock, 'arithmetic'),
  pattern: paceSecPerQ(DEFAULT_SETTINGS.mock, 'pattern'),
  commands: paceSecPerQ(DEFAULT_SETTINGS.mock, 'commands'),
  cipher: paceSecPerQ(DEFAULT_SETTINGS.mock, 'cipher'),
};
