import { describe, expect, it } from 'vitest';
import type { Attempt, Persisted, Settings } from '../src/domain/types';
import { PERSISTED_VERSION } from '../src/domain/types';
import type { ImportResult } from '../src/features/exportImport';
import {
  EXPORT_FORMAT,
  EXPORT_VERSION,
  exportData,
  importData,
} from '../src/features/exportImport';
import { DEFAULT_SETTINGS } from '../src/storage/store';

const AT = 1_700_000_000_000;

function makeAttempt(index: number): Attempt {
  return {
    id: `a-${index}`,
    seed: 1000 + index,
    subject: 'arithmetic',
    difficulty: 2,
    skillTags: ['linear-basic'],
    correct: index % 2 === 0,
    ms: 4000 + index,
    at: AT + index,
    chosenIndex: 1,
  };
}

function makePersisted(): Persisted {
  return {
    version: PERSISTED_VERSION,
    attempts: [makeAttempt(1), makeAttempt(2)],
    mistakes: [{ seed: 1001, subject: 'arithmetic' }],
    mocks: [{ at: AT, subject: 'mixed', answered: 10, correct: 7, avgMs: 9000 }],
  };
}

function makeSettings(): Settings {
  return {
    mock: {
      arithmetic: { questions: 40, minutes: 8 },
      pattern: { questions: 25, minutes: 10 },
      commands: { questions: 30, minutes: 12 },
      cipher: { questions: 28, minutes: 14 },
    },
    timeAttackMin: [2, 4],
    speedTargetSec: 9,
    fontScale: 1.15,
  };
}

function expectOk(result: ImportResult): { persisted: Persisted; settings: Settings } {
  if (!result.ok) throw new Error(`expected ok, got error: ${result.error}`);
  return { persisted: result.persisted, settings: result.settings };
}

function expectError(result: ImportResult): string {
  if (result.ok) throw new Error('expected import to fail');
  return result.error;
}

describe('exportData', () => {
  it('writes pretty JSON with a format header and the full payload', () => {
    const persisted = makePersisted();
    const settings = makeSettings();
    const text = exportData(persisted, settings);

    expect(text).toContain('\n  "format"');

    const parsed: unknown = JSON.parse(text);
    expect(parsed).toMatchObject({
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      data: persisted,
      settings,
    });
  });
});

describe('importData', () => {
  it('round-trips persisted data and settings exactly', () => {
    const persisted = makePersisted();
    const settings = makeSettings();

    const result = expectOk(importData(exportData(persisted, settings)));

    expect(result.persisted).toEqual(persisted);
    expect(result.settings).toEqual(settings);
  });

  it('accepts a bare persisted payload and merges settings to defaults', () => {
    const persisted = makePersisted();

    const result = expectOk(importData(JSON.stringify(persisted)));

    expect(result.persisted).toEqual(persisted);
    expect(result.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('rejects text that is not JSON', () => {
    expect(expectError(importData('これはJSONではありません'))).toContain('JSON');
  });

  it('rejects JSON values that are not objects', () => {
    expectError(importData('42'));
    expectError(importData('null'));
    expectError(importData('[]'));
  });

  it('rejects objects that are neither bundles nor versioned payloads', () => {
    expect(expectError(importData('{}'))).toContain('エクスポート形式');
    expect(expectError(importData('{"hello":"world"}'))).toContain('エクスポート形式');
  });

  it('rejects unsupported data versions instead of importing nothing', () => {
    const raw = JSON.stringify({ format: EXPORT_FORMAT, version: 1, data: { version: 99 } });
    expect(expectError(importData(raw))).toContain('未対応');
  });

  it('migrates legacy v1 payloads and strips embedded problems', () => {
    const raw = JSON.stringify({
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      data: {
        version: 1,
        attempts: [
          {
            id: 'legacy-1',
            seed: 777,
            subject: 'pattern',
            difficulty: 1,
            skillTags: ['rotation'],
            correct: false,
            ms: 2500,
            at: AT,
            chosenIndex: 3,
            problem: { seed: 777, subject: 'pattern', answer: 'should be stripped' },
          },
        ],
        mistakes: [],
        mocks: [],
      },
    });

    const result = expectOk(importData(raw));

    expect(result.persisted.version).toBe(PERSISTED_VERSION);
    expect(result.persisted.attempts).toEqual([
      {
        id: 'legacy-1',
        seed: 777,
        subject: 'pattern',
        difficulty: 1,
        skillTags: ['rotation'],
        correct: false,
        ms: 2500,
        at: AT,
        chosenIndex: 3,
      },
    ]);
  });

  it('drops malformed entries while keeping the valid ones', () => {
    const raw = JSON.stringify({
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      data: {
        version: PERSISTED_VERSION,
        attempts: [makeAttempt(1), { id: '', seed: 'not-a-number' }, 'garbage'],
        mistakes: [{ seed: 1, subject: 'arithmetic' }, { seed: 'x', subject: 'nope' }],
        mocks: [{ at: AT, subject: 'mixed', answered: 5, correct: 4, avgMs: 8000 }, { at: 'x' }],
      },
    });

    const result = expectOk(importData(raw));

    expect(result.persisted.attempts).toHaveLength(1);
    expect(result.persisted.mistakes).toEqual([{ seed: 1, subject: 'arithmetic' }]);
    expect(result.persisted.mocks).toHaveLength(1);
  });

  it('default-merges invalid settings fields and keeps valid ones', () => {
    const raw = JSON.stringify({
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      data: { version: PERSISTED_VERSION, attempts: [], mistakes: [], mocks: [] },
      settings: {
        mock: { arithmetic: { questions: 12, minutes: 4 }, pattern: { questions: -1, minutes: 0 } },
        timeAttackMin: [2, 'x', -1, 0],
        speedTargetSec: 0,
        fontScale: -2,
      },
    });

    const { settings } = expectOk(importData(raw));

    expect(settings.mock.arithmetic).toEqual({ questions: 12, minutes: 4 });
    expect(settings.mock.pattern).toEqual(DEFAULT_SETTINGS.mock.pattern);
    expect(settings.mock.commands).toEqual(DEFAULT_SETTINGS.mock.commands);
    expect(settings.mock.cipher).toEqual(DEFAULT_SETTINGS.mock.cipher);
    expect(settings.timeAttackMin).toEqual([2]);
    expect(settings.speedTargetSec).toBe(DEFAULT_SETTINGS.speedTargetSec);
    expect(settings.fontScale).toBe(DEFAULT_SETTINGS.fontScale);
  });

  it('falls back to default time-attack minutes when the list is empty', () => {
    const raw = JSON.stringify({
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      data: { version: PERSISTED_VERSION, attempts: [], mistakes: [], mocks: [] },
      settings: { timeAttackMin: [] },
    });

    const { settings } = expectOk(importData(raw));

    expect(settings.timeAttackMin).toEqual(DEFAULT_SETTINGS.timeAttackMin);
  });
});
