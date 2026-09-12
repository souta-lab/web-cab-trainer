import { useState } from 'react';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../storage/store';
import type { Subject } from '../types';

const ORDER: Subject[] = ['arithmetic', 'pattern', 'commands', 'cipher'];

export function Settings() {
  const [s, setS] = useState(loadSettings);
  const setMock = (k: Subject, field: 'questions' | 'minutes', v: number) => {
    setS((prev) => ({ ...prev, mock: { ...prev.mock, [k]: { ...prev.mock[k], [field]: v } } }));
  };
  return (
    <div>
      <a href="#/">‹ トップ</a>
      <h1>設定</h1>
      <h2>模試プリセット（問題数 / 分）</h2>
      {ORDER.map((k) => (
        <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <span style={{ width: 100 }}>{k}</span>
          <label>問数 <input type="number" min={1} max={100} value={s.mock[k].questions}
            onChange={(e) => setMock(k, 'questions', Number(e.target.value))} style={{ width: 70 }} /></label>
          <label>分 <input type="number" min={1} max={60} value={s.mock[k].minutes}
            onChange={(e) => setMock(k, 'minutes', Number(e.target.value))} style={{ width: 60 }} /></label>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
        <label>Speed目標(秒/問) <input type="number" min={3} max={60} value={s.speedTargetSec}
          onChange={(e) => setS((p) => ({ ...p, speedTargetSec: Number(e.target.value) }))} style={{ width: 60 }} /></label>
        <label>文字サイズ <input type="range" min={0.85} max={1.3} step={0.05} value={s.fontScale}
          onChange={(e) => setS((p) => ({ ...p, fontScale: Number(e.target.value) }))} aria-label="文字サイズ" />
          {Math.round(s.fontScale * 100)}%</label>
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button onClick={() => { saveSettings(s); document.documentElement.style.setProperty('--font-scale', String(s.fontScale)); alert('保存しました'); }}>保存</button>
        <button onClick={() => setS(DEFAULT_SETTINGS)}>初期値に戻す</button>
      </div>
    </div>
  );
}

export function About() {
  return (
    <div>
      <a href="#/">‹ トップ</a>
      <h1>About</h1>
      <p>本サイトはWeb-CAB形式の能力検査対策を目的とした<strong>非公式の独立練習ツール</strong>です。実際の試験問題を収録・複製するものではありません。</p>
      <p>SHL等の実際の問題・画像・文章・UIは使用していません。出題はすべて内部ルールから正解を計算する完全オリジナル問題の自動生成です。</p>
      <ul>
        <li>問題生成はseedable PRNG（同一seed→同一問題）</li>
        <li>ユーザーデータはlocalStorageのみに保存、ログイン不要・広告なし・バックエンド不要</li>
        <li>結果のペース比較は目安であり、合格判定・合格率の表示はしません</li>
      </ul>
    </div>
  );
}
