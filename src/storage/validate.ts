// Pure runtime validation: `unknown` -> domain values.
//
// Rules:
//   - No casts, no `any`; every field is narrowed with `typeof` / guards.
//   - Invalid entries are dropped, never thrown.
//   - Parsers build FRESH objects field-by-field, so unknown extra keys
//     (notably the legacy embedded `problem`) are never copied through.

import { DIFFICULTIES, PERSISTED_VERSION, SUBJECTS } from '../domain/types';
import type {
  Attempt,
  Difficulty,
  MistakeRef,
  MockResult,
  Persisted,
  SkillTag,
  Subject,
} from '../domain/types';

/** Retention caps: applied on every load/migration (single source of truth). */
export const ATTEMPT_CAP = 2000;
export const MISTAKE_CAP = 500;
export const MOCK_CAP = 100;

const SKILL_TAGS: readonly SkillTag[] = [
  'linear-basic', 'linear-parens', 'decimal', 'fraction',
  'rotation', 'reflection', 'fill-toggle', 'movement',
  'count', 'inside-outside', 'composite-2', 'composite-3',
  'cmd-rotate', 'cmd-flip', 'cmd-toggle', 'cmd-move', 'cmd-cancel',
  'cipher-single', 'cipher-multi',
];

const SUBJECT_SET: ReadonlySet<string> = new Set(SUBJECTS);
const DIFFICULTY_SET: ReadonlySet<number> = new Set(DIFFICULTIES);
const SKILL_TAG_SET: ReadonlySet<string> = new Set(SKILL_TAGS);

export function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function isFiniteNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

function isSubject(x: unknown): x is Subject {
  return typeof x === 'string' && SUBJECT_SET.has(x);
}

function isDifficulty(x: unknown): x is Difficulty {
  return typeof x === 'number' && DIFFICULTY_SET.has(x);
}

function isSkillTag(x: unknown): x is SkillTag {
  return typeof x === 'string' && SKILL_TAG_SET.has(x);
}

/** Unknown tags are filtered out; a missing/non-array `skillTags` fails the entry. */
function parseSkillTags(x: unknown): SkillTag[] | null {
  if (!Array.isArray(x)) return null;
  const tags: SkillTag[] = [];
  for (const item of x) {
    if (isSkillTag(item)) tags.push(item);
  }
  return tags;
}

export function parseAttempt(raw: unknown): Attempt | null {
  if (!isRecord(raw)) return null;
  const { id, seed, subject, difficulty, skillTags, correct, ms, at, chosenIndex } = raw;
  if (typeof id !== 'string' || id.length === 0) return null;
  if (!isFiniteNumber(seed)) return null;
  if (!isSubject(subject)) return null;
  if (!isDifficulty(difficulty)) return null;
  const tags = parseSkillTags(skillTags);
  if (tags === null) return null;
  if (typeof correct !== 'boolean') return null;
  if (!isFiniteNumber(ms) || ms < 0) return null;
  if (!isFiniteNumber(at)) return null;
  if (!isFiniteNumber(chosenIndex)) return null;
  return { id, seed, subject, difficulty, skillTags: tags, correct, ms, at, chosenIndex };
}

export function parseMistake(raw: unknown): MistakeRef | null {
  if (!isRecord(raw)) return null;
  const { seed, subject } = raw;
  if (!isFiniteNumber(seed)) return null;
  if (!isSubject(subject)) return null;
  return { seed, subject };
}

function isMockSubject(x: unknown): x is Subject | 'mixed' {
  return x === 'mixed' || isSubject(x);
}

export function parseMockResult(raw: unknown): MockResult | null {
  if (!isRecord(raw)) return null;
  const { at, subject, answered, correct, avgMs } = raw;
  if (!isFiniteNumber(at)) return null;
  if (!isMockSubject(subject)) return null;
  if (!isFiniteNumber(answered) || answered < 0) return null;
  if (!isFiniteNumber(correct) || correct < 0) return null;
  if (!isFiniteNumber(avgMs) || avgMs < 0) return null;
  return { at, subject, answered, correct, avgMs };
}

function parseList<T>(x: unknown, parse: (v: unknown) => T | null): T[] {
  if (!Array.isArray(x)) return [];
  const out: T[] = [];
  for (const item of x) {
    const parsed = parse(item);
    if (parsed !== null) out.push(parsed);
  }
  return out;
}

/** Empty structure carrying the current schema version. */
export function emptyPersisted(): Persisted {
  return { version: PERSISTED_VERSION, attempts: [], mistakes: [], mocks: [] };
}

/**
 * Validates an already-new-shaped payload (`version: 2`). Drops invalid
 * entries, clamps retention, never throws. Unknown input -> empty structure.
 */
export function parsePersisted(raw: unknown): Persisted {
  if (!isRecord(raw)) return emptyPersisted();
  return {
    version: PERSISTED_VERSION,
    attempts: parseList(raw.attempts, parseAttempt).slice(-ATTEMPT_CAP),
    mistakes: parseList(raw.mistakes, parseMistake).slice(-MISTAKE_CAP),
    mocks: parseList(raw.mocks, parseMockResult).slice(-MOCK_CAP),
  };
}
