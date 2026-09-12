import type { JSX } from 'react';
import type { FigObj, FigState } from '../domain/types';
import { CORNERS, markerSlotShown } from '../domain/figure';
import { describeFigure } from './figureDescription';

/**
 * Renderer for a frozen `FigState` (lane F0 contract).
 *
 * Reads every field the domain carries: shape, x, y, rot, fill, size, flipH —
 * and `markerPos` when it is meaningful (see `markerSlotShown`). All colours come
 * from CSS tokens; the SVG inherits `color` from the `.figure` class.
 *
 * `label` is prepended to the derived Japanese description for the `aria-label`
 * (e.g. "選択肢1、図形: 塗りつぶしの矢印、中央"); with no label the description is
 * used alone. Both parts are always announced.
 */
export function Figure({
  state,
  size = 120,
  label,
}: {
  state: FigState;
  size?: number;
  label?: string;
}): JSX.Element {
  const description = describeFigure(state);
  const ariaLabel = label !== undefined && label !== '' ? `${label}、${description}` : description;

  return (
    <svg
      className="figure"
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label={ariaLabel}
    >
      {state.objects.map((o, i) => renderObject(o, i))}
      {markerSlotShown(state) !== null && (
        <circle
          cx={CORNERS[state.markerPos].x}
          cy={CORNERS[state.markerPos].y}
          r={9}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeDasharray="3 2"
          opacity={0.6}
        />
      )}
    </svg>
  );
}

/** Hollow shapes are filled with the tile colour, filled ones with the ink. */
function fillStyle(o: FigObj): { fill: string } {
  return { fill: o.fill ? 'currentColor' : 'var(--fig-bg)' };
}

function transformOf(o: FigObj): string {
  return `translate(${o.x} ${o.y}) rotate(${o.rot}) scale(${o.flipH ? -1 : 1} 1)`;
}

function renderObject(o: FigObj, key: number): JSX.Element {
  const t = transformOf(o);
  const fill = fillStyle(o);
  const s = o.size;

  switch (o.shape) {
    case 'circle':
      return (
        <circle key={key} r={s / 2} transform={t} style={fill} stroke="currentColor" strokeWidth={2} />
      );
    case 'square':
      return (
        <rect
          key={key}
          x={-s / 2}
          y={-s / 2}
          width={s}
          height={s}
          transform={t}
          style={fill}
          stroke="currentColor"
          strokeWidth={2}
        />
      );
    case 'triangle': {
      const h = (s * Math.sqrt(3)) / 2;
      return (
        <polygon
          key={key}
          points={`0,${-h / 2} ${-s / 2},${h / 2} ${s / 2},${h / 2}`}
          transform={t}
          style={fill}
          stroke="currentColor"
          strokeWidth={2}
          strokeLinejoin="round"
        />
      );
    }
    case 'arrow': {
      const head = Math.max(6, s * 0.3);
      return (
        <g key={key} transform={t}>
          <line x1={-s / 2} y1={0} x2={s / 2} y2={0} stroke="currentColor" strokeWidth={3} />
          <polygon
            points={`${s / 2},0 ${s / 2 - head},${-head * 0.75} ${s / 2 - head},${head * 0.75}`}
            style={fill}
            stroke="currentColor"
            strokeWidth={2}
          />
        </g>
      );
    }
    case 'dot':
      return (
        <circle key={key} r={Math.max(3, s / 2)} transform={t} fill="currentColor" />
      );
    case 'line':
      return (
        <line
          key={key}
          x1={-s / 2}
          y1={0}
          x2={s / 2}
          y2={0}
          transform={t}
          stroke="currentColor"
          strokeWidth={3}
        />
      );
    default:
      return assertNever(o.shape);
  }
}

function assertNever(x: never): never {
  throw new Error(`unexpected shape: ${String(x)}`);
}
