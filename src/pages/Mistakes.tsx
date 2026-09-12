// allow: SIZE_OK — page-local retry state machine; shared renderers live in components/.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import type { Attempt, MistakeRef } from '../domain/types';
import { generateProblem } from '../generators';
import { loadPersisted, removeMistake, saveAttempt } from '../storage/store';
import { ChoiceGrid } from '../components/ChoiceGrid';
import { QuestionFigures } from '../components/QuestionFigures';
import { buildChoiceItems } from '../components/quizChoices';
import { LiveRegion } from '../components/LiveRegion';
import {
  buildAttempt,
  correctLabel,
  isButtonElement,
  isTypingTarget,
  resolveMistakeDifficulty,
  uniqueMistakes,
} from '../features/quizHelpers';
import { SUBJECT_LABEL } from '../domain/labels';

interface RetryState {
  readonly refs: readonly MistakeRef[];
  readonly index: number;
  readonly answered: readonly Attempt[];
}

export function Mistakes(): JSX.Element {
  const [persisted, setPersisted] = useState(loadPersisted);
  const mistakes = useMemo(() => uniqueMistakes(persisted.mistakes), [persisted]);
  const [retry, setRetry] = useState<RetryState | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [announce, setAnnounce] = useState('');
  const t0 = useRef(0);
  const questionRef = useRef<HTMLDivElement | null>(null);

  const currentRef =
    retry !== null && retry.index < retry.refs.length ? retry.refs[retry.index] : null;

  // Regenerated from the mistake's own seed at the difficulty of the persisted
  // attempt (fallback 2) — never the stored/never-embedded problem.
  const problem = useMemo(() => {
    if (currentRef === null) return null;
    const fresh = loadPersisted();
    return generateProblem(
      currentRef.subject,
      currentRef.seed,
      resolveMistakeDifficulty(fresh, currentRef),
    );
  }, [currentRef]);

  useEffect(() => {
    questionRef.current?.focus();
  }, [retry?.index]);

  useEffect(() => {
    if (chosen === null) return;
    const active = document.activeElement;
    if (active !== null && active instanceof HTMLButtonElement && active.disabled) {
      questionRef.current?.focus();
    }
  }, [chosen]);

  const startRetry = (refs: readonly MistakeRef[]): void => {
    if (refs.length === 0) return;
    setRetry({ refs, index: 0, answered: [] });
    setChosen(null);
    setAnnounce('');
    t0.current = performance.now();
  };

  const answer = useCallback(
    (choiceIndex: number) => {
      if (problem === null || chosen !== null) return;
      const ms = Math.round(performance.now() - t0.current);
      const attempt = buildAttempt(problem, { chosenIndex: choiceIndex, ms, at: Date.now() });
      saveAttempt(attempt);
      setChosen(choiceIndex);
      setRetry((state) =>
        state === null ? state : { ...state, answered: [...state.answered, attempt] },
      );
      if (attempt.correct) {
        removeMistake(problem.subject, problem.seed);
        setPersisted(loadPersisted());
        setAnnounce('正解。間違いリストから削除しました');
      } else {
        setAnnounce(`不正解。正解は${correctLabel(problem)}`);
      }
    },
    [problem, chosen],
  );

  const advance = useCallback(() => {
    setRetry((state) => (state === null ? state : { ...state, index: state.index + 1 }));
    setChosen(null);
    setAnnounce('');
    t0.current = performance.now();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (isTypingTarget(event.target) || problem === null) return;
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
          advance();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answer, advance, chosen, problem]);

  if (retry === null) {
    return (
      <div>
        <LiveRegion message={announce} />
        <h1>間違い直し</h1>
        <p className="meta">
          間違えた問題は seed から完全再現できます。正解するとリストから削除されます。
        </p>
        {mistakes.length === 0 ? (
          <p>まだ間違い記録がありません。</p>
        ) : (
          <>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => startRetry([...mistakes].reverse())}
            >
              まとめて解き直す（{mistakes.length}問）
            </button>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                display: 'grid',
                gap: 'var(--space-2)',
                marginTop: 'var(--space-4)',
              }}
            >
              {[...mistakes].reverse().map((mistake) => {
                const difficulty = resolveMistakeDifficulty(persisted, mistake);
                return (
                  <li
                    key={`${mistake.subject}:${mistake.seed}`}
                    className="card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 'var(--space-3)',
                      padding: 'var(--space-3)',
                    }}
                  >
                    <span>
                      <strong>{SUBJECT_LABEL[mistake.subject]}</strong>{' '}
                      <span className="meta">
                        seed {mistake.seed} · 難易度 {difficulty}
                      </span>
                    </span>
                    <span
                      style={{
                        marginLeft: 'auto',
                        display: 'flex',
                        gap: 'var(--space-2)',
                        flexWrap: 'wrap',
                      }}
                    >
                      <button type="button" className="btn" onClick={() => startRetry([mistake])}>
                        解き直す
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={() => {
                          removeMistake(mistake.subject, mistake.seed);
                          setPersisted(loadPersisted());
                        }}
                      >
                        削除
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    );
  }

  if (retry.index >= retry.refs.length) {
    const correct = retry.answered.filter((attempt) => attempt.correct).length;
    return (
      <div>
        <LiveRegion message={announce} />
        <h1>解き直しの結果</h1>
        <section className="card">
          <h2>
            {retry.answered.length}問中 {correct}問正解
          </h2>
          <p className="meta">正解した問題は間違いリストから削除されました。</p>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn--primary" onClick={() => setRetry(null)}>
              リストへ戻る
            </button>
            <a className="btn" href="#/">
              トップへ
            </a>
          </div>
        </section>
      </div>
    );
  }

  if (problem === null) return <p>生成中…</p>;

  return (
    <div>
      <LiveRegion message={announce} />
      <h1>解き直し</h1>
      <p className="meta">
        {retry.index + 1} / {retry.refs.length}問 · {SUBJECT_LABEL[problem.subject]} · 難易度{' '}
        {problem.difficulty} · seed {problem.seed}
      </p>
      <div
        className="question"
        ref={questionRef}
        tabIndex={-1}
        aria-label={`解き直し ${retry.index + 1} / ${retry.refs.length}`}
      >
        <p className="question__prompt">
          {problem.subject === 'arithmetic'
            ? '? に入る数値を選べ（キー1〜5で回答）'
            : `${problem.prompt}（キー1〜5で回答）`}
        </p>
        {problem.subject === 'arithmetic' ? (
          <p className="question__display">{problem.display}</p>
        ) : (
          <QuestionFigures problem={problem} />
        )}
        <ChoiceGrid
          items={buildChoiceItems(problem)}
          chosenIndex={chosen}
          correctIndex={chosen === null ? null : problem.correctIndex}
          onChoose={answer}
        />
      </div>
      {chosen !== null && (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <div className="explanation">
            <p style={{ margin: 0 }}>
              <strong>解法:</strong> {problem.explanation}
            </p>
          </div>
          <div
            style={{
              marginTop: 'var(--space-3)',
              display: 'flex',
              gap: 'var(--space-2)',
              flexWrap: 'wrap',
            }}
          >
            <button type="button" className="btn btn--primary" onClick={advance}>
              {retry.index + 1 >= retry.refs.length ? '結果へ' : '次へ'}
            </button>
            <button type="button" className="btn" onClick={() => setRetry(null)}>
              中断してリストへ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
