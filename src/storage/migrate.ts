// Pure schema migration: any unknown persisted payload -> current `Persisted`.
//
// v1 -> v2: the only change is that `Attempt` no longer embeds the full
// `problem` object (problems are regenerated from subject+seed+difficulty).
// Legacy v1 attempts are re-parsed field-by-field by `parseAttempt`, which
// reads only known keys and builds a fresh object, so `problem` (and any
// other unknown key) is structurally stripped. Attempts missing required
// metadata are dropped. Anything unrecognized -> empty defaults, never throw.

import { PERSISTED_VERSION } from '../domain/types';
import type { Persisted } from '../domain/types';
import { emptyPersisted, isRecord, parsePersisted } from './validate';

/**
 * Migrates a raw localStorage payload to the current `Persisted` shape.
 * Requires an explicit `version` tag: v1 is migrated, v2 is validated,
 * every other shape returns an empty current-version structure.
 */
export function migrateUnknown(raw: unknown): Persisted {
  if (!isRecord(raw)) return emptyPersisted();
  if (raw.version === PERSISTED_VERSION) return parsePersisted(raw);
  if (raw.version === 1) return migrateV1(raw);
  return emptyPersisted();
}

function migrateV1(v1: Record<string, unknown>): Persisted {
  // Hand the legacy arrays to the shared parser. `parseAttempt` constructs
  // `{ id, seed, subject, difficulty, skillTags, correct, ms, at, chosenIndex }`
  // explicitly and never reads/copies `problem`.
  return parsePersisted({
    version: PERSISTED_VERSION,
    attempts: v1.attempts,
    mistakes: v1.mistakes,
    mocks: v1.mocks,
  });
}
