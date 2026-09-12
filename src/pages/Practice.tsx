// allow: SIZE_OK — page-local session state machine; shared renderers live in components/.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, JSX } from 'react';
import type { Attempt, Difficulty, Problem, Subject } from '../domain/types';
import { randomSeed } from '../domain/rng';
import { generateProblem } from '../generators';
import { paceSecPerQ, summarize } from '../stats/engine';
import { loadPersisted, loadSettings, saveAttempt } from '../storage/store';
import { ChoiceGrid } from '../components/ChoiceGrid';
import { QuestionFigures } from '../components/QuestionFigures';
import { buildChoiceItems } from '../components/quizChoices';
import { LiveRegion } from '../components/LiveRegion';
import {
  buildAttempt,
  correctLabel,
  formatClock,
  isButtonElement,
  isTypingTarget,
  nextDifficulty,
  TIMER_MILESTONES,
} from '../features/quizHelpers';
import { SUBJECT_LABEL } from '../domain/labels';

const MODES = ['practice', 'speed', 'attack'] as const;
type Mode = (typeof MODES)[number];

const MODE_LABEL: Record<Mode, string> = {
  practice: '練習',
  speed: 'Speed',
  attack: 'TimeAttack',
};

/** Persisted attempts for one subject: the adaptive input, never the result source. */
function subjectAttempts(subject: Subject): Attempt[] {
  return loadPersisted().attempts.filter((attempt) => attempt.subject === subject);
}

function PromptText({ problem }: { problem: Problem }): JSX.Element {
  return (
    <p className="question__prompt">
      {problem.subject === 'arithmetic'
        ? '? に入る数値を選べ（キー1〜5で回答）'
        : `${problem.prompt}（キー1〜5で回答）`}
    </p>
  );
}

export function Practice({ subject }: { subject: Subject }): JSX.Element {
  const settings = useMemo(() => loadSettings(), []);
  const [mode, setMode] = useState<Mode>('practice');
  const [attackMin, setAttackMin] = useState(() => settings.timeAttackMin[0] ?? 3);
  const [auto, setAuto] = useState(true);
  const [selected, setSelected] = useState<Difficulty>(2);
  const [question, setQuestion] = useState<Problem | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [results, setResults] = useState<readonly Attempt[]>([]);
  const [streak, setStreak] = useState(0);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [warn, setWarn] = useState(false);
  const [remain, setRemain] = useState('');
  const [announce, setAnnounce] = useState('');
  const [alert, setAlert] = useState('');
  const [serial, setSerial] = useState(0);
  const [revision, setRevision] = useState(0);
  const [resetKey, setResetKey] = useState(0);

  const t0 = useRef(0);
  const deadline = useRef(0);
  const announced = useRef<Set<number>>(new Set());
  const prefetchRef = useRef<Problem | null>(null);
  const questionRef = useRef<HTMLDivElement | null>(null);
  const firstFocus = useRef(true);
  const autoRef = useRef(auto);
  const selectedRef = useRef(selected);

  // Ref mirrors so the session-reset effect never restarts when the difficulty
  // control changes (it applies to the next question, not to this session).
  useEffect(() => {
    autoRef.current = auto;
    selectedRef.current = selected;
  }, [auto, selected]);

  // Session reset: subject / mode / time limit change, or もう一度.
  useEffect(() => {
    const difficulty = nextDifficulty(subjectAttempts(subject), autoRef.current, selectedRef.current);
    setQuestion(generateProblem(subject, randomSeed(), difficulty));
    prefetchRef.current = null;
    setChosen(null);
    setResults([]);
    setStreak(0);
    setPaused(false);
    setOver(false);
    setWarn(false);
    setAnnounce('');
    setAlert('');
    announced.current.clear();
    for (const milestone of TIMER_MILESTONES) {
      if (milestone >= attackMin * 60) announced.current.add(milestone);
    }
    t0.current = performance.now();
    if (mode === 'attack') {
      deadline.current = performance.now() + attackMin * 60_000;
      setRemain(formatClock(attackMin * 60));
    } else {
      setRemain('');
    }
    setSerial((value) => value + 1);
  }, [subject, mode, attackMin, resetKey]);

  // Prefetch the next question with the difficulty currently in force: adaptive
  // over this subject's persisted attempts when 自動, else the manual choice.
  useEffect(() => {
    const difficulty = nextDifficulty(subjectAttempts(subject), auto, selected);
    prefetchRef.current = generateProblem(subject, randomSeed(), difficulty);
  }, [subject, auto, selected, revision]);

  const advance = useCallback(() => {
    const difficulty = nextDifficulty(subjectAttempts(subject), auto, selected);
    const prefetched = prefetchRef.current;
    // The prefetched problem is used only when its difficulty matches the
    // difficulty computed now; otherwise it is regenerated (manual control wins).
    setQuestion(
      prefetched !== null && prefetched.difficulty === difficulty
        ? prefetched
        : generateProblem(subject, randomSeed(), difficulty),
    );
    prefetchRef.current = null;
    setChosen(null);
    setWarn(false);
    setAnnounce('');
    setAlert('');
    t0.current = performance.now();
    setSerial((value) => value + 1);
    setRevision((value) => value + 1);
  }, [subject, auto, selected]);

  const answer = useCallback(
    (index: number) => {
      if (question === null || chosen !== null || paused || over) return;
      const ms = Math.round(performance.now() - t0.current);
      const attempt = buildAttempt(question, { chosenIndex: index, ms, at: Date.now() });
      saveAttempt(attempt);
      setResults((list) => [...list, attempt]);
      setChosen(index);
      setStreak((value) => (attempt.correct ? value + 1 : 0));
      setAnnounce(attempt.correct ? '正解' : `不正解。正解は${correctLabel(question)}`);
      setRevision((value) => value + 1);
    },
    [question, chosen, paused, over],
  );

  // TimeAttack: remaining time always derives from the absolute deadline, so a
  // throttled interval can never drift. Visible timer is NOT a live region.
  useEffect(() => {
    if (mode !== 'attack' || over || paused) return;
    const id = setInterval(() => {
      const left = deadline.current - performance.now();
      if (left <= 0) {
        setRemain('0:00');
        setAlert('時間終了');
        setOver(true);
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
  }, [mode, over, paused]);

  // Speed: warn once the target time passed; pausing stops the interval.
  useEffect(() => {
    if (mode !== 'speed' || chosen !== null || paused || over) return;
    const target = settings.speedTargetSec * 1000;
    const id = setInterval(() => {
      if (performance.now() - t0.current > target) setWarn(true);
    }, 300);
    return () => clearInterval(id);
  }, [mode, chosen, paused, over, settings.speedTargetSec]);

  // Focus the question container on every new question (no autoFocus).
  useEffect(() => {
    if (firstFocus.current) {
      firstFocus.current = false;
      return;
    }
    questionRef.current?.focus();
  }, [serial]);

  // After a mouse click the choice button is disabled but keeps focus; move
  // focus back so Enter can advance without hijacking focused action buttons.
  useEffect(() => {
    if (chosen === null) return;
    const active = document.activeElement;
    if (active !== null && active instanceof HTMLButtonElement && active.disabled) {
      questionRef.current?.focus();
    }
  }, [chosen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (isTypingTarget(event.target) || question === null) return;
      if (event.key >= '1' && event.key <= '5') {
        const index = Number(event.key) - 1;
        if (index < question.choices.length) {
          event.preventDefault();
          answer(index);
        }
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        // A focused <button> activates natively; handling it here would double-fire.
        if (isButtonElement(event.target)) return;
        if (chosen !== null && !over && !paused) {
          event.preventDefault();
          advance();
        }
        return;
      }
      if ((event.key === 'p' || event.key === 'P') && mode === 'practice') {
        event.preventDefault();
        setPaused((value) => !value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answer, advance, chosen, mode, over, paused, question]);

  const onDifficultyChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const value = Number(event.target.value);
    if (value === 1 || value === 2 || value === 3) {
      setSelected(value);
      setAuto(false);
      return;
    }
    setAuto(true);
  };

  const stats = summarize(results);
  const liveFeedback = mode === 'speed' && warn && chosen === null ? '目標超過' : announce;

  return (
    <div>
      <LiveRegion message={liveFeedback} />
      <LiveRegion message={alert} assertive />
      <h1>{SUBJECT_LABEL[subject]}</h1>

      <nav
        aria-label="練習の設定"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-4)',
        }}
      >
        <div className="segmented" role="group" aria-label="モード">
          {MODES.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={mode === item}
              onClick={() => setMode(item)}
            >
              {MODE_LABEL[item]}
            </button>
          ))}
        </div>

        {mode === 'attack' && (
          <label className="meta">
            制限時間
            <select
              value={attackMin}
              onChange={(event) => setAttackMin(Number(event.target.value))}
            >
              {settings.timeAttackMin.map((value) => (
                <option key={value} value={value}>
                  {value}分
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="meta">
          難易度
          <select value={auto ? 'auto' : String(selected)} onChange={onDifficultyChange}>
            <option value="auto">自動</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
        </label>

        {mode === 'attack' && (
          <span className="timer">
            <span className="timer__label">残り</span>
            {remain}
          </span>
        )}

        {mode === 'practice' && (
          <button type="button" className="btn" aria-pressed={paused} onClick={() => setPaused((v) => !v)}>
            {paused ? '再開(P)' : '一時停止(P)'}
          </button>
        )}

        <span className="meta" style={{ marginLeft: 'auto' }}>
          正答率 {(stats.accuracy * 100).toFixed(0)}% · 平均 {(stats.avgMs / 1000).toFixed(1)}秒 · 連続正解{' '}
          {streak} · 目標 {paceSecPerQ(settings.mock, subject).toFixed(1)}秒/問
        </span>
      </nav>

      {over ? (
        <section className="card">
          <h2>
            終了 — {stats.answered}問中 {stats.correct}問正解
          </h2>
          <p className="meta">
            正答率 {(stats.accuracy * 100).toFixed(1)}% · 平均 {(stats.avgMs / 1000).toFixed(1)}秒 · 連続正解{' '}
            {stats.bestStreak}
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button type="button" className="btn btn--primary" onClick={() => setResetKey((k) => k + 1)}>
              もう一度
            </button>
            <a className="btn" href="#/">
              トップへ
            </a>
          </div>
        </section>
      ) : paused ? (
        <section className="card">
          <h2>一時停止中</h2>
          <p className="meta">Pキーまたは下のボタンで再開します。</p>
          <button type="button" className="btn btn--primary" onClick={() => setPaused(false)}>
            再開する
          </button>
        </section>
      ) : question === null ? (
        <p>生成中…</p>
      ) : (
        <>
          <div
            className="question"
            ref={questionRef}
            tabIndex={-1}
            aria-label={`問題 seed ${question.seed}・難易度${question.difficulty}`}
          >
            <PromptText problem={question} />
            {question.subject === 'arithmetic' ? (
              <p className="question__display">{question.display}</p>
            ) : (
              <QuestionFigures problem={question} />
            )}
            <ChoiceGrid
              items={buildChoiceItems(question)}
              chosenIndex={chosen}
              correctIndex={chosen === null ? null : question.correctIndex}
              onChoose={answer}
              disabled={paused || over}
            />
          </div>

          {chosen !== null && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              {mode === 'practice' && (
                <div className="explanation">
                  <p style={{ margin: 0 }}>
                    <strong>解法:</strong> {question.explanation}
                  </p>
                  <p className="meta" style={{ margin: 'var(--space-1) 0 0' }}>
                    seed: {question.seed} · 難易度 {question.difficulty}
                  </p>
                </div>
              )}
              {mode === 'speed' && warn && (
                <p className="warn-text">目標超過（{settings.speedTargetSec}秒以内が目安です）</p>
              )}
              <div style={{ marginTop: 'var(--space-3)' }}>
                <button type="button" className="btn btn--primary" onClick={advance}>
                  次へ (Enter)
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
