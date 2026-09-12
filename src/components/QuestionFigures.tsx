import type { CSSProperties, JSX } from 'react';
import type { FigureProblem } from '../domain/types';
import { Figure } from './Figure';

const CHIP: CSSProperties = {
  display: 'inline-block',
  padding: '4px 10px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--card)',
};

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
        <div className="question__figures" aria-label="開始図形と命令表">
          <Figure state={problem.start} label="開始図形" />
          <span className="question__arrow" aria-hidden="true">
            ＋
          </span>
          <ol
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'grid',
              gap: 'var(--space-1)',
            }}
          >
            {(problem.commandLabels ?? []).map((label, index) => (
              <li key={index}>
                <code style={CHIP}>{label}</code>
              </li>
            ))}
          </ol>
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
