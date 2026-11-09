# Coverage Matrix（調査語彙 vs 実装）

> 基準: `research/taxonomy.json`（2026-09-14版、語彙訂正済み）。Generator列は `src/generators/*` と `src/domain/*` の実装、Tests列は `tests/*.prop.test.ts` と `tests/integration.test.ts` の有無。
> 凡例: **YES** = 実装/テストあり、**PARTIAL** = 近接実装（語彙または意味がずれる）、**NO** = 未実装、**MISMATCH** = 調査結果と逆の実装、**N/A** = 対象外。
> 注: Testsは生成器単位の不変条件・分布テストの有無を示す。個別規則ごとのテストではない。

## サマリ

| 科目 | 一致 | 部分 | 未実装 | ドリフト | N/A | テスト |
|---|---|---|---|---|---|---|
| arithmetic | 8 | 4 | 10 | 0 | 0 | YES (arithmetic.prop / domain / integration) |
| pattern | 10 | 1 | 20 | 0 | 0 | YES (pattern.prop / integration) |
| commands | 3 | 4 | 12 | 4 | 0 | YES (commands.prop / integration) |
| cipher | 11 | 5 | 13 | 0 | 1 | YES (cipher.prop / integration) |

---

## arithmetic（四則逆算 / CAB1）

| 語彙 | Generator | Tests | 備考 |
|---|---|---|---|
| unknownPositions: left-first | YES | YES | 全レベルで未知数は左先行 |
| unknownPositions: inside-parens | YES | YES | level2/3 の括弧内 |
| unknownPositions: right | PARTIAL | YES | `a × □` 形のみ。`a − □` / `a ÷ □` は無し |
| unknownPositions: left-second | NO | - | - |
| unknownPositions: both-sides | NO | - | - |
| unknownPositions: divisor | NO | - | 未知数が除数になる型は未実装 |
| unknownPositions: two-occurrences | NO | - | 未知数は常に1個 |
| numericTypes: integer | YES | YES | - |
| numericTypes: decimal | YES | YES | policy.ts で ≈13% |
| numericTypes: fraction | PARTIAL | YES | 除算で表現。分数表示・通分は未実装 |
| numericTypes: percent | NO | - | - |
| numericTypes: multi-unknown | NO | - | - |
| solutionPrimitives: transpose | YES | YES | `solve` の代数的逆算 |
| solutionPrimitives: inverse-op | YES | YES | `invertBin` |
| solutionPrimitives: paren-as-block | YES | YES | `group` ノード |
| solutionPrimitives: integerize | PARTIAL | YES | `round2` のみ。分数の整数化は無し |
| solutionPrimitives: distribute | NO | - | 展開を要する型は未実装 |
| solutionPrimitives: reduce | NO | - | - |
| solutionPrimitives: ratio | NO | - | - |
| solutionPrimitives: estimate | NO | - | 概算専用の型は無し |
| difficultyTiers: basic / applied / production | YES | YES | difficulty 1/2/3 の buildLevel1/2/3 に対応 |
| distractors | PARTIAL | YES | 数値近傍（±1/2/5/10・符号反転・2倍/半分）のみ。rhs-as-answer / dropped-bracket-postfix / decimal-shift / lcm-slip は無し |

## pattern（法則性 / CAB2）

| 規則 | Generator | Tests | 備考 |
|---|---|---|---|
| rotation | YES | YES | 90/180/270 |
| movement-corner-cycle | YES | YES | 時計回り・反時計回りの角巡回 |
| color-invert | YES | YES | `toggleFill` |
| mirror-h | YES | YES | `flipH` |
| mirror-v | YES | YES | `flipV` |
| rotation-increasing | NO | - | 角度が増える系列は無し |
| movement-edge-cycle | NO | - | 辺上巡回は無し |
| movement-reciprocal | NO | - | 往復移動は無し（古典的引っかけだが未実装） |
| movement-diagonal | NO | - | - |
| count-increase | NO | - | - |
| count-decrease | NO | - | - |
| line-count | NO | - | - |
| shape-cycle | NO | - | - |
| inside-outside | NO | - | - |
| color-alternate | NO | - | - |
| color-sequential | NO | - | - |
| size-alternate | NO | - | サイズ軸は `visualKey` にも無し |
| stretch | NO | - | - |
| appear-disappear | NO | - | - |
| angle-growth | NO | - | - |
| space-rotation | NO | - | - |
| compositions: 1-rule / 2-rule / 3-rule | YES | YES | policy.ts で 25% / 58% / 17% |
| compositions: 4-rule | NO | - | 難関帯の語彙として存在するが未実装 |
| checkAxes: position | YES | YES | `moveMarker` |
| checkAxes: orientation | YES | YES | `rotate` / `flip` |
| checkAxes: color | YES | YES | `toggleFill` |
| checkAxes: count | NO | - | - |
| checkAxes: shape | NO | - | - |
| checkAxes: size | NO | - | - |
| distractorDesign: wrong-by-exactly-one-attribute | PARTIAL | YES | 部分適用・前後フレーム・逆回転は作るが、6軸の1属性ずらしとしては未整理 |

## commands（命令表 / CAB3）

| 語彙 | Generator | Tests | 備考 |
|---|---|---|---|
| flip-v（上下反転） | YES | YES | `FlipV` |
| flip-h（左右反転） | YES | YES | `FlipH` |
| flip-180（上下左右反転） | PARTIAL | YES | `Rotate180` として近接実装。語彙が「回転」になっており不一致 |
| delete-prev（前の図形を消す） | NO | - | - |
| delete-next（次の図形を消す） | NO | - | - |
| swap-prev（前の図形と入れかえる / G） | PARTIAL | YES | `SwapPos` は2図形の位置交換で、前後カーソル意味論ではない |
| cancel-prev-command（前の命令取消） | NO | - | - |
| cancel-next-command（次の命令取消） | NO | - | - |
| reorder（R / S / J） | NO | - | - |
| **excluded: rotation** | MISMATCH | YES | `Rotate90` / `Rotate180` を実装。調査上は命令表プリミティブではない |
| **excluded: fill-toggle** | MISMATCH | YES | `ToggleFill` を実装。調査上は除外 |
| **excluded: move** | MISMATCH | YES | `MoveMarker` を実装。調査上は除外 |
| **excluded: add-dot** | MISMATCH | YES | `AddDot` / `RemoveDot` を実装。調査上は除外 |
| structure: figures 2〜4（約90%が4） | NO | - | 図形は常に2個（主図形+点） |
| structure: commands 2〜5 | PARTIAL | YES | 1〜5。下限1は調査範囲外 |
| structure: figures+1 が80%超 | NO | - | 図形数と命令数の連動なし |
| processingPolicy（取消→削除→反転→入替→順序入替） | NO | - | 左から右への逐次適用のみ。取消・削除の事前解決なし |
| distractors: unapplied-flip | YES | YES | 最終命令抜き |
| distractors: wrong-permutation | PARTIAL | YES | 逆順適用のみ。R/S/J の取り違えは無し |
| distractors: double-blank | NO | - | - |
| distractors: post-cancel-flip | NO | - | - |
| distractors: wrong-neighbour | NO | - | - |
| distractors: axis-swap | NO | - | - |

## cipher（暗号 / CAB4）

| 語彙 | Generator | Tests | 備考 |
|---|---|---|---|
| rotation-90cw | PARTIAL | YES | 90/180/270 を扱うが、方向（cw/ccw）は未分化 |
| rotation-90ccw | NO | - | 反時計回り専用の規則は無し |
| rotation-180 | YES | YES | - |
| mirror-h | YES | YES | `flip` axis h |
| mirror-v | YES | YES | `flip` axis v |
| invert-fill | YES | YES | `fill`（部分適用の表現は無し） |
| scale（大小変換） | NO | - | - |
| inside-outside | YES | YES | `swapObjects` |
| move | YES | YES | `moveMarker` |
| count-increase | NO | - | - |
| count-decrease | NO | - | - |
| shape-replace | NO | - | - |
| add-element | YES | YES | `add-dot` |
| delete-element | PARTIAL | - | `removeDot` プリミティブはあるが暗号規則からは未使用 |
| combine | NO | - | - |
| structure: symbol-meaning-block-local | YES | YES | 規則は問題内でのみ有効 |
| structure: one-diagram-three-questions-block | NO | - | 1例 + 1設問。3連動設問ではない |
| structure: same-colour-arrow-only | N/A | - | 矢印ネットワークのモデルが無い |
| composition: chain 1〜4 | PARTIAL | YES | 1〜3。4連鎖は無し |
| composition: single / multi | YES | YES | policy.ts で 65% / 35% |
| composition: forward inference | YES | YES | 例A→Bの順方向のみ |
| composition: reverse inference | NO | - | 逆算型は無し |
| composition: 該当なし選択肢 | NO | - | - |
| groupB（shift / substitute / reverse / numbering） | NO | - | 任意・二次扱いのため未実装 |
| distractors: partial-application | YES | YES | 先頭のみ・最終抜き |
| distractors: non-commutative-order-error | PARTIAL | YES | 逆順適用で近似 |
| distractors: assumed-rule | PARTIAL | YES | 誤回転・塗り忘れで近似 |
| distractors: gamma-delta-swap | NO | - | - |
| distractors: bad-inverse | NO | - | - |
| distractors: transcription-slip | NO | - | - |

## 結論

- 現行generatorは4科目の **形式**（等式逆算・5フレーム欠落・命令列適用・例A→B規則推論）を再現している。
- 語彙は旧推定（回転・塗り替えを命令表に含める等）に基づいており、今回の訂正語彙とは `commands` で最も大きく乖離する。
- 分布（pattern 25/58/17、commands長 30/50/20、cipher 65/35、小数13%）は `src/generators/policy.ts` が単一の真実源であり、引き続きテストで固定されている。
- 語彙を調査結果へ寄せる実装変更はコード変更タスクのため、本ノートでは差分の記録にとどめる。
