import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attempt, MistakeRef, MockResult } from '../src/domain/types';
import { migrateUnknown } from '../src/storage/migrate';
import {
  ATTEMPT_CAP,
  MISTAKE_CAP,
  MOCK_CAP,
  emptyPersisted,
  isRecord,
  parseAttempt,
  parsePersisted,
} from '../src/storage/validate';
import {
  DEFAULT_SETTINGS,
  clearAll,
  loadPersisted,
  loadSettings,
  removeMistake,
  saveAttempt,
  saveMock,
  savePersisted,
  saveSettings,
} from '../src/storage/store';

// ---------------------------------------------------------------- helpers --

const AT = 1_700_000_000_000;

/** Legacy v1 attempt: new Attempt fields PLUS the embedded `problem` object. */
function v1Attempt(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'a1',
    seed: 42,
    subject: 'arithmetic',
    difficulty: 2,
    skillTags: ['linear-basic'],
    correct: true,
    ms: 3000,
    at: AT,
    chosenIndex: 1,
    problem: { seed: 42, subject: 'arithmetic', answer: 5, choices: [1, 2, 3, 4, 5] },
    ...overrides,
  };
}

function v1Payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { version: 1, attempts: [], mistakes: [], mocks: [], ...overrides };
}

let seq = 0;
function makeAttempt(over: Partial<Attempt> = {}): Attempt {
  seq += 1;
  return {
    id: `t-${seq}`,
    seed: seq,
    subject: 'arithmetic',
    difficulty: 2,
    skillTags: ['linear-basic'],
    correct: true,
    ms: 3000,
    at: AT,
    chosenIndex: 0,
    ...over,
  };
}

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number {
    return this.data.size;
  }
  clear(): void {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ------------------------------------------------------- pure validation --

describe('isRecord', () => {
  it('rejects null, arrays and primitives', () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord([])).toBe(false);
    expect(isRecord('x')).toBe(false);
    expect(isRecord(7)).toBe(false);
    expect(isRecord({})).toBe(true);
  });
});

describe('parseAttempt', () => {
  it('builds a fresh attempt without the embedded problem', () => {
    const parsed = parseAttempt(v1Attempt());
    expect(parsed).toEqual({
      id: 'a1',
      seed: 42,
      subject: 'arithmetic',
      difficulty: 2,
      skillTags: ['linear-basic'],
      correct: true,
      ms: 3000,
      at: AT,
      chosenIndex: 1,
    });
    expect(parsed).not.toHaveProperty('problem');
  });

  it('filters unknown skill tags but keeps the attempt', () => {
    const parsed = parseAttempt(v1Attempt({ skillTags: ['rotation', 'bogus', 3] }));
    expect(parsed?.skillTags).toEqual(['rotation']);
  });

  it('drops entries with malformed metadata', () => {
    const bad: unknown[] = [
      null,
      7,
      'x',
      {},
      v1Attempt({ id: '' }),
      v1Attempt({ seed: '42' }),
      v1Attempt({ subject: 'bogus' }),
      v1Attempt({ difficulty: 4 }),
      v1Attempt({ skillTags: 'linear-basic' }),
      v1Attempt({ correct: 'yes' }),
      v1Attempt({ ms: Number.NaN }),
      v1Attempt({ ms: -1 }),
      v1Attempt({ at: undefined }),
      v1Attempt({ chosenIndex: '1' }),
    ];
    for (const entry of bad) expect(parseAttempt(entry)).toBeNull();
  });
});

// -------------------------------------------------------------- migration --

describe('migrateUnknown (v1 -> v2)', () => {
  it('strips the embedded problem and keeps the rest', () => {
    const p = migrateUnknown(v1Payload({ attempts: [v1Attempt()] }));
    expect(p.version).toBe(2);
    expect(p.attempts).toHaveLength(1);
    expect(p.attempts[0]).not.toHaveProperty('problem');
    expect(p.attempts[0]).toEqual({
      id: 'a1',
      seed: 42,
      subject: 'arithmetic',
      difficulty: 2,
      skillTags: ['linear-basic'],
      correct: true,
      ms: 3000,
      at: AT,
      chosenIndex: 1,
    });
    expect(JSON.stringify(p)).not.toContain('"problem"');
  });

  it('drops v1 attempts missing required metadata', () => {
    const p = migrateUnknown(v1Payload({
      attempts: [
        v1Attempt({ id: 'keep-1' }),
        v1Attempt({ id: 'drop-no-at', at: undefined }),
        v1Attempt({ id: 'drop-no-subject', subject: undefined }),
        v1Attempt({ id: 'drop-bad-difficulty', difficulty: 9 }),
        { problem: { seed: 1 } },
        null,
      ],
    }));
    expect(p.attempts.map((a) => a.id)).toEqual(['keep-1']);
  });

  it('migrates v1 mistakes and mocks and drops malformed ones', () => {
    const p = migrateUnknown(v1Payload({
      mistakes: [{ seed: 1, subject: 'pattern' }, { seed: 'x', subject: 'pattern' }, null],
      mocks: [
        { at: AT, subject: 'mixed', answered: 30, correct: 20, avgMs: 9000 },
        { at: AT, subject: 'nope', answered: 30, correct: 20, avgMs: 9000 },
      ],
    }));
    expect(p.mistakes).toEqual([{ seed: 1, subject: 'pattern' }]);
    expect(p.mocks).toHaveLength(1);
    expect(p.mocks[0].subject).toBe('mixed');
  });

  it('returns empty current-version structure for unknown shapes', () => {
    const unknowns: unknown[] = [
      null,
      undefined,
      42,
      'x',
      [],
      {},
      { attempts: [v1Attempt()] }, // no version
      { version: 0, attempts: [v1Attempt()] },
      { version: 3, attempts: [v1Attempt()] },
      { version: '1', attempts: [v1Attempt()] },
    ];
    for (const raw of unknowns) {
      expect(migrateUnknown(raw)).toEqual(emptyPersisted());
    }
  });

  it('clamps v1 retention to 2000 attempts / 500 mistakes / 100 mocks', () => {
    const attempts = Array.from({ length: ATTEMPT_CAP + 500 }, (_, i) =>
      v1Attempt({ id: `a${i}`, seed: i }),
    );
    const mistakes: MistakeRef[] = Array.from({ length: MISTAKE_CAP + 100 }, (_, i) => ({
      seed: i,
      subject: 'cipher',
    }));
    const mocks: MockResult[] = Array.from({ length: MOCK_CAP + 50 }, (_, i) => ({
      at: i,
      subject: 'mixed',
      answered: 10,
      correct: 5,
      avgMs: 1000,
    }));
    const p = migrateUnknown({ version: 1, attempts, mistakes, mocks });
    expect(p.attempts).toHaveLength(ATTEMPT_CAP);
    expect(p.attempts[0].id).toBe('a500');
    expect(p.attempts[p.attempts.length - 1].id).toBe(`a${ATTEMPT_CAP + 499}`);
    expect(p.mistakes).toHaveLength(MISTAKE_CAP);
    expect(p.mistakes[0].seed).toBe(100);
    expect(p.mocks).toHaveLength(MOCK_CAP);
    expect(p.mocks[0].at).toBe(50);
  });

  it('clamps v2 payloads too', () => {
    const attempts = Array.from({ length: ATTEMPT_CAP + 1 }, (_, i) => makeAttempt({ id: `v${i}` }));
    const p = parsePersisted({ version: 2, attempts, mistakes: [], mocks: [] });
    expect(p.attempts).toHaveLength(ATTEMPT_CAP);
    expect(p.attempts[0].id).toBe('v1');
  });
});

// ------------------------------------------------------------------ store --

describe('store persistence', () => {
  it('round-trips attempts, mistakes and mocks', () => {
    const good = saveAttempt(makeAttempt({ id: 'g1' }));
    expect(good.attempts).toHaveLength(1);
    expect(good.mistakes).toHaveLength(0);

    const afterWrong = saveAttempt(makeAttempt({ id: 'w1', correct: false, seed: 99, subject: 'pattern' }));
    expect(afterWrong.attempts.map((a) => a.id)).toEqual(['g1', 'w1']);
    expect(afterWrong.mistakes).toEqual([{ seed: 99, subject: 'pattern' }]);

    const m: MockResult = { at: AT, subject: 'mixed', answered: 30, correct: 25, avgMs: 9000 };
    saveMock(m);
    const loaded = loadPersisted();
    expect(loaded.attempts).toHaveLength(2);
    expect(loaded.mocks).toEqual([m]);

    removeMistake('cipher', 99);
    expect(loadPersisted().mistakes).toHaveLength(1);
    removeMistake('pattern', 99);
    expect(loadPersisted().mistakes).toHaveLength(0);
  });

  it('migrates the legacy webcab.v1 key on first load and removes it', () => {
    localStorage.setItem('webcab.v1', JSON.stringify(v1Payload({
      attempts: [v1Attempt({ id: 'legacy-1' })],
    })));
    const p = loadPersisted();
    expect(p.attempts).toHaveLength(1);
    expect(p.attempts[0].id).toBe('legacy-1');
    expect(p.attempts[0]).not.toHaveProperty('problem');
    expect(localStorage.getItem('webcab.v1')).toBeNull();
    const written: unknown = JSON.parse(localStorage.getItem('webcab.persist') ?? 'null');
    expect(written).toMatchObject({ version: 2 });
    expect(JSON.stringify(written)).not.toContain('"problem"');
  });

  it('prefers the new key over the legacy one', () => {
    localStorage.setItem('webcab.persist', JSON.stringify({
      version: 2,
      attempts: [makeAttempt({ id: 'new' })],
      mistakes: [],
      mocks: [],
    }));
    localStorage.setItem('webcab.v1', JSON.stringify(v1Payload({ attempts: [v1Attempt({ id: 'old' })] })));
    const p = loadPersisted();
    expect(p.attempts.map((a) => a.id)).toEqual(['new']);
    expect(localStorage.getItem('webcab.v1')).not.toBeNull();
  });

  it('never throws when localStorage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem(): string | null {
        throw new Error('blocked');
      },
      setItem(): void {
        throw new Error('blocked');
      },
      removeItem(): void {
        throw new Error('blocked');
      },
    });
    expect(loadPersisted()).toEqual(emptyPersisted());
    expect(() => saveAttempt(makeAttempt())).not.toThrow();
    expect(() => saveSettings(DEFAULT_SETTINGS)).not.toThrow();
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe('loadSettings', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('merges partial settings with defaults', () => {
    localStorage.setItem('webcab.settings', JSON.stringify({
      mock: {
        arithmetic: { questions: 10, minutes: 2 },
        pattern: { questions: -1, minutes: 12 }, // invalid -> default
      },
      fontScale: 1.5,
    }));
    const s = loadSettings();
    expect(s.mock.arithmetic).toEqual({ questions: 10, minutes: 2 });
    expect(s.mock.pattern).toEqual(DEFAULT_SETTINGS.mock.pattern);
    expect(s.mock.commands).toEqual(DEFAULT_SETTINGS.mock.commands);
    expect(s.mock.cipher).toEqual(DEFAULT_SETTINGS.mock.cipher);
    expect(s.timeAttackMin).toEqual(DEFAULT_SETTINGS.timeAttackMin);
    expect(s.speedTargetSec).toBe(DEFAULT_SETTINGS.speedTargetSec);
    expect(s.fontScale).toBe(1.5);
  });

  it('rejects malformed timeAttackMin and non-numeric scales', () => {
    localStorage.setItem('webcab.settings', JSON.stringify({
      timeAttackMin: [0, -3, 'x'],
      speedTargetSec: 'fast',
      fontScale: Number.NaN,
    }));
    const s = loadSettings();
    expect(s.timeAttackMin).toEqual(DEFAULT_SETTINGS.timeAttackMin);
    expect(s.speedTargetSec).toBe(DEFAULT_SETTINGS.speedTargetSec);
    expect(s.fontScale).toBe(DEFAULT_SETTINGS.fontScale);
  });

  it('round-trips explicit settings', () => {
    const custom = {
      mock: {
        arithmetic: { questions: 20, minutes: 5 },
        pattern: { questions: 10, minutes: 4 },
        commands: { questions: 12, minutes: 6 },
        cipher: { questions: 8, minutes: 8 },
      },
      timeAttackMin: [2],
      speedTargetSec: 15,
      fontScale: 1.25,
    };
    saveSettings(custom);
    expect(loadSettings()).toEqual(custom);
  });

  it('migrates the legacy webcab.settings.v1 key on load and removes it', () => {
    localStorage.setItem('webcab.settings.v1', JSON.stringify({ speedTargetSec: 20 }));
    const s = loadSettings();
    expect(s.speedTargetSec).toBe(20);
    expect(s.mock).toEqual(DEFAULT_SETTINGS.mock);
    expect(localStorage.getItem('webcab.settings.v1')).toBeNull();
    const written: unknown = JSON.parse(localStorage.getItem('webcab.settings') ?? 'null');
    expect(written).toMatchObject({ speedTargetSec: 20 });
  });

  it('prefers the current settings key over the legacy one', () => {
    localStorage.setItem('webcab.settings', JSON.stringify({ ...DEFAULT_SETTINGS, speedTargetSec: 7 }));
    localStorage.setItem('webcab.settings.v1', JSON.stringify({ speedTargetSec: 20 }));
    expect(loadSettings().speedTargetSec).toBe(7);
    expect(localStorage.getItem('webcab.settings.v1')).not.toBeNull();
  });
});

describe('savePersisted / clearAll', () => {
  it('savePersisted replaces the payload and clearAll removes every app key', () => {
    const p = { version: 2 as const, attempts: [makeAttempt({ id: 'imported' })], mistakes: [], mocks: [] };
    savePersisted(p);
    expect(loadPersisted().attempts.map((a) => a.id)).toEqual(['imported']);

    for (const key of ['webcab.persist', 'webcab.settings', 'webcab.v1', 'webcab.mock.v1', 'webcab.settings.v1']) {
      localStorage.setItem(key, '{}');
    }
    clearAll();
    for (const key of ['webcab.persist', 'webcab.settings', 'webcab.v1', 'webcab.mock.v1', 'webcab.settings.v1']) {
      expect(localStorage.getItem(key)).toBeNull();
    }
    expect(loadPersisted()).toEqual(emptyPersisted());
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
