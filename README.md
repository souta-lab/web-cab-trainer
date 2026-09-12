# Web-CAB Trainer（非公式・独立練習ツール）

本サイトはWeb-CAB形式の能力検査対策を目的とした**非公式の独立練習ツール**です。実際の試験問題を収録・複製するものではありません。SHL等の問題・画像・文章・UIは使用していません。

## 起動方法

```bash
cd web-cab-app
npm install
npm run dev
```

- `npm run build` — TypeScript + Vite ビルド
- `npm test` — Vitest 単体テスト
- `npm run research:stats` — research/dataset 集計

Firefox最新版・デスクトップPCを第一ターゲット。Chrome専用API不使用。ログイン不要・広告なし・バックエンド不要。データはlocalStorageのみ。

## Architecture

```
src/
  types.ts            Problem/Attempt/Session等の型（unknown/any禁止）
  utils/rng.ts        seedable PRNG (mulberry32+xmur3)
  generators/
    arithmetic.ts     x先行生成AST（正解x→式→値を計算→未知数を隠す）
    pattern.ts        baseState→transformation→nextState純粋関数
    commands.ts       applyCommand(state,cmd)純粋関数＋reduce逐次適用
    cipher.ts         真のrule保持＋Input A→Output A例示
    index.ts          generateProblem(subject,seed,difficulty)
  storage/store.ts    localStorage永続化＋schema migration
  stats/engine.ts     summarize/median/p90/adaptive/weaknesses
  components/Figure.tsx  SVG図形描画
  pages/              Home/Practice/Mock/StatsPage/Mistakes/Settings(+About)
  App.tsx             hash router
research/
  sources.json  taxonomy.json  distractors.json
  dataset/references.json  report.md  coverage.md
```

## Generatorの仕組み

- **四則逆算**: 正解xを先に生成→演算ASTを生成→xから値を計算→未知数を隠す。0除算・NaN/Infinity禁止、浮動小数はround2、答えは±10000以内。distractorは符号ミス・演算順序ミス・逆算ミス・近似値。
- **法則性**: baseState→rules(回転/移動/塗り/反転の1〜3合成)→5 frames。誤答はpartial-rule・逆方向・1ステップずれ・塗り忘れ・位置違い。
- **命令表**: `applyCommand`純粋関数を生成側と判定側で共有。命令列はreduce適用。誤答は単一命令・逆順・toggle忘れ・prev-state。
- **暗号**: 真のrule(回転/反転/塗り/内外交換/移動)を保持。Input A→Output Aで例示しInput B→Output Bを選択。誤答はrule部分適用。
- 全generatorはseedable。同一seed→同一問題（復習・テスト・バグ報告用）。fingerprintでdedupe。

## 出題分布（research/report.md根拠）

- pattern: 1-rule 25% / 2-rule 58% / 3-rule 17%
- commands長: 1-2: 30% / 3-4: 50% / 5+: 20%
- cipher: single 65% / multi 35%
- 10000問生成での分布検証は `tests/` の大量生成テスト＋手動QAで確認。

## キーボード

- `1〜5`: 選択肢回答
- `Enter/Space`: 次へ
- `P`: 一時停止（練習モードのみ）
