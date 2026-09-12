import { describe, expect, it } from 'vitest';
import type { Attempt, MockPreset, Subject } from '../src/domain/types';
import { SUBJECTS } from '../src/domain/types';
import {
  PACE_SEC_PER_Q,
  adaptiveDifficulty,
  paceSecPerQ,
  summarize,
  weaknesses,
  withPace,
} from '../src/stats/engine';
import { DEFAULT_SETTINGS } from '../src/storage/store';

let seq = 0;
function makeAttempt(over: Partial<Attempt> = {}): Attempt {
  seq += 1;
  return {
    id: `s-${seq}`,
    seed: seq,
    subject: 'arithmetic',
    difficulty: 2,
    skillTags: [],
    correct: true,
    ms: 5000,
    at: 1_700_000_000_000,
    chosenIndex: 0,
    ...over,
  };
}

function withMs(ms: number, correct: boolean): Attempt {
  return makeAttempt({ ms, correct });
}

describe('summarize', () => {
  it('returns zeros for empty input', () => {
    expect(summarize([])).toEqual({
      answered: 0,
      correct: 0,
      wrong: 0,
      accuracy: 0,
      avgMs: 0,
      medianMs: 0,
      p90Ms: 0,
      bestStreak: 0,
      vsPaceMs: null,
      paceDiffMs: null,
    });
  });

  it('computes counts, accuracy, avg, lower median, nearest-rank p90 and best streak', () => {
    // order matters for streak: T, F, T, T -> best 2
    const attempts = [
      makeAttempt({ ms: 4000, correct: true }),
      makeAttempt({ ms: 1000, correct: false }),
      makeAttempt({ ms: 3000, correct: true }),
      makeAttempt({ ms: 2000, correct: true }),
    ];
    const s = summarize(attempts);
    expect(s.answered).toBe(4);
    expect(s.correct).toBe(3);
    expect(s.wrong).toBe(1);
    expect(s.accuracy).toBe(0.75);
    expect(s.avgMs).toBe(2500);
    expect(s.medianMs).toBe(2000); // lower median of [1000, 2000, 3000, 4000]
    expect(s.p90Ms).toBe(4000); // ceil(0.9 * 4) - 1 = 3
    expect(s.bestStreak).toBe(2);
  });

  it('pins lower median and nearest-rank p90 on a 10-sample set', () => {
    const attempts = Array.from({ length: 10 }, (_, i) => withMs((i + 1) * 1000, true));
    const s = summarize(attempts);
    expect(s.medianMs).toBe(5000); // index floor((10-1)/2) = 4
    expect(s.p90Ms).toBe(9000); // ceil(9) - 1 = 8
    expect(s.avgMs).toBe(5500);
    expect(s.bestStreak).toBe(10);
  });

  it('pins median and p90 on an odd 5-sample set', () => {
    const attempts = [5000, 1000, 3000, 2000, 4000].map((ms) => withMs(ms, true));
    const s = summarize(attempts);
    expect(s.medianMs).toBe(3000);
    expect(s.p90Ms).toBe(5000); // ceil(4.5) - 1 = 4
  });

  it('resets the streak on a wrong answer', () => {
    const attempts = [
      withMs(1000, true),
      withMs(1000, true),
      withMs(1000, false),
      withMs(1000, true),
      withMs(1000, true),
      withMs(1000, true),
    ];
    expect(summarize(attempts).bestStreak).toBe(3);
  });
});

describe('withPace', () => {
  it('sets the pace target and signed difference from avgMs', () => {
    const s = summarize([withMs(4000, true), withMs(6000, true)]);
    const paced = withPace(s, 10);
    expect(paced.answered).toBe(2);
    expect(paced.avgMs).toBe(5000);
    expect(paced.vsPaceMs).toBe(10000);
    expect(paced.paceDiffMs).toBe(5000);
  });

  it('keeps diffs null when nothing was answered', () => {
    const paced = withPace(summarize([]), 10);
    expect(paced.vsPaceMs).toBe(10000);
    expect(paced.paceDiffMs).toBeNull();
  });
});

describe('adaptiveDifficulty', () => {
  it('returns fallback (default 2) with fewer than 10 samples', () => {
    const nine = Array.from({ length: 9 }, () => makeAttempt({ correct: true, ms: 3000 }));
    expect(adaptiveDifficulty(nine)).toBe(2);
    expect(adaptiveDifficulty(nine, 1)).toBe(1);
    expect(adaptiveDifficulty([], 3)).toBe(3);
  });

  it('picks 3 for high accuracy and fast answers', () => {
    const ten = Array.from({ length: 10 }, () => makeAttempt({ correct: true, ms: 5000 }));
    expect(adaptiveDifficulty(ten)).toBe(3);
  });

  it('picks 1 for low accuracy', () => {
    const ten = Array.from({ length: 10 }, (_, i) => makeAttempt({ correct: i < 5, ms: 5000 }));
    expect(adaptiveDifficulty(ten)).toBe(1);
  });

  it('bumps the fallback for high-but-not-perfect accuracy when slow', () => {
    const slowPerfect = Array.from({ length: 10 }, () => makeAttempt({ correct: true, ms: 15000 }));
    expect(adaptiveDifficulty(slowPerfect, 1)).toBe(2);
  });

  it('stays at 2 for mid accuracy', () => {
    const mid = Array.from({ length: 10 }, (_, i) => makeAttempt({ correct: i < 7, ms: 5000 }));
    expect(adaptiveDifficulty(mid, 3)).toBe(2);
  });
});

describe('weaknesses', () => {
  it('filters by min answers and accuracy, groups by tag AND subject, sorts ascending', () => {
    const rotation = Array.from({ length: 6 }, (_, i) =>
      makeAttempt({ subject: 'commands', skillTags: ['rotation'], correct: i < 2, ms: 4000 }));
    const decimal = Array.from({ length: 5 }, (_, i) =>
      makeAttempt({ subject: 'commands', skillTags: ['decimal'], correct: i < 3, ms: 4000 }));
    const fraction = Array.from({ length: 5 }, () =>
      makeAttempt({ subject: 'commands', skillTags: ['fraction'], correct: true, ms: 4000 }));
    const movement = Array.from({ length: 4 }, () =>
      makeAttempt({ subject: 'commands', skillTags: ['movement'], correct: false, ms: 4000 }));

    const w = weaknesses([...rotation, ...decimal, ...fraction, ...movement]);
    expect(w.map((x) => x.tag)).toEqual(['rotation', 'commands', 'decimal']);
    expect(w[0].accuracy).toBeCloseTo(2 / 6, 10);
    expect(w[0].answered).toBe(6);
    expect(w[1].tag).toBe('commands');
    expect(w[1].answered).toBe(20); // subject group aggregates all 20 attempts
    expect(w[1].accuracy).toBeCloseTo(10 / 20, 10);
    expect(w[2].accuracy).toBeCloseTo(3 / 5, 10);
    for (let i = 1; i < w.length; i += 1) {
      expect(w[i - 1].accuracy).toBeLessThanOrEqual(w[i].accuracy);
    }
  });

  it('excludes groups at exactly 0.8 accuracy and below 5 answers', () => {
    const boundary = Array.from({ length: 5 }, (_, i) =>
      makeAttempt({ subject: 'cipher', skillTags: ['count'], correct: i < 4 }));
    const w = weaknesses(boundary);
    expect(w).toEqual([]);
  });

  it('returns at most 5 weaknesses', () => {
    const tags = ['linear-basic', 'linear-parens', 'decimal', 'fraction', 'rotation', 'reflection', 'movement'] as const;
    const attempts = tags.flatMap((tag) =>
      Array.from({ length: 5 }, () => makeAttempt({ subject: 'commands', skillTags: [tag], correct: false })));
    expect(weaknesses(attempts)).toHaveLength(5);
  });
});

describe('paceSecPerQ', () => {
  it('equals minutes * 60 / questions for every subject (from DEFAULT_SETTINGS)', () => {
    for (const subject of SUBJECTS) {
      const { questions, minutes } = DEFAULT_SETTINGS.mock[subject];
      expect(paceSecPerQ(DEFAULT_SETTINGS.mock, subject)).toBe((minutes * 60) / questions);
    }
  });

  it('pins the canonical preset pace values', () => {
    expect(paceSecPerQ(DEFAULT_SETTINGS.mock, 'arithmetic')).toBeCloseTo(10.8, 10);
    expect(paceSecPerQ(DEFAULT_SETTINGS.mock, 'pattern')).toBeCloseTo(24, 10);
    expect(paceSecPerQ(DEFAULT_SETTINGS.mock, 'commands')).toBeCloseTo(25, 10);
    expect(paceSecPerQ(DEFAULT_SETTINGS.mock, 'cipher')).toBeCloseTo(32, 10);
  });

  it('PACE_SEC_PER_Q is derived from DEFAULT_SETTINGS', () => {
    const subjects: readonly Subject[] = SUBJECTS;
    for (const subject of subjects) {
      expect(PACE_SEC_PER_Q[subject]).toBe(paceSecPerQ(DEFAULT_SETTINGS.mock, subject));
    }
  });

  it('honors a custom preset', () => {
    const preset: MockPreset = {
      arithmetic: { questions: 20, minutes: 5 },
      pattern: { questions: 30, minutes: 12 },
      commands: { questions: 36, minutes: 15 },
      cipher: { questions: 30, minutes: 16 },
    };
    expect(paceSecPerQ(preset, 'arithmetic')).toBe(15);
    expect(paceSecPerQ(preset, 'pattern')).toBe(24);
  });
});
