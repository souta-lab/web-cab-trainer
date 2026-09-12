import type { FigState, ShapeKind } from '../domain/types';
import { markerSlotShown } from '../domain/figure';

const SHAPE_JA: Record<ShapeKind, string> = {
  circle: '円',
  square: '正方形',
  triangle: '三角形',
  arrow: '矢印',
  dot: '点',
  line: '線',
};

const MARKER_JA: Record<number, string> = {
  0: '左上',
  1: '右上',
  2: '右下',
  3: '左下',
};

const POS_X_JA = (x: number): string => (x < 45 ? '左' : x > 75 ? '右' : '中央');
const POS_Y_JA = (y: number): string => (y < 45 ? '上' : y > 75 ? '下' : '中央');

function positionJa(x: number, y: number): string {
  const vertical = POS_Y_JA(y);
  const horizontal = POS_X_JA(x);
  if (vertical === '中央' && horizontal === '中央') return '中央';
  if (vertical === '中央') return horizontal === '左' ? '左' : horizontal === '右' ? '右' : '中央';
  if (horizontal === '中央') return vertical === '上' ? '上' : '下';
  return `${vertical}${horizontal}`;
}

/** Screen-reader description of a figure, derived from the state. */
export function describeFigure(state: FigState): string {
  const parts: string[] = [];
  for (const o of state.objects) {
    const bits = [`${o.fill ? '塗りつぶし' : '白抜き'}の${SHAPE_JA[o.shape]}`, positionJa(o.x, o.y)];
    if (o.rot !== 0) bits.push(`${o.rot}度回転`);
    if (o.flipH) bits.push('左右反転');
    parts.push(bits.join('、'));
  }
  if (parts.length === 0) parts.push('図形なし');
  if (markerSlotShown(state) !== null) parts.push(`マーカーは${MARKER_JA[state.markerPos] ?? '不明'}`);
  return `図形: ${parts.join('。')}`;
}
