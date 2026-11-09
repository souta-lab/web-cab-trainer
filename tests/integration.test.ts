import { describe, expect, it } from 'vitest';
import { generateProblem } from '../src/generators';
import { validateProblem } from '../src/domain/invariants';
import { SUBJECTS } from '../src/domain/types';
import type { FigObj, Primitive } from '../src/domain/types';
import { applyPrimitives, figureKey, visualKey } from '../src/domain/figure';
import { CMD_LABEL } from '../src/domain/recipe';
import type { CipherRule, CmdName } from '../src/domain/recipe';
import { expectedShares } from '../src/generators/policy';
import { Rng } from '../src/domain/rng';

const SEEDS = 3000;

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

describe('integration: generateProblem pipeline', () => {
  it('every subject over 3000 seeds satisfies invariants, determinism and seed reproducibility', () => {
    for (const subject of SUBJECTS) {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const problem = generateProblem(subject, seed);
        const violations = validateProblem(problem);
        expect(violations).toEqual([]);
        expect(problem.seed).toBe(seed);
        expect(problem.subject).toBe(subject);
        // Seed reproducibility: regenerating from the problem's own fields is exact.
        expect(deepEqual(generateProblem(subject, seed, problem.difficulty), problem)).toBe(true);
      }
    }
  }, 120000);

  it('figure problems satisfy applyPrimitives(start, ops) === choices[correctIndex]', () => {
    const figureSubjects = ['pattern', 'commands', 'cipher'] as const;
    for (const subject of figureSubjects) {
      for (let seed = 1; seed <= 1000; seed++) {
        const problem = generateProblem(subject, seed);
        if (problem.subject === 'arithmetic') throw new Error('unreachable subject');
        expect(figureKey(applyPrimitives(problem.start, problem.ops))).toBe(
          figureKey(problem.choices[problem.correctIndex]),
        );
      }
    }
  }, 120000);

  it('figure choices are pairwise distinct in appearance (visualKey)', () => {
    const figureSubjects = ['pattern', 'commands', 'cipher'] as const;
    for (const subject of figureSubjects) {
      for (let seed = 1; seed <= 2000; seed++) {
        const problem = generateProblem(subject, seed);
        if (problem.subject === 'arithmetic') throw new Error('unreachable subject');
        const keys = problem.choices.map((c) => visualKey(c));
        expect(new Set(keys).size).toBe(keys.length);
      }
    }
  }, 120000);

  it('explicit difficulty is honored and deterministic', () => {
    const difficulties = [1, 2, 3] as const;
    for (const subject of SUBJECTS) {
      for (const difficulty of difficulties) {
        const problem = generateProblem(subject, 123456, difficulty);
        expect(problem.difficulty).toBe(difficulty);
        expect(deepEqual(generateProblem(subject, 123456, difficulty), problem)).toBe(true);
      }
    }
  });
});

describe('integration: generator output matches policy targets', () => {
  it('pattern rule count, command figure/command count and cipher composition aggregate to expectedShares', () => {
    const n = 30000;
    const pattern: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 };
    const figures: Record<2 | 3 | 4, number> = { 2: 0, 3: 0, 4: 0 };
    let commandOverflow = 0;
    const cipher: Record<'single' | 'multi', number> = { single: 0, multi: 0 };

    for (let seed = 1_000_000; seed < 1_000_000 + n; seed++) {
      const p = generateProblem('pattern', seed);
      if (p.subject !== 'pattern') throw new Error('unreachable subject');
      if (p.skillTags.includes('composite-3')) pattern[3]++;
      else if (p.skillTags.includes('composite-2')) pattern[2]++;
      else pattern[1]++;

      const c = generateProblem('commands', seed);
      if (c.subject !== 'commands') throw new Error('unreachable subject');
      const count = c.start.objects.length;
      if (count === 2 || count === 3 || count === 4) figures[count]++;
      if ((c.commandPlan ?? []).some((entry) => entry.slot === null)) commandOverflow++;

      const e = generateProblem('cipher', seed);
      if (e.subject !== 'cipher') throw new Error('unreachable subject');
      if (e.skillTags.includes('cipher-multi')) cipher.multi++;
      else cipher.single++;
    }

    const expected = expectedShares();
    // 30k draws, uniform difficulty: use generous 6pp to absorb seed correlation.
    expect(Math.abs(pattern[1] / n - expected.patternRuleCount[1])).toBeLessThan(0.06);
    expect(Math.abs(pattern[2] / n - expected.patternRuleCount[2])).toBeLessThan(0.06);
    expect(Math.abs(pattern[3] / n - expected.patternRuleCount[3])).toBeLessThan(0.06);
    expect(Math.abs(figures[2] / n - expected.commandFigureCount[2])).toBeLessThan(0.06);
    expect(Math.abs(figures[3] / n - expected.commandFigureCount[3])).toBeLessThan(0.06);
    expect(Math.abs(figures[4] / n - expected.commandFigureCount[4])).toBeLessThan(0.06);
    expect(Math.abs(commandOverflow / n - expected.commandOverflow)).toBeLessThan(0.06);
    expect(Math.abs(cipher.single / n - expected.cipherComposition.single)).toBeLessThan(0.06);
    expect(Math.abs(cipher.multi / n - expected.cipherComposition.multi)).toBeLessThan(0.06);
  }, 120000);

  it('difficulty ramps: pattern rule count increases with difficulty', () => {
    const avgRuleCount = (difficulty: 1 | 2 | 3): number => {
      let total = 0;
      const n = 4000;
      for (let seed = 2_000_000; seed < 2_000_000 + n; seed++) {
        const p = generateProblem('pattern', seed, difficulty);
        if (p.subject !== 'pattern') throw new Error('unreachable subject');
        if (p.skillTags.includes('composite-3')) total += 3;
        else if (p.skillTags.includes('composite-2')) total += 2;
        else total += 1;
      }
      return total / n;
    };
    expect(avgRuleCount(1)).toBeLessThan(avgRuleCount(2));
    expect(avgRuleCount(2)).toBeLessThan(avgRuleCount(3));
  }, 60000);

  it('Rng is used consistently: same seed block yields identical samples', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    expect(a.pick(SUBJECTS)).toBe(b.pick(SUBJECTS));
    expect(a.int(1, 100)).toBe(b.int(1, 100));
  });
});

describe('integration: figure shape variety and per-shape visibility', () => {
  const figureSubjects = ['pattern', 'commands', 'cipher'] as const;
  type MainShape = Extract<FigObj['shape'], 'circle' | 'square' | 'triangle' | 'arrow'>;
  const MAIN_SHAPES: readonly MainShape[] = ['circle', 'square', 'triangle', 'arrow'];
  const ALL_COMMANDS: readonly CmdName[] = [
    'FlipV',
    'FlipH',
    'Flip180',
    'DeletePrev',
    'DeleteNext',
    'SwapPrev',
    'CancelPrevCommand',
    'CancelNextCommand',
    'ReorderR',
    'ReorderS',
    'ReorderJ',
  ];
  const ALL_CIPHER_RULES: readonly CipherRule['type'][] = [
    'rotation',
    'fill',
    'flip',
    'inside-outside',
    'move',
    'add-dot',
  ];
  /** Ops whose effect is visible for each main shape, per figure subject. */
  const VISIBLE_OPS: Record<'pattern' | 'cipher', Record<MainShape, readonly Primitive['op'][]>> = {
    pattern: {
      arrow: ['rotate', 'moveMarker', 'toggleFill', 'flipH', 'flipV'],
      triangle: ['rotate', 'moveMarker', 'toggleFill'],
      square: ['moveMarker', 'toggleFill'],
      circle: ['moveMarker', 'toggleFill'],
    },
    cipher: {
      arrow: ['rotate', 'toggleFill', 'flipH', 'flipV', 'swapObjects', 'moveMarker', 'addDot'],
      triangle: ['rotate', 'toggleFill', 'swapObjects', 'moveMarker', 'addDot'],
      square: ['toggleFill', 'swapObjects', 'moveMarker', 'addDot'],
      circle: ['toggleFill', 'swapObjects', 'moveMarker', 'addDot'],
    },
  };
  const LABEL_TO_COMMAND = new Map<string, CmdName>(
    ALL_COMMANDS.map((command): [string, CmdName] => [CMD_LABEL[command], command]),
  );

  function mainShapeOf(problem: ReturnType<typeof generateProblem>): MainShape | null {
    if (problem.subject === 'arithmetic') throw new Error('unreachable subject');
    const main = problem.start.objects[0];
    if (main === undefined) return null;
    switch (main.shape) {
      case 'circle':
      case 'square':
      case 'triangle':
      case 'arrow':
        return main.shape;
      default:
        return null;
    }
  }

  it('restores shape variety: every figure subject uses its shape vocabulary', () => {
    const commandShapes = new Set<MainShape>();
    const seen = new Map<string, Set<MainShape>>();
    for (const subject of figureSubjects) {
      const perSubject = new Set<MainShape>();
      seen.set(subject, perSubject);
      for (let seed = 1; seed <= 1000; seed++) {
        const shape = mainShapeOf(generateProblem(subject, seed));
        if (shape !== null) perSubject.add(shape);
      }
    }
    for (const subject of ['pattern', 'cipher'] as const) {
      for (const shape of MAIN_SHAPES) {
        expect(seen.get(subject)?.has(shape), `${subject} never used ${shape}`).toBe(true);
      }
    }
    for (let seed = 1; seed <= 1000; seed++) {
      const commands = generateProblem('commands', seed);
      if (commands.subject !== 'commands') throw new Error('unreachable subject');
      for (const object of commands.start.objects) {
        if (object.shape !== 'circle' && object.shape !== 'dot' && object.shape !== 'line') {
          const shape: MainShape = object.shape;
          commandShapes.add(shape);
        }
      }
    }
    for (const shape of MAIN_SHAPES.filter((s) => s !== 'circle')) {
      expect(commandShapes.has(shape), `commands never used ${shape}`).toBe(true);
    }
  }, 120000);

  it('keeps all eleven commands and all six cipher rules reachable across seeds', () => {
    const commandsSeen = new Set<string>();
    const cipherRulesSeen = new Set<string>();
    for (let seed = 1; seed <= 2000; seed++) {
      const commands = generateProblem('commands', seed);
      if (commands.subject !== 'commands') throw new Error('unreachable subject');
      for (const commandLabel of commands.commandLabels ?? []) commandsSeen.add(commandLabel);

      const cipher = generateProblem('cipher', seed);
      if (cipher.subject !== 'cipher') throw new Error('unreachable subject');
      for (const op of cipher.ops) {
        switch (op.op) {
          case 'rotate':
            cipherRulesSeen.add('rotation');
            break;
          case 'toggleFill':
            cipherRulesSeen.add('fill');
            break;
          case 'flipH':
          case 'flipV':
            cipherRulesSeen.add('flip');
            break;
          case 'swapObjects':
            cipherRulesSeen.add('inside-outside');
            break;
          case 'moveMarker':
            cipherRulesSeen.add('move');
            break;
          case 'addDot':
            cipherRulesSeen.add('add-dot');
            break;
          default:
            break;
        }
      }
    }
    for (const command of ALL_COMMANDS) {
      expect(commandsSeen.has(CMD_LABEL[command]), `command=${command}`).toBe(true);
    }
    for (const rule of ALL_CIPHER_RULES) {
      expect(cipherRulesSeen.has(rule), `rule=${rule}`).toBe(true);
    }
  }, 120000);

  it('attaches every command to a real figure slot in the commands column', () => {
    for (let seed = 1; seed <= 2000; seed++) {
      const problem = generateProblem('commands', seed);
      if (problem.subject !== 'commands') throw new Error('unreachable subject');
      const tag = `commands seed=${seed}`;
      const figureCount = problem.start.objects.length;
      const plan = problem.commandPlan ?? [];
      expect(plan.map((entry) => entry.label), tag).toEqual(problem.commandLabels ?? []);
      for (const entry of plan) {
        const command = LABEL_TO_COMMAND.get(entry.label);
        if (command === undefined) throw new Error(`unknown command label: ${entry.label}`);
        if (entry.slot === null) {
          expect(['ReorderR', 'ReorderS', 'ReorderJ'].includes(command), tag).toBe(true);
        } else {
          expect(entry.slot >= 0 && entry.slot < figureCount, tag).toBe(true);
        }
      }
      const figureSlots = plan.map((entry) => entry.slot).filter((slot): slot is number => slot !== null);
      expect(new Set(figureSlots).size, tag).toBe(figureSlots.length);
    }
  }, 120000);

  it('applies only rules that are visible for the main shape (pattern/cipher)', () => {
    for (const subject of ['pattern', 'cipher'] as const) {
      for (let seed = 1; seed <= 1000; seed++) {
        const problem = generateProblem(subject, seed);
        const shape = mainShapeOf(problem);
        if (shape === null) throw new Error(`missing main shape: ${subject} seed=${seed}`);
        if (problem.subject === 'arithmetic') throw new Error('unreachable subject');
        const tag = `${subject} seed=${seed} shape=${shape}`;
        const visible = VISIBLE_OPS[subject][shape];
        for (const op of problem.ops) {
          expect(visible.includes(op.op), `${tag} op=${op.op}`).toBe(true);
        }
      }
    }
  }, 120000);
});
