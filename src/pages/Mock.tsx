import { useEffect, useMemo, useRef, useState } from 'react';
import { generateProblem } from '../generators';
import type { Problem, Subject } from '../types';
import { PACE_SEC_PER_Q, summarize, withPace } from '../stats/engine';
import { loadPersisted, loadSettings, saveAttempt, saveMock } from '../storage/store';
import { randomSeed } from '../utils/rng';
import { Figure } from '../components/Figure';
import { SUBJECT_LABEL } from './Home';

const ORDER: Subject[] = ['arithmetic', 'pattern', 'commands', 'cipher'];

export function Mock() {
  const settings = useMemo(() => loadSettings(), []);
  const [subject, setSubject] = useState<Subject | 'mixed'>('arithmetic');
  const [started, setStarted] = useState(false);
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [msList, setMsList] = useState<number[]>([]);
  const [correctList, setCorrectList] = useState<boolean[]>([]);
  const [done, setDone] = useState(false);
  const t0 = useRef(performance.now());
  const endAt = useRef(0);
  const [remain, setRemain] = useState('');

  const total = subject === 'mixed'
    ? ORDER.reduce((s, k) => s + settings.mock[k].questions, 0)
    : settings.mock[subject].questions;
  const minutes = subject === 'mixed'
    ? ORDER.reduce((s, k) => s + settings.mock[k].minutes, 0)
    : settings.mock[subject].minutes;

  const start = () => {
    const list: Problem[] = [];
    if (subject === 'mixed') {
      for (const k of ORDER) for (let i = 0; i < settings.mock[k].questions; i++) list.push(generateProblem(k, randomSeed(), 2));
    } else {
      for (let i = 0; i < settings.mock[subject].questions; i++) list.push(generateProblem(subject, randomSeed(), 2));
    }
    setProblems(list); setIdx(0); setChosen(null); setMsList([]); setCorrectList([]); setDone(false);
    endAt.current = performance.now() + minutes * 60 * 1000;
    t0.current = performance.now();
    setStarted(true);
    try { localStorage.setItem('webcab.mock.resume', JSON.stringify({ subject, at: Date.now() })); } catch { /* noop */ }
  };

  useEffect(() => {
    if (!started || done) return;
    const iv = setInterval(() => {
      const left = endAt.current - performance.now();
      if (left <= 0) { finish(true); clearInterval(iv); return; }
      const s = Math.ceil(left / 1000);
      setRemain(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
    }, 250);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, done]);

  const cur = problems[idx];
  const correctIdx = cur ? (cur.subject === 'arithmetic'
    ? (cur as Extract<Problem, { subject: 'arithmetic' }>).correctIndex
    : (cur as Extract<Problem, { subject: 'pattern' | 'commands' | 'cipher' }>).correctIndex) : 0;

  const answer = (i: number) => {
    if (chosen !== null || !cur) return;
    const ms = Math.round(performance.now() - t0.current);
    const ok = i === correctIdx;
    saveAttempt({
      id: `${Date.now()}-${i}`, seed: cur.seed, subject: cur.subject, difficulty: cur.difficulty,
      skillTags: cur.skillTags, correct: ok, ms, at: Date.now(), problem: cur, chosenIndex: i,
    });
    setChosen(i);
    setMsList((m) => [...m, ms]);
    setCorrectList((c) => [...c, ok]);
  };

  const next = () => {
    if (idx + 1 >= problems.length) { finish(false); return; }
    setIdx((v) => v + 1); setChosen(null);
    t0.current = performance.now();
  };

  const finish = (timeout: boolean) => {
    void timeout;
    setDone(true);
    const answered = correctList.length + (chosen !== null && !correctList.length ? 0 : 0);
    const correct = correctList.filter(Boolean).length + (chosen !== null && problems[idx] ? (chosen === correctIdx ? 1 : 0) : 0);
    const avg = msList.length ? Math.round(msList.reduce((a, b) => a + b, 0) / msList.length) : 0;
    saveMock({ at: Date.now(), subject, answered: answered || problems.length, correct, avgMs: avg });
    try { localStorage.removeItem('webcab.mock.resume'); } catch { /* noop */ }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!started || done || !cur) return;
      if (e.key >= '1' && e.key <= '5') {
        const n = cur.subject === 'arithmetic'
          ? (cur as Extract<Problem, { subject: 'arithmetic' }>).choices.length
          : (cur as Extract<Problem, { subject: 'pattern' | 'commands' | 'cipher' }>).choices.length;
        const i = Number(e.key) - 1;
        if (i < n) answer(i);
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (chosen !== null) { e.preventDefault(); next(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, done, cur, chosen]);

  if (!started) {
    return (
      <div>
        <a href="#/">‹ トップ</a>
        <h1>総合模試</h1>
        <p style={{ color: 'var(--muted)' }}>本番形式: 解説なし・正誤表示なし。残り時間と問題番号のみ。</p>
        <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
          {(['arithmetic', 'pattern', 'commands', 'cipher', 'mixed'] as const).map((s) => (
            <button key={s} onClick={() => setSubject(s)} aria-pressed={subject === s}>
              {s === 'mixed' ? '全科目' : SUBJECT_LABEL[s]}
            </button>
          ))}
        </div>
        <p>問題数 {total}問 / {minutes}分 {subject !== 'mixed' && <span>(目安 {PACE_SEC_PER_Q[subject as Subject].toFixed(1)}s/問)</span>}</p>
        <button onClick={start} style={{ fontSize: 18, padding: '10px 24px' }}>開始</button>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>設定から問題数・時間を変更できます。途中終了時はブラウザを閉じても記録は残ります。</p>
      </div>
    );
  }

  if (done) {
    const attempts = loadPersisted().attempts.slice(-Math.max(1, correctList.length + 1));
    const s = withPace(summarize(attempts), subject === 'mixed' ? 20 : PACE_SEC_PER_Q[subject as Subject]);
    return (
      <div>
        <h1>結果</h1>
        <ul>
          <li>正答数: {correctList.filter(Boolean).length + (chosen !== null && chosen === correctIdx ? 1 : 0)} / {problems.length}</li>
          <li>正答率: {(s.accuracy * 100).toFixed(1)}%</li>
          <li>平均: {(s.avgMs / 1000).toFixed(1)}s · 中央値: {(s.medianMs / 1000).toFixed(1)}s · p90: {(s.p90Ms / 1000).toFixed(1)}s</li>
          <li>本番ペース比較: {s.paceDiffMs !== null && s.paceDiffMs >= 0 ? `目標より${(s.paceDiffMs / 1000).toFixed(1)}s速い` : `目標より${(((s.paceDiffMs ?? 0) * -1) / 1000).toFixed(1)}s遅い`}</li>
        </ul>
        <p style={{ color: 'var(--muted)' }}>※これは練習ペースの目安であり、合否判定ではありません。</p>
        <a href="#/">トップへ</a> <a href="#/stats">統計へ</a>
      </div>
    );
  }

  if (!cur) return <p>生成中…</p>;
  return (
    <div>
      <p>残り {remain} · {idx + 1}/{problems.length}問 · 回答 {chosen !== null ? '済' : '—'}（正誤・解説なし）</p>
      <MockQuestion problem={cur} onAnswer={answer} />
      <div style={{ marginTop: 8 }}><button onClick={next} disabled={chosen === null}>次へ (Enter)</button></div>
    </div>
  );
}

function MockQuestion({ problem, onAnswer }: { problem: Problem; onAnswer: (i: number) => void }) {
  if (problem.subject === 'arithmetic') {
    return (
      <div>
        <p style={{ fontSize: 32, fontFamily: 'monospace' }}>{problem.display}</p>
        <ol style={{ display: 'flex', gap: 8, listStyle: 'none', padding: 0 }}>
          {problem.choices.map((c, i) => <li key={i}><button onClick={() => onAnswer(i)}>[{i + 1}] {c}</button></li>)}
        </ol>
      </div>
    );
  }
  const fp = problem as Extract<Problem, { subject: 'pattern' | 'commands' | 'cipher' }>;
  return (
    <div>
      <p style={{ color: 'var(--muted)', fontSize: 13 }}>{fp.prompt}</p>
      {fp.commandSeq && <div style={{ display: 'flex', gap: 6 }}>{fp.commandSeq.map((c, i) => <code key={i}>{c}</code>)}</div>}
      {fp.examples && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Figure state={fp.examples[0].input} size={80} /><span>→</span><Figure state={fp.examples[0].output} size={80} /></div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {fp.subject === 'pattern' ? fp.frames.map((f, i) => i === fp.missingIndex
          ? <span key={i} style={{ width: 110, height: 110, display: 'grid', placeItems: 'center', border: '2px dashed var(--border)', borderRadius: 8 }}>?</span>
          : <Figure key={i} state={f} size={110} />)
          : <>{fp.start && <Figure state={fp.start} size={110} />}</>}
      </div>
      <ol style={{ display: 'flex', gap: 8, listStyle: 'none', padding: 0 }}>
        {fp.choices.map((c, i) => <li key={i}><button onClick={() => onAnswer(i)} style={{ padding: 4 }}>[{i + 1}]<Figure state={c} size={88} /></button></li>)}
      </ol>
    </div>
  );
}
