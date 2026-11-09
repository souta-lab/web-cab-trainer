import type { JSX } from 'react';
import type { FigObj, FigureProblem } from '../domain/types';
import { Figure } from './Figure';

const FIGURE_SIZE = 72;

function CommandChip({ label }: { label: string }): JSX.Element {
  return <span className="question__cmd">{label}</span>;
}

function FigureWithCommand({ object, label, command }: { object: FigObj; label: string; command?: string }): JSX.Element {
  return (
    <span className="question__cmd-row">
      <Figure state={{ objects: [object], markerPos: 0 }} size={FIGURE_SIZE} label={label} />
      {command !== undefined && <CommandChip label={command} />}
    </span>
  );
}

/**
 * 命令表 column: one figure per row with the command it carries, then the
 * global reorder (if any). The narrow layout stacks; wide screens fold the
 * column in half to keep the choices in view.
 */
function CommandsColumn({ problem }: { problem: FigureProblem }): JSX.Element {
  const plan = problem.commandPlan ?? [];
  const globals = plan.filter((entry) => entry.slot === null);
  return (
    <div className="question__commands">
      <div className="question__cmd-half">
        {problem.start.objects.map((object, slot) => (
          <FigureWithCommand
            key={slot}
            object={object}
            label={`${slot + 1}番目の図形`}
            command={plan.find((entry) => entry.slot === slot)?.label}
          />
        ))}
      </div>
      <div className="question__cmd-global">
        {globals.map((entry, index) => (
          <CommandChip key={index} label={entry.label} />
        ))}
      </div>
    </div>
  );
}

/**
 * Question figures shared by practice, mock and mistakes: pattern sequence,
 * commands table, cipher example. Correctness is never rendered here — that is
 * `ChoiceGrid`'s `correctIndex` — so the mock can reuse it unchanged.
 */
export function QuestionFigures({ problem }: { problem: FigureProblem }): JSX.Element {
  switch (problem.subject) {
    case 'pattern':
      return (
        <div className="question__figures" aria-label="図形の並び">
          {(problem.frames ?? []).map((frame, index) =>
            index === problem.missingIndex ? (
              <span key={index} className="question__blank" role="img" aria-label="空欄">
                ?
              </span>
            ) : (
              <Figure key={index} state={frame} label={`図${index + 1}`} />
            ),
          )}
        </div>
      );
    case 'commands':
      return (
        <div className="question__figures" aria-label="命令表の図形と命令">
          <CommandsColumn problem={problem} />
        </div>
      );
    case 'cipher': {
      const example = problem.examples?.[0];
      return (
        <div className="question__figures" aria-label="入力と出力の例">
          {example !== undefined && (
            <>
              <Figure state={example.input} size={96} label="入力A" />
              <span className="question__arrow" aria-hidden="true">
                →
              </span>
              <Figure state={example.output} size={96} label="出力A" />
              <span className="question__arrow" aria-hidden="true">
                ／
              </span>
            </>
          )}
          <Figure state={problem.start} size={96} label="入力B" />
        </div>
      );
    }
  }
}
