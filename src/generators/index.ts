import type { Difficulty, Problem, Subject } from '../types';
import { generateArithmetic } from './arithmetic';
import { generatePattern } from './pattern';
import { generateCommands } from './commands';
import { generateCipher } from './cipher';

export function generateProblem(subject: Subject, seed: number, difficulty?: Difficulty): Problem {
  switch (subject) {
    case 'arithmetic': return generateArithmetic({ seed, difficulty });
    case 'pattern': return generatePattern({ seed, difficulty });
    case 'commands': return generateCommands({ seed, difficulty });
    case 'cipher': return generateCipher({ seed, difficulty });
  }
}

export { generateArithmetic, generatePattern, generateCommands, generateCipher };
export { applyCommand, applyCommands, CMD_LABEL } from './commands';
export { applyCipher } from './cipher';
export { applyPatternRule } from './pattern';
