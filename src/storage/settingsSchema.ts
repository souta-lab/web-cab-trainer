// Settings schema: `unknown` -> `Settings`.
//
// Single validation source of truth, shared by `store.loadSettings` (localStorage)
// and `exportImport.importData` (JSON files). Every invalid/missing field falls
// back to the caller-supplied defaults; malformed data is never thrown.

import type { MockConfig, MockPreset, Settings } from '../domain/types';
import { isRecord } from './validate';

/** Positive finite numbers only: rejects 0, negatives, NaN and Infinity. */
function isPositiveNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x) && x > 0;
}

function parseMockConfig(x: unknown): MockConfig | null {
  if (!isRecord(x)) return null;
  const { questions, minutes } = x;
  if (!isPositiveNumber(questions) || !isPositiveNumber(minutes)) return null;
  return { questions, minutes };
}

function mergeMockPreset(x: unknown, fallback: MockPreset): MockPreset {
  const src = isRecord(x) ? x : {};
  return {
    arithmetic: parseMockConfig(src.arithmetic) ?? { ...fallback.arithmetic },
    pattern: parseMockConfig(src.pattern) ?? { ...fallback.pattern },
    commands: parseMockConfig(src.commands) ?? { ...fallback.commands },
    cipher: parseMockConfig(src.cipher) ?? { ...fallback.cipher },
  };
}

/** Filters non-positive entries; an empty result falls back to the default list. */
function parseTimeAttackMin(x: unknown, fallback: readonly number[]): number[] {
  if (!Array.isArray(x)) return [...fallback];
  const out: number[] = [];
  for (const value of x) {
    if (isPositiveNumber(value)) out.push(value);
  }
  return out.length > 0 ? out : [...fallback];
}

export function mergeSettings(raw: unknown, fallback: Settings): Settings {
  const src = isRecord(raw) ? raw : {};
  return {
    mock: mergeMockPreset(src.mock, fallback.mock),
    timeAttackMin: parseTimeAttackMin(src.timeAttackMin, fallback.timeAttackMin),
    speedTargetSec: isPositiveNumber(src.speedTargetSec)
      ? src.speedTargetSec
      : fallback.speedTargetSec,
    fontScale: isPositiveNumber(src.fontScale) ? src.fontScale : fallback.fontScale,
  };
}
