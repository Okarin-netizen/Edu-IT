# A 材料と加工の技術 教材集

技術分野「材料と加工の技術」で使う、オフラインで動く8つの学習アプリ(A1〜A8)と、先生用の提出ファイル一覧ビューアです。
番号の順(A1 → A8)が、おすすめの順・メニューのカードの順です。アプリの中のタブは ①②③… で、基本編のタブが先、発展編のタブがそのあと。まとめ・記録・ふりかえりのタブは番号なしで最後にあります。
`index.html`(メニュー)を Chrome で開くと使えます。4分野共通の画面の枠 `../shared/` を同じ階層に置いてください。

## フォルダの中身

```
A-materials/
├─ index.html            メニュー(ここから開く)
├─ sw.js  manifest.webmanifest  icons/   オフライン用(PWA)
├─ eduit-info.js         版と更新履歴
├─ common/               全アプリ共通の部品(使い方は common/README.md)。apps.js にアプリの一覧(id・記号 code・絵・フォルダ)
├─ a1-material-navi/     A1 材料選択ナビ
├─ a2-wood-lab/          A2 木材の繊維・収縮ラボ
├─ a3-structure-lab/     A3 構造強化ラボ
├─ a4-drawing-trainer/   A4 製図トレーナー
├─ a5-kidori/            A5 木取り・構想シミュレータ
├─ a6-tool-safety/       A6 工具の使い方・安全トレーナー
├─ a7-solid-maker/       A7 第三角法 立体メーカー
├─ a8-mondai-note/       A8 問題解決ノート(中身は4分野共通の ../shared/mondai-note/)
├─ teacher-viewer/       先生用 提出ファイル一覧ビューア
├─ dist/                 配布用の完成ファイル(1ファイル版 材料と加工_教材アプリ.html)
├─ docs/                 先生用の文書(先生用ガイド.html)
├─ build/                作る道具(build-single.py・build-ruby-dict.py)
└─ review/               中学生目線レビューの記録(A7。記録はその時の記号 M7 のまま)
```

## 作り方(A-materials で実行)

- 1ファイル版: `python3 build/build-single.py` → `dist/材料と加工_教材アプリ.html`
- ふりがな辞書: `python3 build/build-ruby-dict.py` → `common/ruby-dict.js`(`--scan` で辞書にない語を推定して追加)

アプリやページを足したら `common/apps.js`(と `eduit-info.js` の `levels`)・`build/build-single.py` の `PAGES`・`sw.js` を直し、`sw.js` の `VERSION` を上げてください。
版を上げるときは `eduit-info.js` の `version`・`history`、`common/core.js` の `G.version`、`sw.js` の `VERSION` をそろえます。

クラスルーム配布の `まとめる.py` は、このビルドを使って統一版と A7 だけの1ファイル(`inline("a7-solid-maker/index.html")`)を作ります。

## テスト

```
node --test common/beam.test.js a3-structure-lab/app.test.js a5-kidori/packing.test.js a6-tool-safety/tests/a6.test.js teacher-viewer/summary.test.js
node a4-drawing-trainer/tests/run-tests.js
node --test a7-solid-maker/tests/geom.test.js
node --test ../shared/mondai-note/mondai-note.test.js   # A8 問題解決ノートの本体(4分野共通)
NODE_PATH=… node a7-solid-maker/tests/e2e.browser.cjs   # build-single.py のあと。playwright が必要
```

## 注意(保存データ)

生徒の作品は端末の Chrome の中(IndexedDB `gijutsu`・localStorage `gijutsu.*` `kidori.*` など)に保存されます。
アプリの id(`kidori` など)は書き出すファイルの `app` の値にもなるので、記号やフォルダ名を変えても変えないでください。
第2.4版でフォルダと記号を m1-…/M1 から a1-…/A1 に変えましたが、id・保存キー・書き出すファイルの形は同じなので、前の版の作品もそのまま読めます(A2 の表示設定のキーだけ `m2.*` → `a2.*`)。
