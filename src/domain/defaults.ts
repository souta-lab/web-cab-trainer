// Domain-owned defaults for persisted settings (single source of truth).
//
// Lives in `domain/` so stats (and anything else) can derive from it without
// importing the storage layer. Must not import storage or stats.

import type { Settings } from './types';

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
