// allow: SIZE_OK — page-local session state machine; shared renderers live in components/.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import { SUBJECTS } from '../domain/types';
import type { Attempt, Difficulty, Problem, Subject } from '../domain/types';
import { randomSeed } from '../domain/rng';
import { generateProblem } from '../generators';
import { summarize, withPace } from '../stats/engine';
import { loadSettings, saveAttempt, saveMock } from '../storage/store';
import { ChoiceGrid } from '../components/ChoiceGrid';
import { QuestionFigures } from '../components/QuestionFigures';
import { buildChoiceItems } from '../components/quizChoices';
import { LiveRegion } from '../components/LiveRegion';
import {
  buildAttempt,
  formatClock,
  isButtonElement,
  isTypingTarget,
  mockPaceSecPerQ,
  mockProblemPlan,
  mockTotals,
  sessionTotals,
  TIMER_MILESTONES,
} from '../features/quizHelpers';
import { SUBJECT_LABEL } from '../domain/labels';

/** Mocks test at a fixed, middle difficulty (same for every candidate). */
const MOCK_DIFFICULTY: Difficulty = 2;
const CHOICES = [...SUBJECTS, 'mixed'] as const;

export function Mock(): JSX.Element {
  const settings = useMemo(() => loadSettings(), []);
  const [subject, setSubject] = useState<Subject | 'mixed'>('arithmetic');
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const [problems, setProblems] = useState<readonly Problem[]>([]);
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [sessionAttempts, setSessionAttempts] = useState<readonly Attempt[]>([]);
  const [remain, setRemain] = useState('');
  const [alert, setAlert] = useState('');

  const t0 = useRef(0);
  const endAt = useRef(0);
  const announced = useRef<Set<number>>(new Set());
  const questionRef = useRef<HTMLDivElement | null>(null);
  const firstFocus = useRef(true);
  const finishRef = useRef<() => void>(() => {});
  const finishedRef = useRef(false);

  const totals = mockTotals(settings.mock, subject);
  const current = problems[index];

  // Accounting is session-only: answered/correct/avg come from this run's own
  // Attempt[] — never from the persisted history.
  const finish = useCallback((): void => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setDone(true);
    const { answered, correct, avgMs } = sessionTotals(sessionAttempts);
    saveMock({ at: Date.now(), subject, answered, correct, avgMs });
  }, [sessionAttempts, subject]);

  // The 250 ms interval must observe the latest session attempts.
  useEffect(() => {
    finishRef.current = finish;
  }, [finish]);

  const start = (): void => {
    const list: Problem[] = [];
    for (const entry of mockProblemPlan(settings.mock, subject)) {
      for (let i = 0; i < entry.questions; i += 1) {
        list.push(generateProblem(entry.subject, randomSeed(), MOCK_DIFFICULTY));
      }
    }
    setProblems(list);
    setIndex(0);
    setChosen(null);
    setSessionAttempts([]);
    setDone(false);
    setAlert('');
    announced.current.clear();
    for (const milestone of TIMER_MILESTONES) {
      if (milestone >= totals.minutes * 60) announced.current.add(milestone);
    }
    finishedRef.current = false;
    t0.current = performance.now();
    endAt.current = performance.now() + totals.minutes * 60_000;
    setRemain(formatClock(totals.minutes * 60));
    setStarted(true);
  };

  const answer = useCallback(
    (choiceIndex: number) => {
      if (current === undefined || chosen !== null || done) return;
      if (performance.now() >= endAt.current) return;
      const ms = Math.round(performance.now() - t0.current);
      const attempt = buildAttempt(current, { chosenIndex: choiceIndex, ms, at: Date.now() });
      saveAttempt(attempt);
      setSessionAttempts((list) => [...list, attempt]);
      setChosen(choiceIndex);
    },
    [current, chosen, done],
  );

  const next = useCallback(() => {
    if (current === undefined || chosen === null) return;
    if (index + 1 >= problems.length) {
      finishRef.current();
      return;
    }
    setIndex((value) => value + 1);
    setChosen(null);
    t0.current = performance.now();
  }, [current, chosen, index, problems.length]);

  // Remaining time from the absolute deadline (throttle-safe); milestones are
  // announced assertively, the visible clock is not a live region.
  useEffect(() => {
    if (!started || done) return;
    const id = setInterval(() => {
      const left = endAt.current - performance.now();
      if (left <= 0) {
        setRemain('0:00');
        setAlert('時間終了');
        finishRef.current();
        return;
      }
      setRemain(formatClock(Math.ceil(left / 1000)));
      for (const milestone of TIMER_MILESTONES) {
        if (left <= milestone * 1000 && !announced.current.has(milestone)) {
          announced.current.add(milestone);
          setAlert(`残り${milestone}秒`);
        }
      }
    }, 250);
    return () => clearInterval(id);
  }, [started, done]);

  useEffect(() => {
    if (!started || done) return;
    if (firstFocus.current) {
      firstFocus.current = false;
      return;
    }
    questionRef.current?.focus();
  }, [index, started, done]);

  useEffect(() => {
    if (chosen === null) return;
    const active = document.activeElement;
    if (active !== null && active instanceof HTMLButtonElement && active.disabled) {
      questionRef.current?.focus();
    }
  }, [chosen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!started || done || isTypingTarget(event.target)) return;
      const problem = problems[index];
      if (problem === undefined) return;
      if (event.key >= '1' && event.key <= '5') {
        const choiceIndex = Number(event.key) - 1;
        if (choiceIndex < problem.choices.length) {
          event.preventDefault();
          answer(choiceIndex);
        }
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        if (isButtonElement(event.target)) return;
        if (chosen !== null) {
          event.preventDefault();
          next();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [started, done, problems, index, chosen, answer, next]);

  if (!started) {
    return (
      <div>
        <h1>総合模試</h1>
        <p className="meta">本番形式: 解説なし・正誤表示なし。残り時間と問題番号のみを表示します。</p>
        <div className="segmented" role="group" aria-label="科目" style={{ marginBottom: 'var(--space-4)' }}>
          {CHOICES.map((key) => (
            <button key={key} type="button" aria-pressed={subject === key} onClick={() => setSubject(key)}>
              {key === 'mixed' ? '全科目' : SUBJECT_LABEL[key]}
            </button>
          ))}
        </div>
        <p>
          問題数 {totals.questions}問 / {totals.minutes}分
          {subject !== 'mixed' && (
            <span className="meta">（目安 {mockPaceSecPerQ(settings.mock, subject).toFixed(1)}秒/問）</span>
          )}
        </p>
        <button type="button" className="btn btn--primary" onClick={start}>
          開始
        </button>
        <p className="meta" style={{ marginTop: 'var(--space-3)' }}>
          問題数・制限時間は設定画面で変更できます。
        </p>
      </div>
    );
  }

  if (done) {
    const summary = withPace(summarize(sessionAttempts), mockPaceSecPerQ(settings.mock, subject));
    const paceDiff = summary.paceDiffMs;
    const paceText =
      paceDiff === null
        ? '—'
        : paceDiff >= 0
          ? `目標より${(paceDiff / 1000).toFixed(1)}秒速い`
          : `目標より${(-paceDiff / 1000).toFixed(1)}秒遅い`;
    return (
      <div>
        <LiveRegion message={alert} assertive />
        <h1>結果</h1>
        <section className="card">
          <h2>
            {subject === 'mixed' ? '全科目' : SUBJECT_LABEL[subject]} — {summary.answered}問回答
          </h2>
          <ul>
            <li>
              正答数: {summary.correct} / {problems.length}問（未回答 {problems.length - summary.answered}問）
            </li>
            <li>正答率: {(summary.accuracy * 100).toFixed(1)}%</li>
            <li>
              平均: {(summary.avgMs / 1000).toFixed(1)}秒 · 中央値: {(summary.medianMs / 1000).toFixed(1)}秒 · p90:{' '}
              {(summary.p90Ms / 1000).toFixed(1)}秒
            </li>
            <li>
              本番ペース {((summary.vsPaceMs ?? 0) / 1000).toFixed(1)}秒/問: {paceText}
            </li>
          </ul>
          <p className="meta">※これは練習ペースの目安であり、合否判定ではありません。</p>
        </section>
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setStarted(false);
              setDone(false);
              setProblems([]);
              setSessionAttempts([]);
              setChosen(null);
              setIndex(0);
            }}
          >
            もう一度
          </button>
          <a className="btn" href="#/">
            トップへ
          </a>
          <a className="btn" href="#/stats">
            統計へ
          </a>
        </div>
      </div>
    );
  }

  if (current === undefined) return <p>生成中…</p>;

  return (
    <div>
      <LiveRegion message={alert} assertive />
      <h1>{subject === 'mixed' ? '全科目' : SUBJECT_LABEL[subject]}</h1>
      <p className="meta">
        <span className="timer">
          <span className="timer__label">残り</span>
          {remain}
        </span>{' '}
        {index + 1}/{problems.length}問 · {chosen === null ? '未回答' : `回答 ${chosen + 1} を選択`}
        （正誤・解説は表示されません）
      </p>
      <div
        className="question"
        ref={questionRef}
        tabIndex={-1}
        aria-label={`問題 ${index + 1} / ${problems.length}`}
      >
        <p className="question__prompt">
          {current.subject === 'arithmetic'
            ? '? に入る数値を選べ（キー1〜5で回答）'
            : `${current.prompt}（キー1〜5で回答）`}
        </p>
        {current.subject === 'arithmetic' ? (
          <p className="question__display">{current.display}</p>
        ) : (
          <QuestionFigures problem={current} />
        )}
        <ChoiceGrid
          items={buildChoiceItems(current)}
          chosenIndex={chosen}
          correctIndex={null}
          onChoose={answer}
          disabled={chosen !== null}
        />
      </div>
      <div style={{ marginTop: 'var(--space-4)' }}>
        <button type="button" className="btn btn--primary" onClick={next} disabled={chosen === null}>
          {index + 1 >= problems.length ? '結果を見る (Enter)' : '次へ (Enter)'}
        </button>
      </div>
    </div>
  );
}
