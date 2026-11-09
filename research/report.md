# Web-CAB Research Report（非公式・独立調査ノート）

> **非公式・転載なし。** 本ノートは日本SHLの CAB（Web-CAB）を、公開情報から構造のみ整理したものです。問題文・画像・選択肢の転載は一切ありません。本アプリはSHLとは無関係の独立練習ツールです。

- タグ: `[OFFICIAL]` = 日本SHL公式（shl.co.jp）、`[UNOFFICIAL]` = 対策サイト・参考書の横断一致
- tier: S = 公式または商業出版の一次資料、A = 対策サイト横断、B = 参考（分布決定に不使用）
- 出典 id は `research/sources.json` を参照。JSON側にも同じタグを付与している。

## 1. 公式情報（OFFICIAL）

### 1.1 商品アイデンティティ

| 項目 | 値 | 出典 |
|---|---|---|
| 名称 | CAB = **Computer Aptitude test Battery** | shl-column-20250926 |
| 正式名 | **コンピュータ職適性検査** | shl-column-20250926 |
| 提供 | 日本SHL（日本エス・エイチ・エル株式会社） | shl-column-20250926 |
| 成り立ち | 英国で開発された問題形式を日本語にローカライズ。1989年リリース | shl-column-20250926 / shl-column-220315 |
| 対象 | ITエンジニア・デジタル人材（新卒・中途、未経験可） | shl-official-cab |

`[OFFICIAL]` CABは日本SHLの国内向け商品。英語圏の **Verify G+**（グローバル向けの適応型テスト）とは別商品であり、CABがVerify G+の翻訳版であるという公式記述は存在しない（shl-column-20250926 / shl-column-220617）。

### 1.2 モジュール構成

| 科目 | CABコード | 公式ラベル | 公式説明の要旨 |
|---|---|---|---|
| 四則逆算 | CAB1 | 計数理解 | 様々な等式中の□の数字を、おおよその答えまで速く正確に求める |
| 法則性 | CAB2 | 直観的推理 | 流れを持った図形群に潜む法則性を速く正確に見分ける |
| 命令表 | CAB3 | プログラミング言語 | 与えられた指示・命令を速く正確に記憶し、使いこなす |
| 暗号 | CAB4 | 構造理解 | 表面の事象から、背後に隠された構造・関係を推理する |
| パーソナリティ | OPQ | OPQ | 性格検査。強制選択で作為的な回答を抑制 |

`[OFFICIAL]` 測定項目は「四則逆算・法則性・命令表・暗号・パーソナリティ（OPQ）」。所要時間合計は **72〜95分**（形式によるレンジ）、ノルムは **大卒**、実施形態は **紙 / Web / テストセンター方式**（shl-official-cab）。得点は **標準点10段階**（shl-column-20250926）。知的能力4科目 + パーソナリティの計5科目（shl-column-220315）。

### 1.3 実施形式と商品名

| 形式 | 商品名 | 備考 |
|---|---|---|
| 紙（マークシート） | CAB | 問題冊子方式 |
| Web | WebCAB | IT・技術職、デジタル人材職向け。テストセンター対応あり |
| テストセンター | C-CAB | 会場実施 |

出典: shl-official-cab / shl-column-20250926 / shl-column-220617。

### 1.4 非適応型（adaptive ではない）

- `[OFFICIAL]` 固定の問題セットである。公式ページに「適応型」の記載はない（2026-09-14確認、shl-official-cab ほか）。本題の前に例題が用意され、受検者は必ず練習問題を経てから採点対象に入る（shl-column-20250926）。
- `[UNOFFICIAL]` 対策サイト側も CAB を非適応型と記述している（paiza-webcab-practice）。
- 適応型なのは Verify G+ などグローバル商品であり、CABとは別物として扱う。

### 1.5 科目別の問題数・制限時間は非公開

- `[OFFICIAL]` 公式が公開するのは合計所要時間（72〜95分）のみ。
- `[UNOFFICIAL]` したがって第2章の科目別の数値は、すべて対策サイト・参考書の横断一致値である。公式値として引用してはならない。

## 2. 非公式コンセンサス（UNOFFICIAL）

### 2.1 模試プリセット（横断一致）

| 科目 | Web-CAB 問題数 | Web-CAB 時間 | 紙CAB 問題数 | 紙CAB 時間 |
|---|---|---|---|---|
| 四則逆算 | 50 | 9分 | 50 | 10分 |
| 法則性 | 30 | 12分 | 40 | 15分 |
| 命令表 | 36 | 15分 | 50 | 20分 |
| 暗号 | 30 | 16分 | 39 | 20分 |
| OPQ | 68 | 30分 | - | - |

出典: paiza-webcab-practice、onecareer-819、shukatsu-map-timer、careermine-cab。

- Webの知的能力4科目合計は 146問 / 52分。OPQを足すと 82分で、公式レンジ 72〜95分に収まる（整合確認）。
- 紙の4科目合計は 179問 / 65分。
- 科目別の数値はあくまで受験者側の再現値であり、企業・形式・年度で変わりうる。

### 2.2 採点

- `[UNOFFICIAL]` 誤謬率（ネガティブマーキング）なし。無回答は0点。空欄を作らず全問解答するのが有利（paiza-webcab-practice）。

### 2.3 電卓・メモ

- `[UNOFFICIAL]` 紙CAB: 電卓禁止。メモ用紙の使用は可。
- `[UNOFFICIAL]` Web-CAB: 電卓は一般に使用可だが、企業側の設定で変わる（ソース間で記述が割れているため断定しない）。画面内メモ機能はなく、紙のメモを使う。
- `[UNOFFICIAL]` Webは科目ごとに別セッションへ分割できることがある。紙は連続実施。

### 2.4 出題語彙の訂正（旧ノートからの修正点）

- `[UNOFFICIAL]` PORTの「19分類」は **全4科目の合計**（暗算4 + 法則性6 + 命令表3 + 暗号6）。法則性だけの分類数ではない（port-19patterns）。
- `[UNOFFICIAL]` 「複合度」は公表された用語ではない。実軸は **同時に働く個数**（StudyProの1個/2個/4個ラベル）。科目横断では命令4/5個、暗号4個まで及ぶ（studypro-hosoku / studypro-hub）。
- `[UNOFFICIAL]` 命令表の動作は **反転・削除・入替・取消・順序入替**。回転・塗り替え・位置移動・点の追加は命令表のプリミティブではない（jitsumu-pdf / studypro-meirei）。

## 3. 科目セマンティクス（taxonomy.json の要約）

### 3.1 四則逆算（CAB1 計数理解）

- `[OFFICIAL]` 等式中の□を求める形式（shl-column-220315）。
- `[UNOFFICIAL]` 未知数の位置: left-first / left-second / right / both-sides / divisor / two-occurrences / inside-parens。
- `[UNOFFICIAL]` 数値型: integer / decimal / fraction / percent / multi-unknown。
- `[UNOFFICIAL]` 構造形の例: `□+a=b`、`a−□=b`、`a÷□=b`、`□×(a−b)=c`、`(□+a)×b−c=d`、`□×(1/2+1/3)=c` など（記法のみ、数値・問題文なし）。
- `[UNOFFICIAL]` 解法プリミティブ: transpose / inverse-op / distribute / paren-as-block / integerize / reduce / ratio / estimate。
- `[UNOFFICIAL]` 難易度帯: basic（1演算）/ applied（2〜3演算・括弧・小数）/ production（長い連鎖・分数・複合）。

### 3.2 法則性（CAB2 直観的推理）

- `[OFFICIAL]` 図形群に潜む法則性を見分ける（shl-column-220315）。
- `[UNOFFICIAL]` 規則: rotation / rotation-increasing / movement-corner-cycle / movement-edge-cycle / movement-reciprocal（往復、古典的引っかけ）/ movement-diagonal / count-increase / count-decrease / line-count / shape-cycle / inside-outside / color-invert / color-alternate / color-sequential / size-alternate / mirror-h / mirror-v / stretch / appear-disappear / angle-growth / space-rotation。
- `[UNOFFICIAL]` 合成数: 1〜4個が同時に働く。既存のshare splitは 1-rule 25% / 2-rule 58% / 3-rule 17%。**4-ruleは難関帯に存在するが、このsplitには未反映**。
- `[UNOFFICIAL]` 確認軸: position / count / color / shape / size / orientation。
- `[UNOFFICIAL]` 誤答設計: 正解から **1属性だけ** ずらす（wrong-by-exactly-one-attribute）。

### 3.3 命令表（CAB3 プログラミング言語）

- `[OFFICIAL]` 指示・命令を速く正確に記憶・適用する（shl-column-220315）。
- `[UNOFFICIAL]` 正しいプリミティブ集合: `flip-v`（上下反転）/ `flip-h`（左右反転）/ `flip-180`（上下左右反転）/ `delete-prev`（前の図形を消す）/ `delete-next`（次の図形を消す）/ `swap-prev`（前の図形と入れかえる、G）/ `cancel-prev-command`（前の命令を取り消す）/ `cancel-next-command`（次の命令を取り消す）/ `reorder`（順序入れかえ: R=1..n→逆順, S=前半後半入替, J=隣接ペア入替）。
- `[UNOFFICIAL]` **除外**: rotation / fill-toggle / move / add-dot は命令表のプリミティブではない（jitsumu-pdf）。
- `[UNOFFICIAL]` 構造: 図形列は2〜4個（約90%が4個）、命令数は2〜5、**80%超が (図形数 + 1) 命令**。
- `[UNOFFICIAL]` 処理方針: 取消 → 削除 → 反転 → 入替 → 順序入替の順に解決する。

### 3.4 暗号（CAB4 構造理解）

- `[OFFICIAL]` 背後に隠された構造・関係を推理する（shl-column-220315）。
- `[UNOFFICIAL]` 図形操作: rotation（90cw / 90ccw / 180）/ mirror-h / mirror-v / invert-fill（部分適用あり）/ scale（大小変換）/ inside-outside（内外入替）/ move（位置移動）/ count-increase / count-decrease（記号増減）/ shape-replace（図形置換）/ add-element / delete-element / combine（合成）。
- `[UNOFFICIAL]` 構造規則: 1つの暗号図 + 3つの連動設問 = 1ブロック。記号の意味は **ブロック内でのみ** 有効。黒/白の矢印があり、暗号は **同じ色の矢印に沿ってのみ** 作用する。
- `[UNOFFICIAL]` 合成: 連鎖長1〜4。single / multi の2態様。前向き推論と逆算（逆方向推論）がある。難関帯では「該当なし」が選択肢に含まれる。
- `[UNOFFICIAL]` Group B（文字列・数値の暗号: shift / substitute / reverse / numbering）は **任意・二次扱い**。CAB本試験としての裏付けは弱い。

### 3.5 OPQ（パーソナリティ）

- `[OFFICIAL]` 強制選択形式で社会的望ましさバイアスを抑制する（shl-column-20250926）。`[UNOFFICIAL]` 「ipsative」という用語は対策サイト側の表現。
- `[UNOFFICIAL]` Web 68問 / 30分（paiza-webcab-practice）。

## 4. Taxonomy → Generator マッピング

`src/generators/policy.ts` と各generatorの実装状況（詳細は `coverage.md`）:

| 調査語彙 | 実装 | 状態 |
|---|---|---|
| arithmetic: unknown positions | left-first / inside-parens が中心。divisor / both-sides / two-occurrences は未対応 | PARTIAL |
| arithmetic: numericTypes | integer / decimal（≈13%）/ 除算による分数表現 | PARTIAL |
| arithmetic: solutionPrimitives | transpose / inverse-op / paren-as-block（`solve`の代数的逆算）。distribute / reduce / ratio / estimate は未対応 | PARTIAL |
| pattern: rules | rotation / movement-corner-cycle / color-invert / mirror-h / mirror-v の5種のみ（21規則中） | PARTIAL |
| pattern: compositions | 1/2/3-rule = 25% / 58% / 17%（policy.tsが単一の真実源）。4-rule は未対応 | YES (1〜3) |
| pattern: checkAxes | position / color / orientation は可。count / shape / size は未対応 | PARTIAL |
| commands: primitives | flip-v / flip-h のみ一致。flip-180 は Rotate180 として近接。delete / cancel / reorder 系は未実装 | PARTIAL |
| commands: excluded ops | rotate90 / rotate180 / toggle-fill / move-marker / add-dot / remove-dot を実装しており、調査結果と乖離（既知のドリフト） | MISMATCH |
| commands: structure | 図形は常に2個。命令数1〜5。（図形数+1）の強制なし | PARTIAL |
| cipher: figureOps | rotation / mirror-h / mirror-v / invert-fill / inside-outside / move / add-element の7/15 | PARTIAL |
| cipher: block structure | 1例 + 1設問。3連動設問ブロックと逆方向推論・「該当なし」は未対応 | PARTIAL |
| opq | 性格検査は生成対象外（設計どおり） | N/A |

- `[UNOFFICIAL]` 分布の対応: pattern 25/58/17、commands長 30/50/20、cipher single 65 / multi 35、arithmetic 小数 ≈13%。いずれも `EXPECTED_SHARES` とテストで固定されている。
- generator語彙を調査語彙へ寄せる改修（commandsのプリミティブ入れ替え等）は **コード変更タスク** であり本ノートの範囲外。

## 5. 未確定・要注意

- `[UNOFFICIAL]` 科目別の問題数・時間は公式非公開。Web/紙の値は受験者側の再現であり、断定しない。
- `[UNOFFICIAL]` Web-CABの電卓可否はソース間で割れている（可 / 企業設定次第）。本アプリでは断定表示しない。
- `[UNOFFICIAL]` pattern 4-rule の出現率は未計測。share split への追加は分布エビデンス待ち。
- `[UNOFFICIAL]` 暗号 Group B は本試験での裏付けが弱く、任意扱いのまま。
- `[UNOFFICIAL]` reashu の四則逆算は独立記事がなく、ハブ `https://reashu.com/cab/` 内セクション（2026-09-14確認）。
- `[UNOFFICIAL]` PORT 245007 は記事タイトル上は玉手箱の四則逆算だが、四則逆算形式はCABと共通のため形式語彙の根拠として使用。
- `[UNOFFICIAL]` OPQの「ipsative」は公表語ではなく対策サイト表現。公式は「強制選択で作為的回答を抑制」と説明する。

## 6. 主要出典

公式（tier S, OFFICIAL）:

| id | 内容 |
|---|---|
| shl-official-cab | CAB 商品ページ（72〜95分 / 大卒 / 紙・Web・テストセンター / OPQ） |
| shl-column-20250926 | 公式解説（正式名称 / WebCAB / C-CAB / 標準点10段階 / 例題と練習問題） |
| shl-column-220315 | CAB1〜CAB4 の科目解説（1989年リリース） |
| shl-column-220617 | 玉手箱Ⅲ・GAB・CAB・RAB の比較（別商品の根拠） |

非公式の主要ソース（tier A / S）: jitsumu-pdf（暗号・命令表の動作語彙）、paiza-webcab-practice、port-19patterns / port-arithmetic-245007 / port-hosoku-248318 / port-meirei-10 / port-ango-5、studypro-hub / studypro-hosoku / studypro-meirei / studypro-ango、reashu-cab / reashu-hosoku20 / reashu-angou、noahs-ark-instruction / noahs-ark-instruction-test / noahs-ark-hosoku、careerpark-meirei-106765、careermine-cab。全30件の license / attribution は `research/sources.json` を参照。

---

最終更新: 2026-09-14。構造のみ・転載なしの方針は `research/sources.json` の `policy` に同じ文言で記録している。
