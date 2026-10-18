# Edu-IT 技術分野 体験教材集

中学校技術・家庭科（技術分野）で使う体験教材です。どれもインターネット不要で、HTMLファイルをブラウザで開けば動きます。
作成: 技術　岡田 ／ 使ってよい条件は [`LICENSE.md`](LICENSE.md)

## フォルダの地図

```
Edu-IT/
├─ A-materials/      A 材料と加工の技術
├─ B-bio/            B 生物育成の技術
├─ C-energy/         C エネルギー変換の技術
├─ D-information/    D 情報の技術
├─ teacher-tools/    先生用の道具(4分野共通)
├─ shared/           4分野共通の枠(見た目・作成者・安全と個人情報・ライセンス・更新履歴)と、4分野で同じ教材(問題解決ノート)
├─ クラスルーム配布/  Classroom で配るファイル(生徒に配る/・先生用/)
├─ site/            生徒用のホームページ(GitHub Pages)の入口ページと、公開するファイルをまとめる道具
├─ LICENSE.md        使ってよい条件
└─ README.md         この文書
```

**授業で配るだけなら [`クラスルーム配布/`](クラスルーム配布/) を見てください。** 1つの分野につき1つの「統一版」を配ります。どれを配ればよいかは [`クラスルーム配布/README.md`](クラスルーム配布/README.md) にあります。

## 基本編と発展編

4つの分野のどの統一版も、メニューが「基本編」「発展編」のタブに分かれています。
学習指導要領(平成29年告示)の内容と教科書(東京書籍・開隆堂・教育図書)の内容から、全員が学ぶタブ・ページを基本編、
教科書の「発展」「コラム」にあたるものや数値での設計・計算、新しい技術を使うものを発展編にしています。
1つの教材が両方の編に出ることもあり、カードの「使うところ」にその編で使うタブ・ページの名前が出ます。

教材の記号は **分野の文字 + 番号**(A1〜A8・B1〜B4・C1〜C5・D1〜D9)で、4分野とも **番号の順 = おすすめの順 = メニューのカードの順** です。
アプリの中のタブも「基本 → 発展」の順にならべ、**①②③…の続き番号** にしています(「はじめに」「振り返り」「記録」は番号なし)。
メニューのカード・上のバーの形は4分野共通です(`shared/eduit-frame.js` の `EduitFrame.card`・`menuTitle`・`code`)。

- 分け方のもと: 各分野の `eduit-info.js` の `levels`(タブの部品は `shared/eduit-frame.js` の `EduitFrame.levels`)
- 先生用の一覧(学習指導要領の項目と理由つき): [`teacher-tools/kihon-hatten/`](teacher-tools/kihon-hatten/) → `クラスルーム配布/先生用/全分野_基本編と発展編.html`

## 4つの分野の中は同じ形

```
<分野>/
├─ (アプリのフォルダ)   a1-…〜a8-…・B1〜B4・C1〜C5・各ラボ
├─ dist/       配布用の完成ファイル(作り直してできるもの)
├─ docs/       先生用の文書(手引き・使い方)
├─ build/      作る道具(ビルドのスクリプト)
├─ review/     レビュー・改善計画(ある分野だけ)
├─ eduit-info.js  その分野の版と更新履歴
└─ README.md   その分野の説明と、作り方・テストのしかた
```

| フォルダ | 分野 | 教材 | 配布用(`dist/`) | 作り直すコマンド |
|---|---|---|---|---|
| [`A-materials/`](A-materials/) | A 材料と加工 | A1 材料選択ナビ・A2 木材ラボ・A3 構造強化ラボ・A4 製図トレーナー・A5 木取り・A6 工具の安全・A7 第三角法 立体メーカー・A8 問題解決ノート・先生用ビューア | `材料と加工_教材アプリ.html` | `python3 A-materials/build/build-single.py` |
| [`B-bio/`](B-bio/) | B 生物育成 | B1 育成環境コントローラ・B2 動物飼育・水産・B3 栽培暦ビルダー・B4 育成日誌 | `生物育成教材集.html`・`先生用ガイド.html`・zip | `node B-bio/build/rebuild.js` |
| [`C-energy/`](C-energy/) | C エネルギー変換 | C1 エネルギー変換ゲーム・C2 電気回路ラボ・C3 機構ラボ・C4 保守点検ラボ・C5 回路設計シート | `energy-apps.html`・zip | `python3 C-energy/build/build.py` |
| [`D-information/`](D-information/) | D 情報 | 体験教材集(D1 デジタル化・D2 仮想CPU・D3 ネットワーク・D4 セキュリティ・D5 ネット詐欺・D6 双方向・D7 計測制御・D8 生成AI・D9 ハッシュ化の9教材) | `情報の技術_体験教材集.html`(9教材の統一版)・zip・`生成AIのしくみラボ.html`・`ネット詐欺_追体験ラボ.html`・`ハッシュ化体験ラボ.html`(1つだけ配るとき) | [`D-information/README.md`](D-information/README.md) の順に |

## 先生用の道具 → [`teacher-tools/`](teacher-tools/)

| フォルダ | 道具 |
|---|---|
| [`teacher-tools/furikaeri-ichiran/`](teacher-tools/furikaeri-ichiran/) | 振り返り一覧: 4分野の教材が書き出した JSON をまとめて読み込み、振り返り・自己評価・提出状況を一覧にして CSV で保存する |
| [`teacher-tools/kihon-hatten/`](teacher-tools/kihon-hatten/) | 基本編と発展編の分け方: 4分野の統一版の「基本編」「発展編」に入るタブ・ページを、学習指導要領の項目と理由つきで一覧にする(`python3 teacher-tools/kihon-hatten/build.py`) |

## 4分野共通の枠 → [`shared/`](shared/)

すべてのアプリで、ヘッダー・ボタン・カード・色の「枠」と、画面の下の
「作成: 技術　岡田 ・ 版 ・ 安全と個人情報・ライセンス・更新履歴」をそろえています。
部品は `shared/`、各分野の版と更新履歴は各分野の `eduit-info.js` にあります。
先生用ガイドも、4分野で名前(`先生用ガイド`)・章立て・見た目(`shared/eduit-guide.css`)をそろえています(形は [`shared/README.md`](shared/README.md))。

## ホームページで公開する(GitHub Pages) → [`site/`](site/)

生徒は URL を開くだけで、ダウンロードせずに使えます。公開するのは **入口ページ(A〜D の一覧)と4つの統一版だけ** で、先生用ガイドと `teacher-tools/` はホームページに出しません。

- 公開されるもの: `index.html`(入口・[`site/index.html`](site/index.html))・`a.html`〜`d.html`(いちばん上に「◀ 分野をえらぶ」のバーがあり、その下に `apps/` に置いた `クラスルーム配布/生徒に配る/` の統一版を出す)
- `main` に push すると、[`.github/workflows/pages.yml`](.github/workflows/pages.yml) が `python3 site/build.py` で `_site/` にまとめて公開します。
- はじめに1回だけ: リポジトリの Settings → Pages → Source を「GitHub Actions」にします(無料プランではリポジトリを Public にする必要があります)。
- 記録はホームページのアドレスごとに、その端末のブラウザの中に保存されます。ダウンロードしたファイルで使った記録とは別になります。

## 教材を直したあとの流れ

1. 直した分野の「作り直すコマンド」を実行する(`dist/` が新しくなる)
2. `python3 クラスルーム配布/まとめる.py` を実行する(配布用のフォルダが新しくなる)
3. commit して `main` に push する(ホームページも新しくなる)

## 気をつけること

- 記号はフォルダ名・保存名・書き出しの app の値にも入っています(A `a2-wood-lab/`・`a2.*`、B `B-bio/B1/`・`b1_*`・`app: 'B1'`、C `C-energy/C1/`・`energyApps.C1.v1`・`app: 'C3'`)。
  記号を変えるときは、これらと振り返り一覧(`teacher-tools/furikaeri-ichiran/parse.js`)をいっしょに直してください。
  2026-10-16 に記号をそろえたとき、それより前の版の記録との互換性はなくしました(リリース前のため)。
- フォルダのまま Web サーバーに置くときは、その分野のフォルダと `shared/` を同じ並びで置きます。
