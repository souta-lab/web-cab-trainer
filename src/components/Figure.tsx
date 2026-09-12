import type { FigState } from '../types';

export function Figure({ state, size = 120, label }: { state: FigState; size?: number; label?: string }) {
  const W = 120; const H = 120;
  const scale = size / W;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label ?? 'figure'}
      style={{ background: 'var(--fig-bg, #fff)', border: '1px solid var(--border)', borderRadius: 8 }}>
      <g transform={`scale(${scale})`}>
        {state.objects.map((o, i) => {
          const fill = o.fill ? '#1a1a1a' : '#ffffff';
          const stroke = '#1a1a1a';
          const key = i;
          const tr = `translate(${o.x} ${o.y}) rotate(${o.rot}) scale(${o.flipH ? -1 : 1} 1)`;
          if (o.shape === 'circle') return <circle key={key} cx={0} cy={0} r={o.size / 2} transform={tr} fill={fill} stroke={stroke} strokeWidth={2} />;
          if (o.shape === 'square') return <rect key={key} x={-o.size / 2} y={-o.size / 2} width={o.size} height={o.size} transform={tr} fill={fill} stroke={stroke} strokeWidth={2} />;
          if (o.shape === 'triangle') {
            const h = (o.size * Math.sqrt(3)) / 2;
            return <polygon key={key} points={`0,${-h / 2} ${-o.size / 2},${h / 2} ${o.size / 2},${h / 2}`} transform={tr} fill={fill} stroke={stroke} strokeWidth={2} strokeLinejoin="round" />;
          }
          if (o.shape === 'arrow') {
            return (
              <g key={key} transform={tr}>
                <line x1={-o.size / 2} y1={0} x2={o.size / 2} y2={0} stroke={stroke} strokeWidth={3} />
                <polygon points={`${o.size / 2},0 ${o.size / 2 - 8},-6 ${o.size / 2 - 8},6`} fill={fill} stroke={stroke} strokeWidth={2} />
              </g>
            );
          }
          if (o.shape === 'dot') return <circle key={key} cx={0} cy={0} r={Math.max(3, o.size / 2)} transform={`translate(${o.x} ${o.y})`} fill="#1a1a1a" />;
          return <line key={key} x1={-o.size / 2} y1={0} x2={o.size / 2} y2={0} transform={tr} stroke={stroke} strokeWidth={3} />;
        })}
      </g>
    </svg>
  );
}
