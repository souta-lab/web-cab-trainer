import { describe, expect, it } from 'vitest';
import { PERSISTED_VERSION, SUBJECTS } from '../src/domain/types';
import type {
  Attempt,
  MistakeRef,
  MockPreset,
  Persisted,
  Problem,
} from '../src/domain/types';
import { generateProblem } from '../src/generators';
import {
  buildAttempt,
  formatClock,
  isButtonElement,
  isTypingTarget,
  mockPaceSecPerQ,
  mockProblemPlan,
  mockTotals,
  nextDifficulty,
  resolveMistakeDifficulty,
  sessionTotals,
  uniqueMistakes,
} from '../src/features/quizHelpers';

const AT = 1_700_000_000_000;

function problemFor(seed: number, subject: Parameters<typeof generateProblem>[0] = 'pattern'): Problem {
  return generateProblem(subject, seed);
}

function attemptFrom(problem: Problem, correct: boolean, ms: number, at = AT): Attempt {
  const other = (problem.correctIndex + 1) % problem.choices.length;
  return {
    id: `t-${problem.seed}-${at}`,
    seed: problem.seed,
    subject: problem.subject,
    difficulty: problem.difficulty,
    skillTags: problem.skillTags,
    correct,
    ms,
    at,
    chosenIndex: correct ? problem.correctIndex : other,
  };
}

function persistedWith(attempts: readonly Attempt[]): Persisted {
  return { version: PERSISTED_VERSION, attempts: [...attempts], mistakes: [], mocks: [] };
}

const PRESET: MockPreset = {
  arithmetic: { questions: 10, minutes: 4 },
  pattern: { questions: 20, minutes: 10 },
  commands: { questions: 30, minutes: 15 },
  cipher: { questions: 40, minutes: 20 },
};

describe('resolveMistakeDifficulty', () => {
  it('joins attempts by subject+seed and returns the newest match', () => {
    // Given two attempts for the same pattern seed at difficulty 1 then 3
    const older = attemptFrom(generateProblem('pattern', 4242, 1), false, 9000, AT);
    const newer = attemptFrom(generateProblem('pattern', 4242, 3), false, 8000, AT + 1);
    const persisted = persistedWith([older, newer]);

    // When resolving the matching mistake ref
    const resolved = resolveMistakeDifficulty(persisted, { subject: 'pattern', seed: 4242 });

    // Then the newest matching attempt's difficulty wins
    expect(resolved).toBe(3);
  });

  it('falls back to 2 when subject or seed does not match', () => {
    const attempt = attemptFrom(generateProblem('pattern', 4242, 1), false, 9000);
    const persisted = persistedWith([attempt]);

    expect(resolveMistakeDifficulty(persisted, { subject: 'cipher', seed: 4242 })).toBe(2);
    expect(resolveMistakeDifficulty(persisted, { subject: 'pattern', seed: 999 })).toBe(2);
    expect(resolveMistakeDifficulty(persistedWith([]), { subject: 'pattern', seed: 4242 })).toBe(2);
  });
});

describe('nextDifficulty', () => {
  const strong = Array.from({ length: 12 }, (_, i) =>
    attemptFrom(generateProblem('commands', 5000 + i), true, 3000, AT + i),
  );
  const weak = Array.from({ length: 12 }, (_, i) =>
    attemptFrom(generateProblem('commands', 6000 + i), false, 15000, AT + i),
  );

  it('uses the manual selection when auto is off, even with strong history', () => {
    expect(nextDifficulty(strong, false, 1)).toBe(1);
    expect(nextDifficulty(strong, false, 2)).toBe(2);
    expect(nextDifficulty(weak, false, 3)).toBe(3);
  });

  it('adapts over recent attempts when auto is on', () => {
    expect(nextDifficulty(strong, true, 2)).toBe(3);
    expect(nextDifficulty(weak, true, 2)).toBe(1);
  });

  it('falls back to the manual selection under 10 samples when auto is on', () => {
    expect(nextDifficulty(strong.slice(0, 5), true, 2)).toBe(2);
    expect(nextDifficulty([], true, 1)).toBe(1);
  });
});

describe('mockTotals', () => {
  it('sums a mixed mock in canonical subject order', () => {
    const plan = mockProblemPlan(PRESET, 'mixed');

    expect(plan.map((entry) => entry.subject)).toEqual([...SUBJECTS]);
    expect(plan.map((entry) => entry.questions)).toEqual([10, 20, 30, 40]);
    expect(mockTotals(PRESET, 'mixed')).toEqual({ questions: 100, minutes: 49 });
  });

  it('returns the selected subject preset for a single subject', () => {
    expect(mockTotals(PRESET, 'arithmetic')).toEqual({ questions: 10, minutes: 4 });
    expect(mockProblemPlan(PRESET, 'cipher')).toEqual([{ subject: 'cipher', questions: 40 }]);
  });

  it('derives pace from the aggregate for mixed', () => {
    expect(mockPaceSecPerQ(PRESET, 'arithmetic')).toBeCloseTo(24, 6);
    expect(mockPaceSecPerQ(PRESET, 'mixed')).toBeCloseTo((49 * 60) / 100, 6);
  });
});

describe('sessionTotals', () => {
  it('never fabricates a total for an empty session', () => {
    expect(sessionTotals([])).toEqual({ answered: 0, correct: 0, avgMs: 0 });
  });

  it('counts answered/correct/avg only from the passed session attempts', () => {
    const list = [
      attemptFrom(problemFor(1), true, 3000),
      attemptFrom(problemFor(2), false, 5000),
      attemptFrom(problemFor(3), true, 7000),
    ];

    expect(sessionTotals(list)).toEqual({ answered: 3, correct: 2, avgMs: 5000 });
    expect(sessionTotals(list.slice(0, 1))).toEqual({ answered: 1, correct: 1, avgMs: 3000 });
  });
});

describe('buildAttempt', () => {
  it('stores the domain shape with correctness derived from correctIndex', () => {
    const problem = generateProblem('arithmetic', 777, 2);
    const correct = buildAttempt(problem, { chosenIndex: problem.correctIndex, ms: 1234, at: 42 });
    const wrongIndex = (problem.correctIndex + 1) % problem.choices.length;
    const wrong = buildAttempt(problem, { chosenIndex: wrongIndex, ms: 4321, at: 43 });

    expect(correct.correct).toBe(true);
    expect(wrong.correct).toBe(false);
    expect(correct.seed).toBe(777);
    expect(correct.subject).toBe('arithmetic');
    expect(correct.difficulty).toBe(2);
    expect(correct.ms).toBe(1234);
    expect(correct.chosenIndex).toBe(problem.correctIndex);
    expect('problem' in correct).toBe(false);
  });
});

describe('uniqueMistakes', () => {
  it('collapses subject+seed duplicates keeping the newest entry', () => {
    const refs: MistakeRef[] = [
      { subject: 'pattern', seed: 1 },
      { subject: 'cipher', seed: 2 },
      { subject: 'pattern', seed: 1 },
    ];

    expect(uniqueMistakes(refs)).toEqual([
      { subject: 'cipher', seed: 2 },
      { subject: 'pattern', seed: 1 },
    ]);
  });
});

describe('formatClock', () => {
  it('formats M:SS with a padded seconds field', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(9)).toBe('0:09');
    expect(formatClock(61)).toBe('1:01');
    expect(formatClock(600)).toBe('10:00');
  });
});

describe('keyboard guards', () => {
  it('detects typing targets and buttons without touching the DOM types', () => {
    const input = Object.assign(new EventTarget(), { tagName: 'INPUT' });
    const select = Object.assign(new EventTarget(), { tagName: 'SELECT' });
    const editable = Object.assign(new EventTarget(), { isContentEditable: true });
    const button = Object.assign(new EventTarget(), { tagName: 'BUTTON' });

    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(select)).toBe(true);
    expect(isTypingTarget(editable)).toBe(true);
    expect(isTypingTarget(button)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(new EventTarget())).toBe(false);

    expect(isButtonElement(button)).toBe(true);
    expect(isButtonElement(input)).toBe(false);
    expect(isButtonElement(null)).toBe(false);
  });
});
