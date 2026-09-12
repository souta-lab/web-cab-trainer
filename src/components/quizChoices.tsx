import type { Problem } from '../domain/types';
import type { ChoiceGridItem } from './ChoiceGrid';
import { Figure } from './Figure';
import { describeFigure } from './figureDescription';

/** Maps a problem's choices to grid items; identical labels in every mode. */
export function buildChoiceItems(problem: Problem): ChoiceGridItem[] {
  if (problem.subject === 'arithmetic') {
    return problem.choices.map((value, index) => ({
      key: `${problem.seed}-${index}`,
      content: value,
      ariaLabel: `選択肢${index + 1}: ${value}`,
    }));
  }
  return problem.choices.map((state, index) => ({
    key: `${problem.seed}-${index}`,
    content: <Figure state={state} size={96} label={`選択肢${index + 1}`} />,
    ariaLabel: `選択肢${index + 1}：${describeFigure(state)}`,
  }));
}
