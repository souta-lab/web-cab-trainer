import { useMemo } from 'react';
import type { JSX } from 'react';
import { SUBJECTS } from '../domain/types';
import type { SkillTag, Subject } from '../domain/types';
import { paceSecPerQ, summarize, weaknesses, withPace } from '../stats/engine';
import { loadPersisted, loadSettings } from '../storage/store';
import { SUBJECT_LABEL } from '../domain/labels';

const SKILL_LABEL: Record<SkillTag, string> = {
  'linear-basic': '一次式（基本）',
  'linear-parens': '一次式（かっこ）',
  decimal: '小数',
  fraction: '分数',
  rotation: '回転',
  reflection: '反転',
  'fill-toggle': '塗りの切替',
  movement: '移動',
  count: '数の増減',
  'inside-outside': '内外の交換',
  'composite-2': '複合（2規則）',
  'composite-3': '複合（3規則）',
  'cmd-rotate': '命令・回転',
  'cmd-flip': '命令・反転',
  'cmd-toggle': '命令・塗り',
  'cmd-move': '命令・移動',
  'cmd-cancel': '命令・打ち消し',
  'cipher-single': '暗号（1規則）',
  'cipher-multi': '暗号（複数規則）',
};

function isSubjectTag(tag: SkillTag | Subject): tag is Subject {
  return tag === 'arithmetic' || tag === 'pattern' || tag === 'commands' || tag === 'cipher';
}

function tagLabel(tag: SkillTag | Subject): string {
  return isSubjectTag(tag) ? SUBJECT_LABEL[tag] : SKILL_LABEL[tag];
}

function fmtSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}秒`;
}

function fmtPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/** Positive means faster than the mock preset pace (target - average). */
function fmtPaceDiff(ms: number): string {
  const seconds = ms / 1000;
  const sign = seconds >= 0 ? '+' : '';
  return `${sign}${seconds.toFixed(1)}秒`;
}

function fmtDateTime(at: number): string {
  return new Date(at).toLocaleString('ja-JP');
}

export function StatsPage(): JSX.Element {
  const persisted = useMemo(() => loadPersisted(), []);
  const settings = useMemo(() => loadSettings(), []);
  const overall = useMemo(() => summarize(persisted.attempts), [persisted]);
  const subjectRows = useMemo(
    () =>
      SUBJECTS.map((subject) => ({
        subject,
        summary: withPace(
          summarize(persisted.attempts.filter((a) => a.subject === subject)),
          paceSecPerQ(settings.mock, subject),
        ),
      })),
    [persisted, settings],
  );
  const weak = useMemo(() => weaknesses(persisted.attempts), [persisted]);
  const recentMocks = useMemo(() => persisted.mocks.slice(-10).reverse(), [persisted]);

  if (persisted.attempts.length === 0 && persisted.mocks.length === 0) {
    return (
      <div>
        <h1>統計</h1>
        <div className="card">
          <h2>まだデータがありません</h2>
          <p className="meta">
            問題を解くと、正答率・回答時間・弱点・模試の成績がここに表示されます。
          </p>
          <p style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <a href="#/practice/arithmetic" className="btn btn--primary">
              練習を始める
            </a>
            <a href="#/mock" className="btn">
              模試を受ける
            </a>
            <a href="#/mistakes" className="btn">
              間違い直し
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1>統計</h1>

      <div className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-5)' }}>
          <span className="stat">
            <span className="stat__value">{overall.answered}</span>
            <span className="stat__label">回答数</span>
          </span>
          <span className="stat">
            <span className="stat__value">{overall.correct}</span>
            <span className="stat__label">正解数</span>
          </span>
          <span className="stat">
            <span className="stat__value">{fmtPercent(overall.accuracy)}</span>
            <span className="stat__label">正答率</span>
          </span>
          <span className="stat">
            <span className="stat__value">{fmtSeconds(overall.medianMs)}</span>
            <span className="stat__label">中央値</span>
          </span>
          <span className="stat">
            <span className="stat__value">{fmtSeconds(overall.p90Ms)}</span>
            <span className="stat__label">p90</span>
          </span>
          <span className="stat">
            <span className="stat__value">{overall.bestStreak}</span>
            <span className="stat__label">最長連続正解</span>
          </span>
        </div>
        <p className="meta" style={{ marginTop: 'var(--space-3)', marginBottom: 0 }}>
          平均 {fmtSeconds(overall.avgMs)}・誤答 {overall.wrong} 問（全 {overall.answered} 問）
        </p>
      </div>

      <h2>科目別</h2>
      <div className="card" style={{ padding: 'var(--space-3)', overflowX: 'auto' }}>
        <table>
          <caption className="visually-hidden">科目別の成績</caption>
          <thead>
            <tr>
              <th scope="col">科目</th>
              <th scope="col">回答</th>
              <th scope="col">正答率</th>
              <th scope="col">平均</th>
              <th scope="col">中央値</th>
              <th scope="col">p90</th>
              <th scope="col">目標との差</th>
            </tr>
          </thead>
          <tbody>
            {subjectRows.map((row) => (
              <tr key={row.subject}>
                <th scope="row">{SUBJECT_LABEL[row.subject]}</th>
                <td>{row.summary.answered}</td>
                <td>{fmtPercent(row.summary.accuracy)}</td>
                <td>{fmtSeconds(row.summary.avgMs)}</td>
                <td>{fmtSeconds(row.summary.medianMs)}</td>
                <td>{fmtSeconds(row.summary.p90Ms)}</td>
                <td>{row.summary.paceDiffMs === null ? '—' : fmtPaceDiff(row.summary.paceDiffMs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="meta">
        「目標との差」は模試プリセットのペースと平均回答時間の差です。プラスなら目標より速いペースです。
      </p>

      <h2>弱点</h2>
      {weak.length === 0 ? (
        <div className="card">
          <p className="meta" style={{ margin: 0 }}>
            十分なデータがありません（同じ分野で5問以上解答し、正答率が80%未満になると表示されます）。
          </p>
        </div>
      ) : (
        <ul className="card">
          {weak.map((w) => (
            <li key={w.tag}>
              <strong>{tagLabel(w.tag)}</strong>
              <span className="meta">
                {' '}
                — 正答率 {fmtPercent(w.accuracy)}（{w.answered}問）・平均 {fmtSeconds(w.avgMs)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <h2>模試の履歴</h2>
      {recentMocks.length === 0 ? (
        <div className="card">
          <p className="meta" style={{ margin: 0 }}>
            まだ模試の記録はありません。
          </p>
        </div>
      ) : (
        <ol className="card">
          {recentMocks.map((mock, index) => {
            const accuracy = mock.answered > 0 ? mock.correct / mock.answered : 0;
            const subjectLabel = mock.subject === 'mixed' ? '総合' : SUBJECT_LABEL[mock.subject];
            return (
              <li key={`${mock.at}-${mock.subject}-${index}`}>
                <span className="meta">{fmtDateTime(mock.at)}</span> {subjectLabel}{' '}
                {mock.correct}/{mock.answered}問（{fmtPercent(accuracy)}）・平均 {fmtSeconds(mock.avgMs)}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
