// Domain contracts (frozen by lane F0).
//
// This module is the single source of truth for problem/attempt/settings types.
// Rules of the domain:
//   - No `any` / casts. Discriminated unions + exhaustive switches.
//   - `FigObj.flipH` is REQUIRED (the renderer and figureKey both read it).
//   - `FigState.markerPos` is REQUIRED (`RotSlot`); 0 means "no marker" when the
//     main object is not on corner 0.
//   - `Attempt` deliberately stores only `seed` + metadata. The problem is
//     regenerated from `(subject, seed, difficulty)`; never embed it.
//   - `Settings`/`Persisted` live here; the storage lane re-exports them.

import type { ArithRecipe } from './recipe';

export type { ArithRecipe } from './recipe';

/** Canonical subject order (do not reorder: UI/tab order may rely on it). */
export const SUBJECTS = ['arithmetic', 'pattern', 'commands', 'cipher'] as const;
export type Subject = (typeof SUBJECTS)[number];

/** Canonical difficulty levels. */
export const DIFFICULTIES = [1, 2, 3] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export type SkillTag =
  | 'linear-basic' | 'linear-parens' | 'decimal' | 'fraction'
  | 'rotation' | 'reflection' | 'fill-toggle' | 'movement'
  | 'count' | 'inside-outside' | 'composite-2' | 'composite-3'
  | 'cmd-rotate' | 'cmd-flip' | 'cmd-toggle' | 'cmd-move' | 'cmd-cancel'
  | 'cipher-single' | 'cipher-multi';

/** Quarter-turn rotation. Single definition, re-exported by figure.ts. */
export type Rot = 0 | 90 | 180 | 270;
/** Marker slot index into the shared CORNERS table (figure.ts). */
export type RotSlot = 0 | 1 | 2 | 3;

export type ShapeKind = 'circle' | 'square' | 'triangle' | 'arrow' | 'dot' | 'line';

export interface FigObj {
  shape: ShapeKind;
  x: number;
  y: number;
  rot: Rot;
  fill: boolean;
  size: number;
  /** REQUIRED: horizontal mirror flag (renderer + figureKey read it). */
  flipH: boolean;
}

export interface FigState {
  /** Array order is significant (figureKey preserves it; swapObjects swaps positions). */
  objects: readonly FigObj[];
  /** REQUIRED: current marker corner; use 0 when absent. */
  markerPos: RotSlot;
}

/**
 * Atomic figure operations. This union is interpreted in exactly one place:
 * `figure.ts#applyPrimitives`. Generators must produce ops, never mutate states.
 */
export type Primitive =
  | { op: 'rotate'; deg: 90 | 180 | 270 }
  | { op: 'flipH' }
  | { op: 'flipV' }
  | { op: 'toggleFill' }
  | { op: 'move'; dx: number; dy: number }
  | { op: 'moveMarker'; delta: 1 | -1 }
  | { op: 'swapObjects' }
  | { op: 'addDot'; x: number; y: number }
  | { op: 'removeDot' };

export interface BaseProblem {
  seed: number;
  subject: Subject;
  difficulty: Difficulty;
  skillTags: SkillTag[];
  explanation: string;
  fingerprint: string;
}

export interface ArithmeticProblem extends BaseProblem {
  subject: 'arithmetic';
  /** Japanese-style display, e.g. "? × 3 + 2 = 14" (produced by recipe.render). */
  display: string;
  /** Machine-checkable AST: display + answer are both derived from this. */
  recipe: ArithRecipe;
  answer: number;
  /** Exactly 5 finite, pairwise-distinct values; answer appears exactly once. */
  choices: number[];
  correctIndex: number;
}

export interface FigureProblem extends BaseProblem {
  subject: 'pattern' | 'commands' | 'cipher';
  prompt: string;
  /** Machine-checkable solution: applyPrimitives(start, ops) === choices[correctIndex]. */
  start: FigState;
  ops: readonly Primitive[];
  /** Exactly 5 pairwise-distinct (by figureKey) states. */
  choices: FigState[];
  correctIndex: number;
  /** pattern only: the visible sequence; `missingIndex` is the blank. */
  frames?: FigState[];
  missingIndex?: number;
  /** cipher only: example pairs (Input A -> Output A). */
  examples?: { input: FigState; output: FigState }[];
  /** commands only: human-readable command labels in order. */
  commandLabels?: string[];
}

export type Problem = ArithmeticProblem | FigureProblem;

/**
 * A single answered question. No embedded `problem`: regenerate from
 * `(subject, seed, difficulty)` to keep localStorage small and migration-safe.
 */
export interface Attempt {
  id: string;
  seed: number;
  subject: Subject;
  difficulty: Difficulty;
  skillTags: SkillTag[];
  correct: boolean;
  ms: number;
  at: number;
  chosenIndex: number;
}

export interface SessionSummary {
  answered: number;
  correct: number;
  wrong: number;
  accuracy: number;
  avgMs: number;
  medianMs: number;
  p90Ms: number;
  bestStreak: number;
  vsPaceMs: number | null;
  paceDiffMs: number | null;
}

export interface MockConfig {
  questions: number;
  minutes: number;
}

export type MockPreset = Record<Subject, MockConfig>;

/** Persisted UI settings (storage lane owns persistence + DEFAULT_SETTINGS). */
export interface Settings {
  mock: MockPreset;
  timeAttackMin: number[];
  speedTargetSec: number;
  fontScale: number;
}

export interface MistakeRef {
  seed: number;
  subject: Subject;
}

export interface MockResult {
  at: number;
  subject: Subject | 'mixed';
  answered: number;
  correct: number;
  avgMs: number;
}

/** localStorage schema version. Bump + migrate when any persisted shape changes. */
export const PERSISTED_VERSION = 2;

export interface Persisted {
  version: typeof PERSISTED_VERSION;
  attempts: Attempt[];
  mistakes: MistakeRef[];
  mocks: MockResult[];
}
