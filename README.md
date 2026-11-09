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
    arith.ts           算術AST（evaluate/solve/render/verifyArith）
    recipe.ts          rule→Primitive展開（命令語彙・reorder順列・算術を再輸出）
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
- **命令表**: 2〜4個（約9割が4個）の図形を縦に並べ、各図形に命令を1つ付けた「命令列」を上から順に適用する。命令は実データの語彙（上下反転・左右反転・上下左右反転・前/次の図形を消す・前の図形と入れかえ・前/次の命令を取り消す・順序入れかえR/S/J の全11種）。取消は先に解決し（取消の取消で元に戻る連鎖）、削除で縮む列に合わせて各命令の対象indexを実行時に決める（`simulatePlan` 相当は `executePlan`）。図形数より命令が多いときは末尾に全域の順序入れかえが1つ付く。誤答は調査した誤り型（二重消し・反転の適用漏れ・誤った順序入れかえ・取消の無視・隣の削除・軸の取り違え）を、実際にそのプランを再実行して生成する。
- **暗号**: 真の規則を `CipherRule` として保持し、例A→出力A を提示。入力を「全規則が可視」になるよう構成し、部分適用・逆順適用を誤答にする。
- 全generatorは決定的。誤答は `figureKey` で重複排除し、必ず5択（正解は1つ）。`validateProblem` が全問で空を返すことをテストで保証。

## 出題分布（`src/generators/policy.ts` が根拠）

- pattern: 1-rule 25% / 2-rule 58% / 3-rule 17%
- commands: 図形数 2/3/4 ≈ 2% / 9% / 89%（4個が約9割）、命令数は図形数+1が約80%（残りは図形数と同数、下限2）
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
- `commandPlan.test.ts` — 命令表の取消解決（連鎖含む）・命令数ポリシー聚合
- `storage.test.ts` — v1→v2 migration（`problem`除去）・スキーマ検証・クランプ
- `stats.prop.test.ts` — 集計/適応/弱点/ペース
- `quizHelpers.test.ts` — 難易度解決・模試集計
- `exportImport.test.ts` — JSON往復・不正入力
- `integration.test.ts` — 全科目パイプラインの不変条件・seed再現・実生成分布
