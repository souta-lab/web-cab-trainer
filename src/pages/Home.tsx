import type { JSX } from 'react';
import { SUBJECTS } from '../domain/types';
import type { Subject } from '../domain/types';
import { SUBJECT_LABEL } from '../domain/labels';
import { DEFAULT_SETTINGS } from '../storage/store';

const SUBJECT_DESCRIPTION: Record<Subject, string> = {
  arithmetic: '？に入る数を、式を逆算して正確に求める',
  pattern: '図形の並びから規則性を読み取り、次のコマを選ぶ',
  commands: '命令を順に適用したときの結果を選ぶ',
  cipher: '入力と出力の例から変換規則を読み取り、答えを選ぶ',
};

export function Home(): JSX.Element {
  return (
    <div>
      <h1>Web-CAB Trainer</h1>
      <p className="meta">
        非公式の独立練習ツールです。実際の試験問題は収録していません。開いたらすぐ、1問ずつ反復できます。
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: 'var(--space-3)',
        }}
      >
        {SUBJECTS.map((subject) => {
          const preset = DEFAULT_SETTINGS.mock[subject];
          return (
            <a
              key={subject}
              href={`#/practice/${subject}`}
              className="card"
              style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
            >
              <strong style={{ fontSize: '1.125rem' }}>{SUBJECT_LABEL[subject]}</strong>
              <p className="meta" style={{ margin: 'var(--space-1) 0' }}>
                {SUBJECT_DESCRIPTION[subject]}
              </p>
              <span className="meta">
                模試の目安 {preset.questions}問 / {preset.minutes}分
              </span>
            </a>
          );
        })}
      </div>

      <h2>すぐ始める</h2>
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <a href="#/practice/arithmetic" className="btn btn--primary">
          練習を始める
        </a>
        <a href="#/mock" className="btn">
          模試（通し）
        </a>
        <a href="#/stats" className="btn">
          統計
        </a>
        <a href="#/mistakes" className="btn">
          間違い直し
        </a>
      </div>

      <p className="meta" style={{ marginTop: 'var(--space-4)' }}>
        目標スピードや模試の出題数は<a href="#/settings">設定</a>、アプリの説明は
        <a href="#/about">このアプリについて</a>から確認できます。
      </p>
    </div>
  );
}
