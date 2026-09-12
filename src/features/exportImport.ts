// Pure export/import codec for user data (settings + persisted history).
//
// This module NEVER touches localStorage or the DOM: it turns a `Persisted`
// snapshot plus `Settings` into portable JSON text, and validates incoming text
// back into domain values. Storage I/O lives in the page that calls it.
//
// Incoming payloads pass through the storage lane's `migrateUnknown`
// (v1 -> v2 migration + per-entry validation), so a hand-edited or legacy file
// can never inject malformed attempts/mistakes/mocks into the app. Settings go
// through the storage lane's shared `mergeSettings` — the same validation source
// of truth as `loadSettings()`.

import type { Persisted, Settings } from '../domain/types';
import { migrateUnknown } from '../storage/migrate';
import { DEFAULT_SETTINGS } from '../storage/store';
import { isRecord } from '../storage/validate';
import { mergeSettings } from '../storage/settingsSchema';

export const EXPORT_FORMAT = 'webcab-trainer-export';
export const EXPORT_VERSION = 1;

/** Portable bundle written by `exportData`. `data`/`settings` are the payload. */
export interface ExportBundle {
  readonly format: typeof EXPORT_FORMAT;
  readonly version: typeof EXPORT_VERSION;
  readonly exportedAt: string;
  readonly data: Persisted;
  readonly settings: Settings;
}

export type ImportResult =
  | { readonly ok: true; readonly persisted: Persisted; readonly settings: Settings }
  | { readonly ok: false; readonly error: string };

/** Serializes data + settings as pretty JSON with a small format header. */
export function exportData(persisted: Persisted, settings: Settings): string {
  const bundle: ExportBundle = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    data: persisted,
    settings,
  };
  return JSON.stringify(bundle, null, 2);
}

function hasSupportedVersion(x: Record<string, unknown>): boolean {
  return x.version === 1 || x.version === 2;
}

interface UnwrappedPayload {
  readonly data: unknown;
  readonly settings: unknown;
}

/**
 * Accepts either a wrapped export (`{ data, settings }`) or a bare persisted
 * payload (legacy `{ version: 1 | 2, ... }`) pasted from localStorage.
 * Returns a Japanese error string when the shape is unusable.
 */
function unwrapBundle(parsed: Record<string, unknown>): UnwrappedPayload | string {
  if ('data' in parsed) {
    const data = parsed.data;
    if (!isRecord(data) || !hasSupportedVersion(data)) {
      return '未対応の保存データ形式です。Web-CAB Trainerが出力したファイルを選択してください。';
    }
    return { data, settings: parsed.settings };
  }
  if (hasSupportedVersion(parsed)) return { data: parsed, settings: null };
  return 'エクスポート形式ではありません。Web-CAB Trainerが出力したファイルを選択してください。';
}

/** Parses + validates exported text. Never throws; errors come back as a string. */
export function importData(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'JSONとして読み取れませんでした。ファイルの内容を確認してください。' };
  }
  if (!isRecord(parsed)) {
    return { ok: false, error: 'エクスポート形式ではありません。Web-CAB Trainerが出力したファイルを選択してください。' };
  }
  const unwrapped = unwrapBundle(parsed);
  if (typeof unwrapped === 'string') return { ok: false, error: unwrapped };
  return {
    ok: true,
    persisted: migrateUnknown(unwrapped.data),
    settings: mergeSettings(unwrapped.settings, DEFAULT_SETTINGS),
  };
}
