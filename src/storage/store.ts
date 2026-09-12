import type { Attempt, MockConfig, Problem, Subject } from '../types';

const KEY = 'webcab.v1';
const MOCK_KEY = 'webcab.mock.v1';
const SETTINGS_KEY = 'webcab.settings.v1';

export interface Persisted {
  version: 1;
  attempts: Attempt[];
  mistakes: { seed: number; subject: Subject }[];
  mocks: { at: number; subject: Subject | 'mixed'; answered: number; correct: number; avgMs: number }[];
}

export interface Settings {
  mock: Record<Subject, MockConfig>;
  timeAttackMin: number[];
  speedTargetSec: number;
  fontScale: number;
}

export const DEFAULT_SETTINGS: Settings = {
  mock: {
    arithmetic: { questions: 50, minutes: 9 },
    pattern: { questions: 30, minutes: 12 },
    commands: { questions: 36, minutes: 15 },
    cipher: { questions: 30, minutes: 16 },
  },
  timeAttackMin: [1, 3, 5],
  speedTargetSec: 11,
  fontScale: 1,
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const v = JSON.parse(raw) as T;
    return v ?? fallback;
  } catch { return fallback; }
}

function write(key: string, v: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* quota */ }
}

export function loadPersisted(): Persisted {
  const base = read<Persisted>(KEY, { version: 1, attempts: [], mistakes: [], mocks: [] });
  // schema migration guard
  if (!Array.isArray(base.attempts)) base.attempts = [];
  if (!Array.isArray(base.mistakes)) base.mistakes = [];
  if (!Array.isArray(base.mocks)) base.mocks = [];
  return { version: 1, attempts: base.attempts.slice(-2000), mistakes: base.mistakes.slice(-500), mocks: base.mocks.slice(-100) };
}

export function saveAttempt(a: Attempt): Persisted {
  const p = loadPersisted();
  p.attempts.push(a);
  if (!a.correct) p.mistakes.push({ seed: a.seed, subject: a.subject });
  write(KEY, { ...p, attempts: p.attempts.slice(-2000), mistakes: p.mistakes.slice(-500) });
  return p;
}

export function removeMistake(seed: number): void {
  const p = loadPersisted();
  p.mistakes = p.mistakes.filter((m) => m.seed !== seed);
  write(KEY, p);
}

export function saveMock(m: Persisted['mocks'][number]): void {
  const p = loadPersisted();
  p.mocks.push(m);
  write(MOCK_KEY, p.mocks.slice(-100));
  write(KEY, { ...p, mocks: p.mocks.slice(-100) });
}

export function loadSettings(): Settings {
  const s = read<Partial<Settings>>(SETTINGS_KEY, {});
  return {
    mock: { ...DEFAULT_SETTINGS.mock, ...(s.mock ?? {}) },
    timeAttackMin: s.timeAttackMin ?? DEFAULT_SETTINGS.timeAttackMin,
    speedTargetSec: s.speedTargetSec ?? DEFAULT_SETTINGS.speedTargetSec,
    fontScale: s.fontScale ?? 1,
  };
}

export function saveSettings(s: Settings): void {
  write(SETTINGS_KEY, s);
}

export function problemKey(p: Problem): string {
  return `${p.subject}:${p.seed}`;
}
