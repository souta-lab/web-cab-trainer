# Web-CAB Research Report

> 目的: 公開例題から潜在構造を抽出し、generator の出題分布を根拠づける。
> 方針: 問題文・画像の転載なし。構造 (rule / composition / distractor) のみ記録。

## 1. 科目構成 (Tier S: 日本SHL公式)

- 四則逆算 (CAB1 計数理解): 等式中の未知数・概算
- 法則性 (CAB2 直観的推理): 図形群の法則性
- 命令表 (CAB3 プログラミング言語): 指示・命令の記憶と適用
- 暗号 (CAB4 構造理解): 背後構造推理
- 所要合計: 72〜95分 (公式レンジ)

## 2. 模試プリセット根拠 (Tier2 横断一致)

| 科目 | Web-CAB (採用) | 紙CAB (参考) |
|---|---|---|
| 四則逆算 | 50問 / 9分 | 50問 / 10分 |
| 法則性 | 30問 / 12分 | 40問 / 15分 |
| 命令表 | 36問 / 15分 | 50問 / 20分 |
| 暗号 | 30問 / 16分 | 39問 / 20分 |

- 公式は合計時間のみ公開。科目別は非公式横断一致を仮採用 + 合計72分で整合確認。
- 英語圏 Verify G+ (30問/36分・適応型) は別物として混入させない。

## 3. Taxonomy と分布 (12 reference から推定)

- pattern rule composition: 1-rule 25% / 2-rule 58% / 3-rule 17%
- pattern rules: rotation / translation / reflection / fill-toggle / count-inc-dec / shape-cycle / position-cycle / add-remove / inside-outside / alternation / interleave
- commands primitives: rotate90 / rotate180 / flip-h / flip-v / toggle-fill / swap-pos / move-marker / add-dot / remove-dot / cancel-prev / swap-order
- commands length: 1-2: 30% / 3-4: 50% / 5+: 20%
- cipher primitives: rotation / reflection / fill-inversion / position-move / deletion / addition / inside-outside / count-mod / shape-map
- cipher composition: single 65% / multi 35%
- arithmetic: 1演算 34% / 2演算 33% / 括弧付き 20% / 小数 13%

## 4. Generator 仕様への落とし込み

- arithmetic: **x先行生成** (正解x→AST→値計算→未知数を隠す)。0除算・NaN/Infinity禁止、浮動小数点は丸め、答えの桁制約。
- pattern: baseState → transformation → nextState の純粋関数。誤答は partial-rule / 逆方向 / 1ステップずれ / 塗り忘れ。
- commands: applyCommand(state, cmd) を純粋関数化し、生成側と判定側で共有。命令列は reduce 逐次適用。
- cipher: 真の rule を保持し、Input A→Output A で例示、Input B→Output B を選択。誤答は rule の一部適用。
- 全 generator: seedable PRNG (mulberry32)。同一 seed → 同一問題。

## 5. なぜこの generator が Web-CAB らしいか

- PORT 19分類を pattern_id 母集団、StudyPro 複合度 (1/2/4法則) を難易度軸、実務出版PDF記号表を命令・暗号の正規化辞書として使用。
- ruleCount 分布・命令長分布・cipher 合成率を reference 分布に合わせ、10000問生成で分布検証する。
- holdout: reference の一部を設計時除外し、完成後に同型構造が自然生成されるか確認する。
