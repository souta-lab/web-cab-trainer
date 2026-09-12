import { useMemo, useState } from 'react';
import { generateProblem } from '../generators';
import { loadPersisted, removeMistake } from '../storage/store';
import { Figure } from '../components/Figure';
import type { Problem } from '../types';

export function Mistakes() {
  const [tick, setTick] = useState(0);
  const p = useMemo(() => loadPersisted(), [tick]);
  const [openSeed, setOpenSeed] = useState<number | null>(null);
  const items = p.mistakes.slice(-50).reverse();
  let open: Problem | null = null;
  if (openSeed !== null) {
    const m = p.mistakes.find((x) => x.seed === openSeed);
    if (m) open = generateProblem(m.subject, m.seed);
  }
  return (
    <div>
      <a href="#/">‹ トップ</a>
      <h1>復習</h1>
      <p style={{ color: 'var(--muted)' }}>間違えた問題は seed から完全再現できます。</p>
      {items.length === 0 ? <p>まだ間違い記録がありません。</p> : (
        <ul>
          {items.map((m, i) => (
            <li key={`${m.seed}-${i}`}>
              <button onClick={() => setOpenSeed(m.seed)}>{m.subject} · seed {m.seed}</button>
              <button onClick={() => { removeMistake(m.seed); setTick((t) => t + 1); }} aria-label="削除">済</button>
            </li>
          ))}
        </ul>
      )}
      {open && <MistakeView problem={open} />}
    </div>
  );
}

function MistakeView({ problem }: { problem: Problem }) {
  if (problem.subject === 'arithmetic') {
    return (
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginTop: 12 }}>
        <p style={{ fontSize: 28, fontFamily: 'monospace' }}>{problem.display}</p>
        <p>正解: {problem.answer}（選択肢 {problem.correctIndex + 1}）</p>
        <p style={{ color: 'var(--muted)' }}>解法: {problem.explanation}</p>
      </div>
    );
  }
  const fp = problem as Extract<Problem, { subject: 'pattern' | 'commands' | 'cipher' }>;
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginTop: 12 }}>
      <p>{fp.prompt}</p>
      {fp.examples && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Figure state={fp.examples[0].input} size={80} />
          <span>→</span>
          <Figure state={fp.examples[0].output} size={80} />
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {fp.choices.map((c, i) => (
          <span key={i} style={{ border: i === fp.correctIndex ? '2px solid green' : '1px solid var(--border)', borderRadius: 8, padding: 4 }}>
            <Figure state={c} size={84} label={`選択肢${i + 1}${i === fp.correctIndex ? '(正解)' : ''}`} />
          </span>
        ))}
      </div>
      <p style={{ color: 'var(--muted)' }}>解法: {problem.explanation}</p>
    </div>
  );
}
