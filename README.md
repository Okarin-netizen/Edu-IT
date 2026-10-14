# Edu-IT 技術分野 体験教材集

中学校技術・家庭科（技術分野）で使う体験教材です。どれもインターネット不要で、HTMLファイルをブラウザで開けば動きます。

## フォルダ構成（内容ごとに `*-apps/` で統一）

| フォルダ | 分野 | 中身 |
|---|---|---|
| [`materials-apps/`](materials-apps/) | A 材料と加工の技術 | 材料ナビ・木材ラボ・構造ラボ・製図トレーナー・工具の安全・部品取り計画・先生用ビューア |
| [`bio-apps/`](bio-apps/) | B 生物育成の技術 | B1〜B4（`dist/` に教材集と先生用ガイド、`review/` にレビューとビルド） |
| [`energy-apps/`](energy-apps/) | C エネルギー変換の技術 | E1〜E5（`dist/` に配布用1ファイルと zip、`review/` にレビュー） |
| [`information-apps/`](information-apps/) | D 情報の技術 | 体験教材集とデジタル化・仮想CPU・ネットワーク・セキュリティ・双方向・計測制御の各ラボ |

## 共通のルール

- 配布用の完成ファイルは各分野の `dist/`（情報は `kyozai-shu/release/`）に置く
- レビューや改善メモは各分野の `review/`（情報は `information-apps/reviews/`）に置く
- 各教材の作り方・テストは、それぞれのフォルダの `README.md` を見る

## 情報の技術（`information-apps/`）

| フォルダ | 教材 |
|---|---|
| `kyozai-shu/` | 体験教材集（6教材のまとめ。配布は `release/` の html と zip） |
| `digitization-lab/` | デジタル化ラボ |
| `virtual-cpu/` | 仮想CPUラボ |
| `network-sim/` | ネットワーク通信シミュレータ |
| `security-lab/` | 情報セキュリティ体験ラボ |
| `interactive-studio/` | 双方向コンテンツ制作スタジオ |
| `measure-control-sim/` | 計測・制御シミュレータ |
| `reviews/` | 中学生目線レビュー（2026-10-13、指摘143件と画面例） |

`kyozai-shu/` のビルドは兄弟フォルダ（`security-lab/` など）を読むため、`information-apps/` の中をまとめて動かしてください。
