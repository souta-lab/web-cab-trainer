// Test-facing contract validator. Used by dev asserts and property tests.
// It owns PROBLEM-SHAPE rules only — never generation weights (see policy.ts).

import { applyPrimitives, figuresEqual, visualKey } from './figure';
import { verifyArith } from './recipe';
import type { ArithmeticProblem, FigureProblem, Problem } from './types';

export interface InvariantViolation {
  code: string;
  message: string;
}

export const CHOICE_COUNT = 5;
export const MAX_ABS_ANSWER = 10000;

export function validateProblem(p: Problem): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  if (p.explanation.trim().length === 0) {
    violations.push({ code: 'empty-explanation', message: 'explanation must not be empty' });
  }
  if (p.fingerprint.trim().length === 0) {
    violations.push({ code: 'empty-fingerprint', message: 'fingerprint must not be empty' });
  }
  if (p.subject === 'arithmetic') {
    validateArithmetic(p, violations);
  } else {
    validateFigure(p, violations);
  }
  return violations;
}

function validateArithmetic(p: ArithmeticProblem, out: InvariantViolation[]): void {
  if (p.choices.length !== CHOICE_COUNT) {
    out.push({ code: 'choice-count', message: `expected ${CHOICE_COUNT} choices, got ${p.choices.length}` });
  }
  if (p.choices.some((c) => !Number.isFinite(c))) {
    out.push({ code: 'non-finite-choice', message: 'all choices must be finite' });
  }
  if (new Set(p.choices).size !== p.choices.length) {
    out.push({ code: 'duplicate-choice', message: 'choices must be pairwise distinct' });
  }
  const answerCount = p.choices.filter((c) => c === p.answer).length;
  if (answerCount !== 1) {
    out.push({ code: 'answer-count', message: `answer must appear exactly once (found ${answerCount})` });
  }
  if (p.correctIndex < 0 || p.correctIndex >= p.choices.length) {
    out.push({ code: 'correct-index-range', message: `correctIndex ${p.correctIndex} out of range` });
  } else if (p.choices[p.correctIndex] !== p.answer) {
    out.push({ code: 'correct-index-mismatch', message: 'choices[correctIndex] must equal answer' });
  }
  if (!Number.isFinite(p.answer) || Math.abs(p.answer) > MAX_ABS_ANSWER) {
    out.push({ code: 'answer-bounds', message: `answer must be finite and |answer| <= ${MAX_ABS_ANSWER}` });
  }
  const verified = verifyArith(p.recipe);
  if (!verified.ok) {
    out.push({ code: 'recipe-invalid', message: verified.reason ?? 'recipe verification failed' });
  }
}

function validateFigure(p: FigureProblem, out: InvariantViolation[]): void {
  if (p.choices.length !== CHOICE_COUNT) {
    out.push({ code: 'choice-count', message: `expected ${CHOICE_COUNT} choices, got ${p.choices.length}` });
  }
  const keys = p.choices.map((c) => visualKey(c));
  if (new Set(keys).size !== keys.length) {
    out.push({ code: 'duplicate-choice', message: 'figure choices must be pairwise distinct by visualKey' });
  }
  const expected = applyPrimitives(p.start, p.ops);
  if (p.correctIndex < 0 || p.correctIndex >= p.choices.length) {
    out.push({ code: 'correct-index-range', message: `correctIndex ${p.correctIndex} out of range` });
  } else if (!figuresEqual(p.choices[p.correctIndex], expected)) {
    out.push({
      code: 'correct-index-mismatch',
      message: 'choices[correctIndex] must equal applyPrimitives(start, ops)',
    });
  }
}
