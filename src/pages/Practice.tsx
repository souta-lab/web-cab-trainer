import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generateProblem } from '../generators';
import type { Attempt, Difficulty, Problem, Subject } from '../types';
import { adaptiveDifficulty, PACE_SEC_PER_Q } from '../stats/engine';
import { loadPersisted, loadSettings, saveAttempt } from '../storage/store';
import { randomSeed } from '../utils/rng';
import { Figure } from '../components/Figure';
import { SUBJECT_LABEL } from './Home';

type Mode = 'practice' | 'speed' | 'attack';

export function Practice({ subject }: { subject: Subject }) {
  const settings = useMemo(() => loadSettings(), []);
  const [mode, setMode] = useState<Mode>('practice');
  const [attackMin, setAttackMin] = useState(3);
  const [difficulty, setDifficulty] = useState<Difficulty>(2);
  const [auto, setAuto] = useState(true);
  const [seed, setSeed] = useState(() => randomSeed());
  const [problem, setProblem] = useState<Problem>(() => generateProblem(subject, randomSeed(), 2));
  const [nextProblem, setNextProblem] = useState<Problem | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [results, setResults] = useState<Attempt[]>([]);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [warn, setWarn] = useState(false);
  const t0 = useRef(performance.now());
  const deadline = useRef(0);
  const [remain, setRemain] = useState('');

  // pre-generate next question for zero perceived delay
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setNextProblem(generateProblem(subject, randomSeed(), auto ? adaptiveDifficulty(loadPersisted().attempts.filter((a) => a.subject === subject), difficulty) : difficulty));
    });
    return () => cancelAnimationFrame(id);
  }, [problem, subject, auto, difficulty]);

  const newQuestion = useCallback((d?: Difficulty) => {
    const dd = d ?? difficulty;
    if (nextProblem && (d === undefined || true)) {
      setProblem(nextProblem);
    } else {
      setProblem(generateProblem(subject, randomSeed(), dd));
    }
    setNextProblem(null);
    setChosen(null);
    setWarn(false);
    t0.current = performance.now();
  }, [nextProblem, subject, difficulty]);

  useEffect(() => {
    setChosen(null); setResults([]); setOver(false);
    const p = generateProblem(subject, randomSeed(), difficulty);
    setProblem(p);
    t0.current = performance.now();
    if (mode === 'attack') deadline.current = performance.now() + attackMin * 60 * 1000;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, mode, attackMin]);

  // attack countdown (performance.now based, throttling-safe: compute from deadline)
  useEffect(() => {
    if (mode !== 'attack' || over) return;
    const iv = setInterval(() => {
      if (paused) return;
      const left = deadline.current - performance.now();
      if (left <= 0) { setOver(true); setRemain('0:00'); clearInterval(iv); return; }
      const s = Math.ceil(left / 1000);
      setRemain(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
    }, 250);
    return () => clearInterval(iv);
  }, [mode, over, paused, attackMin]);

  // speed target warning
  useEffect(() => {
    if (mode !== 'speed' || chosen !== null) return;
    const target = settings.speedTargetSec * 1000;
    const iv = setInterval(() => {
      setWarn(performance.now() - t0.current > target);
    }, 300);
    return () => clearInterval(iv);
  }, [mode, chosen, settings.speedTargetSec]);

  const answer = useCallback((idx: number) => {
    if (chosen !== null || paused || over) return;
    const ms = Math.round(performance.now() - t0.current);
    const correctIdx = problem.subject === 'arithmetic'
      ? (problem as Extract<Problem, { subject: 'arithmetic' }>).correctIndex
      : (problem as Extract<Problem, { subject: 'pattern' | 'commands' | 'cipher' }>).correctIndex;
    const ok = idx === correctIdx;
    const attempt: Attempt = {
      id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      seed: problem.seed, subject: problem.subject, difficulty: problem.difficulty,
      skillTags: problem.skillTags, correct: ok, ms, at: Date.now(), problem, chosenIndex: idx,
    };
    saveAttempt(attempt);
    setResults((r) => [...r, attempt]);
    setChosen(idx);
    setStreak((s) => (ok ? s + 1 : 0));
  }, [chosen, paused, over, problem]);

  // keyboard: 1-5 answer, Enter/Space next, P pause (practice only)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '5') {
        const i = Number(e.key) - 1;
        const n = problem.subject === 'arithmetic'
          ? (problem as Extract<Problem, { subject: 'arithmetic' }>).choices.length
          : (problem as Extract<Problem, { subject: 'pattern' | 'commands' | 'cipher' }>).choices.length;
        if (i < n) { e.preventDefault(); answer(i); }
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (chosen !== null || over) { e.preventDefault(); if (!over) newQuestion(); }
      } else if ((e.key === 'p' || e.key === 'P') && mode === 'practice') {
        setPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answer, chosen, over, newQuestion, mode, problem]);

  const correctIdx = problem.subject === 'arithmetic'
    ? (problem as Extract<Problem, { subject: 'arithmetic' }>).correctIndex
    : (problem as Extract<Problem, { subject: 'pattern' | 'commands' | 'cipher' }>).correctIndex;
  const acc = results.length ? results.filter((r) => r.correct).length / results.length : 0;
  const avgMs = results.length ? Math.round(results.reduce((s, r) => s + r.ms, 0) / results.length) : 0;

  return (
    <div>
      <nav style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <a href="#/">‹ トップ</a>
        <strong>{SUBJECT_LABEL[subject]}</strong>
        {(['practice', 'speed', 'attack'] as Mode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m}
            style={{ fontWeight: mode === m ? 700 : 400 }}>
            {m === 'practice' ? '練習' : m === 'speed' ? 'Speed' : 'TimeAttack'}
          </button>
        ))}
        {mode === 'attack' && (
          <select value={attackMin} onChange={(e) => setAttackMin(Number(e.target.value))} aria-label="制限時間">
            {settings.timeAttackMin.map((m) => <option key={m} value={m}>{m}分</option>)}
          </select>
        )}
        <label>難易度
          <select value={auto ? 'auto' : difficulty} onChange={(e) => {
            if (e.target.value === 'auto') setAuto(true);
            else { setAuto(false); setDifficulty(Number(e.target.value) as Difficulty); }
          }}>
            <option value="auto">自動</option>
            <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
          </select>
        </label>
        {mode === 'attack' && <span role="timer" aria-label="残り時間">残り {remain}</span>}
        {mode === 'practice' && <button onClick={() => setPaused((p) => !p)}>{paused ? '再開(P)' : '停止(P)'}</button>}
        <span style={{ marginLeft: 'auto' }}>正答率 {(acc * 100).toFixed(0)}% · 平均 {(avgMs / 1000).toFixed(1)}s · streak {streak} · 目標 {PACE_SEC_PER_Q[subject].toFixed(1)}s/問</span>
      </nav>

      {paused ? <p>一時停止中… Pキーで再開</p> : over ? (
        <div>
          <h2>終了 — {results.filter((r) => r.correct).length}/{results.length}問正解</h2>
          <button onClick={() => { setResults([]); setOver(false); deadline.current = performance.now() + attackMin * 60 * 1000; newQuestion(); }}>もう一度</button>
        </div>
      ) : (
        <QuestionView problem={problem} chosen={chosen} correctIdx={correctIdx} onAnswer={answer}
          showExplanation={mode === 'practice' && chosen !== null} warn={warn && chosen === null} seed={seed} setSeed={setSeed} />
      )}

      {mode === 'practice' && chosen !== null && !over && (
        <div style={{ marginTop: 12 }}>
          <p style={{ color: chosen === correctIdx ? 'green' : 'crimson', fontWeight: 700 }}>
            {chosen === correctIdx ? '○ 正解' : `× 不正解（正解: ${correctLabel(problem, correctIdx)}）`} · {(results[results.length - 1]?.ms / 1000).toFixed(1)}s
          </p>
          <p style={{ color: 'var(--muted)' }}>解法: {problem.explanation} (seed: {problem.seed})</p>
          <button onClick={() => newQuestion()} autoFocus>次へ (Enter)</button>
        </div>
      )}
      {(mode !== 'practice' && chosen !== null) && (
        <div style={{ marginTop: 8 }}><button onClick={() => newQuestion()} autoFocus>次へ (Enter)</button></div>
      )}
    </div>
  );
}

function correctLabel(p: Problem, idx: number): string {
  if (p.subject === 'arithmetic') return String(p.choices[idx]);
  return `選択肢${idx + 1}`;
}

function QuestionView({ problem, chosen, correctIdx, onAnswer, showExplanation: _show, warn, seed: _s, setSeed: _ss }: {
  problem: Problem; chosen: number | null; correctIdx: number;
  onAnswer: (i: number) => void; showExplanation: boolean; warn: boolean; seed: number; setSeed: (n: number) => void;
}) {
  void _show; void _s; void _ss;
  if (problem.subject === 'arithmetic') {
    return (
      <div>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>? に入る数値を選べ（キー1〜5）</p>
        <p style={{ fontSize: 34, fontFamily: 'monospace', letterSpacing: 1 }} aria-live="polite">{problem.display}</p>
        {warn && <p role="alert" style={{ color: 'darkorange' }}>目標超過！</p>}
        <ol style={{ display: 'flex', gap: 8, listStyle: 'none', padding: 0 }} aria-label="選択肢">
          {problem.choices.map((c, i) => {
            const state = chosen === null ? 'idle' : i === correctIdx ? 'ok' : i === chosen ? 'ng' : 'dim';
            return (
              <li key={i}>
                <button onClick={() => onAnswer(i)} aria-label={`選択肢${i + 1}: ${c}`}
                  style={choiceStyle(state)}>
                  <span style={{ color: 'var(--muted)', marginRight: 6 }}>[{i + 1}]</span>{c}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }
  const fp = problem as Extract<Problem, { subject: 'pattern' | 'commands' | 'cipher' }>;
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--muted)' }}>{fp.prompt}（キー1〜5）</p>
      {fp.subject === 'commands' && fp.commandSeq && (
        <div style={{ display: 'flex', gap: 6, margin: '8px 0', flexWrap: 'wrap' }} aria-label="命令表">
          {fp.commandSeq.map((c, i) => <code key={i} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6 }}>{c}</code>)}
        </div>
      )}
      {fp.examples && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '8px 0' }}>
          <span>例:</span>
          <Figure state={fp.examples[0].input} size={90} label="入力A" />
          <span aria-hidden>→</span>
          <Figure state={fp.examples[0].output} size={90} label="出力A" />
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }} aria-label="図形">
        {fp.subject === 'pattern' ? fp.frames.map((f, i) => (
          i === fp.missingIndex
            ? <span key={i} style={{ width: 120, height: 120, display: 'grid', placeItems: 'center', border: '2px dashed var(--border)', borderRadius: 8, fontSize: 28 }}>?</span>
            : <Figure key={i} state={f} label={`図${i + 1}`} />
        )) : (
          <>
            {fp.start && <><Figure state={fp.start} label="開始図形" /><span aria-hidden>{fp.subject === 'commands' ? '+' : '入力B'}</span></>}
            {!fp.examples && fp.frames[0] && fp.subject !== 'commands' && <Figure state={fp.frames[0]} label="入力" />}
          </>
        )}
      </div>
      {warn && <p role="alert" style={{ color: 'darkorange' }}>目標超過！</p>}
      <ol style={{ display: 'flex', gap: 8, listStyle: 'none', padding: 0, flexWrap: 'wrap' }} aria-label="選択肢">
        {fp.choices.map((c, i) => {
          const state = chosen === null ? 'idle' : i === correctIdx ? 'ok' : i === chosen ? 'ng' : 'dim';
          return (
            <li key={i}>
              <button onClick={() => onAnswer(i)} aria-label={`選択肢${i + 1}`} style={{ ...choiceStyle(state), padding: 6 }}>
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>[{i + 1}]</span>
                <Figure state={c} size={96} label={`選択肢${i + 1}`} />
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function choiceStyle(state: 'idle' | 'ok' | 'ng' | 'dim'): React.CSSProperties {
  const base: React.CSSProperties = { fontSize: 18, padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--card)' };
  if (state === 'ok') return { ...base, border: '2px solid green', background: '#e9f7ee' };
  if (state === 'ng') return { ...base, border: '2px solid crimson', background: '#fdecec' };
  if (state === 'dim') return { ...base, opacity: 0.55 };
  return base;
}
