# C エネルギー変換の技術(E1〜E5)

中学校技術「C エネルギー変換の技術」の学習アプリです。インターネットなしで、ブラウザだけで動きます。

## フォルダの中身

| 場所 | 中身 |
|---|---|
| `E1/`〜`E5/` | 各アプリの元ファイル(E1 エネルギー変換ゲーム・E2 電気回路ラボ・E3 機構ラボ・E4 保守点検ラボ・E5 回路設計シート) |
| `eduit-info.js` | 版・更新日・更新履歴など(4分野共通の枠が読む) |
| `dist/` | 配布用の完成ファイル。`energy-apps.html`(E1〜E5 が入った1ファイル)と `energy-apps.zip`(html・使い方・先生用ガイド・README.txt) |
| `docs/` | 先生用の文書。`先生用ガイド.html`(4分野で同じ章立ての先生用ガイド)と `tsukaikata.html`(使い方 生徒向け・先生向け。印刷できる) |
| `build/` | 作る道具。`build.py`・`help.py`(使い方・先生用ガイドの本文)・`shell.html`(統合版の枠)・`tsukaikata.tpl.html`・`sensei-guide.tpl.html`(先生用ガイドのひな形)・`README.txt`(zip に入れる説明のひな形) |
| `review/` | レビュー結果と改善計画 |

## 作り直しかた

E1〜E5 や `build/` の中を直したら、リポジトリのいちばん上のフォルダで次を実行します(Python 3 だけで動きます)。

```
python3 C-energy/build/build.py
```

`dist/energy-apps.html`・`dist/energy-apps.zip`・`docs/tsukaikata.html`・`docs/先生用ガイド.html` が作り直されます。
版を上げるときは、先に `eduit-info.js` の version・updated・history を書きかえます。

## 注意

- 学習の記録はブラウザに `energyApps.E1.v1`〜`energyApps.E5.v1` の名前で保存されます。前の記録が使えなくなるので、この名前は変えないでください。
- 配布ファイル名 `energy-apps.html` と zip の中のフォルダ名 `energy-apps/` も、配布ずみのものと合わせるため変えていません。
