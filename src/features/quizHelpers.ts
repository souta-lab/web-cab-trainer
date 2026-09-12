// Pure quiz helpers shared by Practice / Mock / Mistakes.
//
// No React and no storage access: every function is deterministic, so the whole
// module runs in the node test environment. Session accounting lives here on
// purpose — a session result must only ever be derived from that session's own
// `Attempt[]`, never from `loadPersisted().attempts.slice(...)`.

import type {
  Attempt,
  Difficulty,
  MistakeRef,
  MockPreset,
  Persisted,
  Problem,
  Subject,
} from '../domain/types';
import { SUBJECTS } from '../domain/types';
import { adaptiveDifficulty, paceSecPerQ } from '../stats/engine';

/**
 * Difficulty for regenerating a mistake: the difficulty of the newest attempt
 * with the same subject + seed, or 2 when the join finds nothing.
 */
export function resolveMistakeDifficulty(persisted: Persisted, mistake: MistakeRef): Difficulty {
  for (let i = persisted.attempts.length - 1; i >= 0; i -= 1) {
    const attempt = persisted.attempts[i];
    if (attempt.subject === mistake.subject && attempt.seed === mistake.seed) {
      return attempt.difficulty;
    }
  }
  return 2;
}

/**
 * Difficulty for the next question. `自動` adapts over the passed attempts;
 * manual mode always uses the explicit selection (never a dead argument).
 */
export function nextDifficulty(
  attempts: readonly Attempt[],
  auto: boolean,
  selected: Difficulty,
): Difficulty {
  return auto ? adaptiveDifficulty(attempts, selected) : selected;
}

/**
 * Mistake list with duplicates collapsed (same subject+seed), chronological
 * (oldest first). Retrying a wrong answer re-appends its ref, so the UI dedupes;
 * the newest entry per subject+seed is the one kept.
 */
export function uniqueMistakes(mistakes: readonly MistakeRef[]): MistakeRef[] {
  const seen = new Set<string>();
  const newestFirst: MistakeRef[] = [];
  for (let i = mistakes.length - 1; i >= 0; i -= 1) {
    const mistake = mistakes[i];
    const key = `${mistake.subject}:${mistake.seed}`;
    if (seen.has(key)) continue;
    seen.add(key);
    newestFirst.push(mistake);
  }
  return newestFirst.reverse();
}

export interface MockPlanEntry {
  readonly subject: Subject;
  readonly questions: number;
}

/** Per-subject mock question plan; `mixed` expands in canonical SUBJECTS order. */
export function mockProblemPlan(preset: MockPreset, subject: Subject | 'mixed'): MockPlanEntry[] {
  if (subject !== 'mixed') return [{ subject, questions: preset[subject].questions }];
  return SUBJECTS.map((key) => ({ subject: key, questions: preset[key].questions }));
}

/** Questions/minutes of a mock selection; `mixed` sums the canonical plan. */
export function mockTotals(
  preset: MockPreset,
  subject: Subject | 'mixed',
): { questions: number; minutes: number } {
  let questions = 0;
  let minutes = 0;
  for (const entry of mockProblemPlan(preset, subject)) {
    questions += entry.questions;
    minutes += preset[entry.subject].minutes;
  }
  return { questions, minutes };
}

/**
 * Target seconds per question for a finished mock. A single subject uses its
 * own preset; `mixed` uses the aggregate seconds/questions of the whole plan.
 */
export function mockPaceSecPerQ(preset: MockPreset, subject: Subject | 'mixed'): number {
  if (subject !== 'mixed') return paceSecPerQ(preset, subject);
  const { questions, minutes } = mockTotals(preset, 'mixed');
  return questions > 0 ? (minutes * 60) / questions : 0;
}

/** Persisted `Attempt` from a problem + answer. The problem itself is never stored. */
export function buildAttempt(
  problem: Problem,
  answer: { chosenIndex: number; ms: number; at: number },
): Attempt {
  return {
    id: `${problem.subject}-${problem.seed}-${answer.at}`,
    seed: problem.seed,
    subject: problem.subject,
    difficulty: problem.difficulty,
    skillTags: problem.skillTags,
    correct: answer.chosenIndex === problem.correctIndex,
    ms: answer.ms,
    at: answer.at,
    chosenIndex: answer.chosenIndex,
  };
}

/** Human-readable correct answer for feedback announcements. */
export function correctLabel(problem: Problem): string {
  if (problem.subject === 'arithmetic') return String(problem.choices[problem.correctIndex]);
  return `選択肢${problem.correctIndex + 1}`;
}

/** Session-only counts. Empty session -> all zeros (never a fabricated total). */
export function sessionTotals(attempts: readonly Attempt[]): {
  answered: number;
  correct: number;
  avgMs: number;
} {
  let correct = 0;
  let total = 0;
  for (const attempt of attempts) {
    if (attempt.correct) correct += 1;
    total += attempt.ms;
  }
  const answered = attempts.length;
  return {
    answered,
    correct,
    avgMs: answered > 0 ? Math.round(total / answered) : 0,
  };
}

/** Remaining-time milestones (seconds), announced once each during a timed run. */
export const TIMER_MILESTONES: readonly number[] = [60, 30, 10];

/** M:SS clock text from a whole number of seconds. */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * True while a form control or editable element has focus. Keyboard shortcuts
 * must never fire while the user is typing in an input/select/textarea.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (target === null) return false;
  if ('isContentEditable' in target) {
    const editable = target.isContentEditable;
    if (typeof editable === 'boolean' && editable) return true;
  }
  if (!('tagName' in target)) return false;
  const tag = target.tagName;
  if (typeof tag !== 'string') return false;
  return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
}

/** True for a focused `<button>`: let its native activation handle Enter/Space. */
export function isButtonElement(target: EventTarget | null): boolean {
  if (target === null || !('tagName' in target)) return false;
  return target.tagName === 'BUTTON';
}
