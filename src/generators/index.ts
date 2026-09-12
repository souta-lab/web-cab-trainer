// Public generator API. All problems are built from the frozen domain contract.

import type { Difficulty, Problem, Subject } from '../domain/types';
import { generateArithmetic } from './arithmetic';
import { generatePattern } from './pattern';
import { generateCommands } from './commands';
import { generateCipher } from './cipher';

function assertNever(x: never): never {
  throw new Error(`unexpected subject: ${String(x)}`);
}

export function generateProblem(subject: Subject, seed: number, difficulty?: Difficulty): Problem {
  switch (subject) {
    case 'arithmetic':
      return generateArithmetic({ seed, difficulty });
    case 'pattern':
      return generatePattern({ seed, difficulty });
    case 'commands':
      return generateCommands({ seed, difficulty });
    case 'cipher':
      return generateCipher({ seed, difficulty });
    default:
      return assertNever(subject);
  }
}

export { generateArithmetic, generatePattern, generateCommands, generateCipher };
export { CMD_LABEL, expandCommand, expandCipherRule, expandPatternRule, sequenceOps } from '../domain/recipe';
export { applyPrimitives, figureKey, figuresEqual } from '../domain/figure';
