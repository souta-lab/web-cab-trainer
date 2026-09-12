// localStorage persistence (single new key + legacy migration).
//
// All localStorage access is wrapped in try/catch so the module is safe to
// import in tests/SSR where `localStorage` is unavailable. Loading NEVER
// throws; invalid payloads fall back to an empty current-version structure.

import { PERSISTED_VERSION } from '../domain/types';
import type { Attempt, MockResult, Persisted, Settings, Subject } from '../domain/types';
import { DEFAULT_SETTINGS } from '../domain/defaults';
import { ATTEMPT_CAP, MISTAKE_CAP, MOCK_CAP, isRecord } from './validate';
import { migrateUnknown } from './migrate';
import { mergeSettings } from './settingsSchema';

export type { Persisted, Settings } from '../domain/types';
export { DEFAULT_SETTINGS };

const KEY = 'webcab.persist';
const LEGACY_KEY = 'webcab.v1';
const SETTINGS_KEY = 'webcab.settings';
const LEGACY_SETTINGS_KEY = 'webcab.settings.v1';
const ORPHAN_MOCK_KEY = 'webcab.mock.v1';

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded / localStorage unavailable */
  }
}

function removeRaw(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* unavailable */
  }
}

function parseJson(raw: string): unknown {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed;
  } catch {
    return null;
  }
}

export function loadPersisted(): Persisted {
  const raw = readRaw(KEY);
  if (raw !== null && raw !== '') {
    const parsed = parseJson(raw);
    if (parsed !== null) return migrateUnknown(parsed);
  }
  // No readable current payload: best-effort one-shot migration of the legacy key.
  const legacyRaw = readRaw(LEGACY_KEY);
  if (legacyRaw !== null && legacyRaw !== '') {
    const migrated = migrateUnknown(parseJson(legacyRaw));
    writeRaw(KEY, migrated);
    removeRaw(LEGACY_KEY);
    return migrated;
  }
  return migrateUnknown(null);
}

export function saveAttempt(a: Attempt): Persisted {
  const p = loadPersisted();
  const next: Persisted = {
    version: PERSISTED_VERSION,
    attempts: [...p.attempts, a].slice(-ATTEMPT_CAP),
    mistakes: a.correct
      ? p.mistakes
      : [...p.mistakes, { seed: a.seed, subject: a.subject }].slice(-MISTAKE_CAP),
    mocks: p.mocks,
  };
  writeRaw(KEY, next);
  return next;
}

export function removeMistake(subject: Subject, seed: number): void {
  const p = loadPersisted();
  writeRaw(KEY, {
    ...p,
    mistakes: p.mistakes.filter((m) => m.subject !== subject || m.seed !== seed),
  });
}

export function savePersisted(p: Persisted): void {
  writeRaw(KEY, p);
}

export function clearAll(): void {
  removeRaw(KEY);
  removeRaw(SETTINGS_KEY);
  removeRaw(LEGACY_KEY);
  removeRaw(LEGACY_SETTINGS_KEY);
  removeRaw(ORPHAN_MOCK_KEY);
}

export function saveMock(m: MockResult): void {
  const p = loadPersisted();
  writeRaw(KEY, { ...p, mocks: [...p.mocks, m].slice(-MOCK_CAP) });
}

export function loadSettings(): Settings {
  const raw = readRaw(SETTINGS_KEY);
  const parsed = raw === null ? null : parseJson(raw);
  if (isRecord(parsed)) return mergeSettings(parsed, DEFAULT_SETTINGS);
  // Current key absent/unreadable: best-effort one-shot migration of the
  // legacy settings key, then remove it (localStorage may be unavailable).
  const legacyRaw = readRaw(LEGACY_SETTINGS_KEY);
  if (legacyRaw !== null && legacyRaw !== '') {
    const migrated = mergeSettings(parseJson(legacyRaw), DEFAULT_SETTINGS);
    writeRaw(SETTINGS_KEY, migrated);
    removeRaw(LEGACY_SETTINGS_KEY);
    return migrated;
  }
  return mergeSettings(null, DEFAULT_SETTINGS);
}

export function saveSettings(s: Settings): void {
  writeRaw(SETTINGS_KEY, s);
}
