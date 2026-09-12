import type { JSX, ReactNode } from 'react';

export interface ChoiceGridItem {
  /** Stable identity (used as the React key and by parents to track choices). */
  readonly key: string;
  readonly content: ReactNode;
  /** Accessible name announced for this choice (e.g. "選択肢1: 42"). */
  readonly ariaLabel: string;
}

export interface ChoiceGridProps {
  readonly items: readonly ChoiceGridItem[];
  /** Index the user picked, or null before answering. */
  readonly chosenIndex: number | null;
  /** Index of the correct choice, or null before answering. */
  readonly correctIndex: number | null;
  readonly onChoose: (index: number) => void;
  /** Locks the grid externally (e.g. paused / time over). */
  readonly disabled?: boolean;
}

/**
 * Presentational answer picker. When `correctIndex` is `null` the pick is shown
 * but correctness is never revealed (mock mode): no text markers, no dimming.
 * With a real `correctIndex`, correctness is communicated with text ("正解" /
 * "不正解") plus colour, never colour alone. After answering every button is
 * disabled and non-chosen items dim via `--dim-opacity`.
 */
export function ChoiceGrid({
  items,
  chosenIndex,
  correctIndex,
  onChoose,
  disabled = false,
}: ChoiceGridProps): JSX.Element {
  const answered = chosenIndex !== null;
  const reveal = answered && correctIndex !== null;

  return (
    <ol className="choice-grid" aria-label="選択肢">
      {items.map((item, index) => {
        const isChosen = chosenIndex === index;
        const isCorrect = reveal && correctIndex === index;
        const isWrongPick = reveal && isChosen && correctIndex !== index;
        const classNames = ['choice'];
        if (isChosen) classNames.push('is-chosen');
        if (isCorrect) classNames.push('is-ok');
        if (isWrongPick) classNames.push('is-ng');
        if (reveal && !isCorrect && !isWrongPick) classNames.push('is-dim');

        return (
          <li key={item.key}>
            <button
              type="button"
              className={classNames.join(' ')}
              aria-label={item.ariaLabel}
              aria-keyshortcuts={String(index + 1)}
              aria-pressed={isChosen}
              disabled={disabled || answered}
              onClick={() => onChoose(index)}
            >
              <span className="choice__num" aria-hidden="true">
                {index + 1}
              </span>
              {item.content}
              {isCorrect && <span className="choice__marker">正解</span>}
              {isWrongPick && <span className="choice__marker">不正解</span>}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
