import { useMemo } from 'react';
import { summarize, weaknesses, withPace, PACE_SEC_PER_Q } from '../stats/engine';
import { loadPersisted } from '../storage/store';

export function StatsPage() {
  const p = useMemo(() => loadPersisted(), []);
  const s = summarize(p.attempts);
  const bySubject = (['arithmetic', 'pattern', 'commands', 'cipher'] as const).map((k) => {
    const arr = p.attempts.filter((a) => a.subject === k);
    const base = summarize(arr);
    return { k, ...withPace(base, PACE_SEC_PER_Q[k]) };
  });
  const weak = weaknesses(p.attempts);
  const recent = p.attempts.slice(-100);
  return (
    <div>
      <a href="#/">‹ トップ</a>
      <h1>統計</h1>
      <ul>
        <li>総回答数: {s.answered} · 正答率: {(s.accuracy * 100).toFixed(1)}%</li>
        <li>平均: {(s.avgMs / 1000).toFixed(1)}s · 中央値: {(s.medianMs / 1000).toFixed(1)}s · p90: {(s.p90Ms / 1000).toFixed(1)}s · best streak: {s.bestStreak}</li>
      </ul>
      <h2>科目別</h2>
      <table style={{ borderCollapse: 'collapse' }}>
        <thead><tr><th>科目</th><th>回答</th><th>正答率</th><th>平均</th><th>中央値</th><th>ペース差</th></tr></thead>
        <tbody>
          {bySubject.map((r) => (
            <tr key={r.k}>
              <td>{r.k}</td><td>{r.answered}</td><td>{(r.accuracy * 100).toFixed(0)}%</td>
              <td>{(r.avgMs / 1000).toFixed(1)}s</td><td>{(r.medianMs / 1000).toFixed(1)}s</td>
              <td>{r.paceDiffMs !== null ? `${(r.paceDiffMs / 1000).toFixed(1)}s` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>弱点</h2>
      {weak.length === 0 ? <p>十分なデータがありません（各タグ5問以上で表示）。</p> : (
        <ul>
          {weak.map((w) => (
            <li key={w.tag}>弱点: {w.tag} — 正答率 {(w.accuracy * 100).toFixed(0)}% (n={w.answered}) 平均 {(w.avgMs / 1000).toFixed(1)}s</li>
          ))}
        </ul>
      )}
      <h2>最近100問の推移</h2>
      <p style={{ fontFamily: 'monospace', wordBreak: 'break-all' }} aria-label="最近の正誤">
        {recent.map((a) => (a.correct ? '○' : '×')).join('') || '—'}
      </p>
      <h2>模試履歴</h2>
      {p.mocks.length === 0 ? <p>—</p> : (
        <ul>{p.mocks.slice(-10).reverse().map((m, i) => (
          <li key={i}>{new Date(m.at).toLocaleString()} · {m.subject} · {m.correct}/{m.answered} · avg {(m.avgMs / 1000).toFixed(1)}s</li>
        ))}</ul>
      )}
    </div>
  );
}
