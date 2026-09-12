export type Subject = 'arithmetic' | 'pattern' | 'commands' | 'cipher';
export type Difficulty = 1 | 2 | 3;
export type SkillTag =
  | 'linear-basic' | 'linear-parens' | 'decimal' | 'fraction'
  | 'rotation' | 'reflection' | 'fill-toggle' | 'movement'
  | 'count' | 'inside-outside' | 'composite-2' | 'composite-3'
  | 'cmd-rotate' | 'cmd-flip' | 'cmd-toggle' | 'cmd-move' | 'cmd-cancel'
  | 'cipher-single' | 'cipher-multi';

export interface Choice {
  id: string;
  label: string;
  svg?: FigState | null;
}

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
  display: string;
  answer: number;
  choices: number[];
  correctIndex: number;
}

export interface FigureProblem extends BaseProblem {
  subject: 'pattern' | 'commands' | 'cipher';
  frames: FigState[];
  missingIndex: number;
  choices: FigState[];
  correctIndex: number;
  prompt: string;
  commandSeq?: string[];
  examples?: { input: FigState; output: FigState }[];
  start?: FigState;
}

export type Problem = ArithmeticProblem | FigureProblem;

export type ShapeKind = 'circle' | 'square' | 'triangle' | 'arrow' | 'dot' | 'line';
export interface FigObj {
  shape: ShapeKind;
  x: number; y: number;
  rot: 0 | 90 | 180 | 270;
  fill: boolean;
  size: number;
  flipH?: boolean;
}
export interface FigState {
  objects: FigObj[];
  markerPos?: number;
}

export interface Attempt {
  id: string;
  seed: number;
  subject: Subject;
  difficulty: Difficulty;
  skillTags: SkillTag[];
  correct: boolean;
  ms: number;
  at: number;
  problem: Problem;
  chosenIndex: number;
}

export interface SessionSummary {
  answered: number; correct: number; wrong: number;
  accuracy: number; avgMs: number; medianMs: number; p90Ms: number;
  bestStreak: number;
  vsPaceMs: number | null;
  paceDiffMs: number | null;
}

export interface MockConfig { questions: number; minutes: number; }
export type MockPreset = Record<Subject, MockConfig>;
