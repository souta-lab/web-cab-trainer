# Web-CAB Trainer（非公式・独立練習ツール）

本サイトはWeb-CAB形式の能力検査対策を目的とした**非公式の独立練習ツール**です。実際の試験問題を収録・複製するものではありません。SHL等の問題・画像・文章・UIは使用していません。

## 起動方法

```bash
cd web-cab-app
npm install
npm run dev
```

- `npm run build` — TypeScript（strict）+ Vite ビルド
- `npm test` — Vitest（property-based 含む）
- `npm run lint` — oxlint
- `npm run research:stats` — research/dataset 集計

Firefox最新版・デスクトップPCを第一ターゲット。Chrome専用API不使用。ログイン不要・広告なし・バックエンド不要。データはlocalStorageのみ。

## Architecture

```
src/
  domain/              凍結された契約（単一の真実源）
    types.ts           Problem/Attempt/Settings等の型（strict・unknown/any禁止）
    rng.ts             seedable PRNG (mulberry32+xmur3) + pickWeighted
    figure.ts          図形変換の唯一のインタプリタ applyPrimitives / figureKey
    recipe.ts          算術AST（evaluate/solve/render/verifyArith）+ rule→Primitive展開
    invariants.ts      validateProblem: 問題の不変条件を検査
    labels.ts          科目の日本語ラベル
  generators/
    policy.ts          出題分布の唯一の真実源（重み・resolveDifficulty）
    arithmetic.ts      recipe由来で display/answer を生成
    pattern.ts         base→step ops→5フレーム、欠落を当てる
    commands.ts        start + 命令列 → applyPrimitives
    cipher.ts          例A→出力A と入力B、規則適用
    index.ts           generateProblem(subject, seed, difficulty?)
  storage/
    validate.ts        unknown→型への純粋検証（キャスト無し）
    migrate.ts         v1→v2 migration（旧problem埋め込みを除去）
    store.ts           localStorage（新キー + 旧キー移行）
  stats/engine.ts      集計・適応難易度・弱点・ペース
  features/
    quizHelpers.ts     純粋ヘルパー（難易度解決・模試集計 等）
    exportImport.ts    JSONエクスポート/インポート
  components/          Figure / ChoiceGrid / LiveRegion / ErrorBoundary
  pages/               Home/Practice/Mock/StatsPage/Mistakes/Settings(+About)
  index.css            デザイントークン（light/dark・font-scale・a11y）
  App.tsx              hash router
research/
  sources.json  taxonomy.json  distractors.json
  dataset/references.json  report.md  coverage.md
```

## 設計原則

- **契約を凍結**: `domain/*` が唯一の真実源。generator・storage・UI はここに依存する。
- **生成と採点の一致**: 図形は `applyPrimitives(start, ops)` だけが変換を解釈する。Problem は機械検証可能な `start`/`ops`（算術は `recipe`）を保持し、正解は必ずそこから再導出できる。
- **seed再現100%**: `generateProblem(subject, seed, difficulty)` は記録された `(seed, difficulty)` から常に同一問題を再生成する（難易度抽選を必ず消費することで実現）。間違い復習・seed共有の基盤。
- **分布は policy.ts が唯一の真実源**: テストも research 集計も README の数値ではなく `policy.ts` を参照する。
- **永続化は versioned migration**: `Persisted.version`（現在 2）に基づき v1→v2 を実装。壊れたデータは例外を投げず空にフォールバック。

## Generatorの仕組み

- **四則逆算**: 正解 `unknownValue` を含む `ArithRecipe`（AST）を生成し、`render(recipe)` で表示、`solve(recipe)` で正解を代数的に逆算する。表示文字列を手書きしないため式と答えが乖離しない。0除算・NaN/Infinity 禁止、`verifyArith` で自己検証。
- **法則性**: `start`（角に主図形＋点）に規則（回転/移動/塗り反転/反転）を1ステップ適用した `ops` を作り、5フレームを `applyPrimitives` で構築。誤答は部分適用・隣接フレーム・逆回転など規則由来のみ（サイズ誤魔化し無し）。
- **命令表**: 命令列を `expandCommand`→`Primitive` に展開し `applyPrimitives` で適用。`RemoveDot` を含む全9命令が到達可能。誤答は逆順・最終命令抜き・逆回転・開始状態。
- **暗号**: 真の規則を `CipherRule` として保持し、例A→出力A を提示。入力を「全規則が可視」になるよう構成し、部分適用・逆順適用を誤答にする。
- 全generatorは決定的。誤答は `figureKey` で重複排除し、必ず5択（正解は1つ）。`validateProblem` が全問で空を返すことをテストで保証。

## 出題分布（`src/generators/policy.ts` が根拠）

- pattern: 1-rule 25% / 2-rule 58% / 3-rule 17%
- commands長: 1-2: 30% / 3-4: 50% / 5+: 20%
- cipher: single 65% / multi 35%
- arithmetic: 小数 ≈13%
- 難易度別の重みを持ち、難易度一様混合で上記globalに一致するよう設計。`tests/integration.test.ts` が実生成の分布を許容誤差内で検証する。

## アクセシビリティ / キーボード

- `1〜5`: 選択肢回答（`aria-keyshortcuts`）
- `Enter/Space`: 次へ
- `P`: 一時停止（練習モードのみ）
- 入力欄フォーカス中はショートカットを無効化。回答結果は `LiveRegion` で読み上げ、TimeAttackの残り時間は 60/30/10 秒で通知。`autoFocus` に依存せず、フォーカスは問題コンテナへ移動。light/dark 両対応、`--font-scale` で文字サイズ拡大。

## 追加機能

- **間違い再挑戦**: 間違い一覧から個別／まとめて解き直し。正解すると間違いから除外。
- **エクスポート/インポート**: 学習履歴と設定をJSONで保存・復元（seed共有・バックアップ用途）。

## テスト

`tests/` は固定seedレンジの property-based 検証（依存追加なし・完全決定的）:

- `domain.test.ts` — 図形変換の純粋性/正規化、算術recipeの逆算、policy分布、不変条件の負例
- `arithmetic|pattern|commands|cipher.prop.test.ts` — 各生成器の不変条件・決定性・到達可能性・分布
- `storage.test.ts` — v1→v2 migration（`problem`除去）・スキーマ検証・クランプ
- `stats.prop.test.ts` — 集計/適応/弱点/ペース
- `quizHelpers.test.ts` — 難易度解決・模試集計
- `exportImport.test.ts` — JSON往復・不正入力
- `integration.test.ts` — 全科目パイプラインの不変条件・seed再現・実生成分布
