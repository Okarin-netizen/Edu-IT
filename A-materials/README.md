# A 材料と加工の技術 教材アプリ

技術分野「材料と加工の技術」で使う、オフラインで動く7つの学習アプリ(M1〜M7)と、先生用の提出ファイル一覧ビューアです。
`index.html`(メニュー)を Chrome で開くと使えます。4分野共通の画面の枠 `../shared/` を同じ階層に置いてください。

## フォルダの中身

```
A-materials/
├─ index.html            メニュー(ここから開く)
├─ sw.js  manifest.webmanifest  icons/   オフライン用(PWA)
├─ eduit-info.js         版と更新履歴
├─ common/               全アプリ共通の部品(使い方は common/README.md)
├─ m1-material-navi/     M1 材料選択ナビ
├─ m2-wood-lab/          M2 木材の繊維・収縮ラボ
├─ m3-structure-lab/     M3 構造強化ラボ
├─ m4-drawing-trainer/   M4 製図トレーナー
├─ m5-kidori/            M5 木取り・構想シミュレータ
├─ m6-tool-safety/       M6 工具の使い方・安全トレーナー
├─ m7-solid-maker/       M7 第三角法 立体メーカー
├─ teacher-viewer/       先生用 提出ファイル一覧ビューア
├─ dist/                 配布用の完成ファイル(1ファイル版 材料と加工_教材アプリ.html)
├─ docs/                 先生用の文書(使い方_先生用.html)
└─ build/                作る道具(build-single.py・build-ruby-dict.py)
```

## 作り方(A-materials で実行)

- 1ファイル版: `python3 build/build-single.py` → `dist/材料と加工_教材アプリ.html`
- ふりがな辞書: `python3 build/build-ruby-dict.py` → `common/ruby-dict.js`(`--scan` で辞書にない語を推定して追加)

アプリやページを足したら `build/build-single.py` の `PAGES` と `sw.js` を直し、`sw.js` の `VERSION` を上げてください。

## テスト

```
node --test common/beam.test.js m3-structure-lab/app.test.js m5-kidori/packing.test.js m6-tool-safety/tests/m6.test.js teacher-viewer/summary.test.js
node m4-drawing-trainer/tests/run-tests.js
node --test m7-solid-maker/tests/geom.test.js
```

## 注意(保存データ)

生徒の作品は端末の Chrome の中(IndexedDB `gijutsu`・localStorage `gijutsu.*` `kidori.*` など)に保存されます。
アプリの id(`kidori` など)や保存キーは、フォルダ名を変えても変えないでください(前の作品や書き出したファイルが読めなくなります)。
