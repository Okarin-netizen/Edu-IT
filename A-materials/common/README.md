# common/ 共通基盤の使い方

材料と加工の各アプリ(M1〜M7)が共有する部品です。持ち主は共通基盤スレッドです。
不具合や追加してほしい機能があれば、編集せずに共通基盤スレッドへ伝えてください
(例外: `beam.js` は M3 スレッドが直接直してよい)。

## フォルダ構成

```
A-materials/
  index.html            メニュー(共通基盤スレッド)
  sw.js                 Service Worker(共通基盤スレッド)
  manifest.webmanifest  PWA 設定(共通基盤スレッド)
  eduit-info.js         版と更新履歴(4分野共通の枠が読む)
  icons/
  common/               ← この部品
  m1-material-navi/  m2-wood-lab/  m3-structure-lab/  m4-drawing-trainer/  m5-kidori/  m6-tool-safety/  m7-solid-maker/
  teacher-viewer/       先生用 提出ファイル一覧ビューア(共通基盤スレッド)
  docs/使い方_先生用.html   先生用の使い方
  build/build-single.py     1ファイル版を作る(python3 build/build-single.py → dist/)
  build/build-ruby-dict.py  ふりがな辞書 common/ruby-dict.js を作る
  dist/                 配布用の1ファイル版(材料と加工_教材アプリ.html)
```

各アプリは `<アプリ>/index.html` が入口です。

## 守ること

- **classic script で読む**(`<script src>`。`type="module"` は使わない)。`file://` で開いても動くようにするため。
- 外部 CDN・外部通信なし。フォントも端末のものを使う。
- 教科書の図・文章は転載しない。図は自作 SVG / Canvas。
- 色だけに頼らない(形・線種・文字でも区別)。キーボードで操作できるようにする。
- 数値は「目安」と表示する(`G.noteEstimate()`)。

## ひな形

```html
<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>製図トレーナー</title>
<link rel="manifest" href="../manifest.webmanifest">
<link rel="icon" href="../icons/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="../common/base.css">
<link rel="stylesheet" href="style.css">
</head>
<body>
<header id="g-header"></header>
<main>
  <div data-g-tabs>
    <div class="g-tablist" role="tablist">
      <button role="tab" data-tab="quiz"><span class="num">1</span>クイズ</button>
      <button role="tab" data-tab="draw"><span class="num">2</span>作図練習</button>
    </div>
    <section data-panel="quiz">…</section>
    <section data-panel="draw">…</section>
  </div>
</main>
<script src="../common/ruby-dict.js"></script>
<script src="../common/core.js"></script>
<!-- 必要なら: <script src="../common/materials.js"></script> <script src="../common/beam.js"></script> -->
<script src="app.js"></script>
</body>
</html>
```

```js
// app.js
G.initApp({
  app: 'drawing-trainer',            // 保存データの app 名(下の一覧と同じにする)
  title: '製図トレーナー',
  files: ['style.css', 'app.js', 'data.js']  // オフライン用にキャッシュしたい自分のファイル
});
G.tabs(G.$('[data-g-tabs]'));
```

app 名(メニューの並び順 M1→M7): `material-navi` / `wood-lab` / `structure-lab` / `drawing-trainer` / `kidori`(M5) / `tool-safety` / `solid-maker`(M7)

## G の主な機能(core.js)

| 機能 | 説明 |
|---|---|
| `G.initApp({app,title,files,home,data,help,tools})` | 4分野共通の枠のヘッダー(`.ef-header`: ◀ メニュー・ふりがな・文字サイズ・くっきり・使い方(`help` に関数か URL)・アプリだけのボタン(`tools` に要素))、共通のフッター(作成者・版・安全と個人情報・ライセンス・更新履歴 + 保存データの管理。`data:false` で管理ボタンなし)、ルビ自動付与、Service Worker 登録 |
| `G.h(tag, attrs, ...children)` | 要素を作る。`onclick` などはイベント、`class`、`style:{}`、`html` 可 |
| `G.$(sel)` / `G.$$(sel)` | querySelector / querySelectorAll(配列) |
| `G.num(v, def, lo, hi)` | 入力を安全な数値に(全角数字・空欄・範囲外に強い) |
| `G.fmt(n, digits)` | 数値を表示用に |
| `G.tabs(root, onChange)` | タブ(矢印キー対応)。`{show(name)}` を返す |
| `G.toast(msg)` | 下に短いお知らせ |
| `G.modal({title, body, actions})` / `G.confirm(msg)` | ダイアログ。Promise を返す |
| `G.store.put(a)` / `get(id)` / `list(app)` / `del(id)` | IndexedDB に保存(使えないときは localStorage)。Promise |
| `G.newArtifact(app, title, data, kind)` | 共通スキーマの作品を作る |
| `G.openDialog(app)` | 保存した作品の一覧から選ぶ → Promise<artifact or null> |
| `G.dataDialog(app, title)` | 保存データの管理(1件ずつ削除・すべて削除、確認つき)。消したら閉じるときに読み込み直す。`app` を省くと全アプリ |
| `G.clearAppData(app)` | そのアプリの作品と localStorage(`G.LS_PREFIX[app]` で始まるキー)を消す。localStorage を使うアプリは `G.LS_PREFIX` に頭を登録する |
| `G.exportJSON(obj, filename)` / `G.pickJSON()` / `G.normalizeImport(obj, app)` | JSON の書き出し・読み込み |
| `G.download(blob, filename)` | ファイルを保存させる(PNG など) |
| `G.psCycle(el, ['plan','eval'])` | 問題解決の流れ(問題の発見→課題の設定→構想→製作→評価→改善)。受け持つ段階を ▶ と色で強調し、下に「▶ = このアプリでとりくむ段階」と説明を出す(段階を1つも渡さないときは説明なし) |
| `G.VIEWPOINTS` / `G.viewpointSliders(el, values, onChange)` | 技術の見方・考え方(社会・環境・経済・安全・使いやすさ・機能)の自己評価 |
| `G.radar(canvas, {axes, max, series:[{label, values}]})` / `G.radarLegend(labels)` | レーダーチャート。系列ごとに色＋線種＋マーカーで区別 |
| `G.noteEstimate(text)` | 「目安です」の注意書き要素 |
| `G.setupCanvas(canvas, w, h)` | 高解像度 Canvas の準備。ctx を返す(座標は CSS ピクセル) |
| `G.settings.get/set` | 端末内の共通設定(`ruby`, `size`, `contrast`) |

### 共通スキーマ artifact

```json
{ "schema": "gijutsu-artifact/1", "id": "kidori-xxxx", "app": "kidori", "kind": "work",
  "title": "本立て", "createdAt": "ISO日時", "updatedAt": "ISO日時", "data": { "アプリごとの中身": "..." } }
```

メニューの「すべてファイルに書き出す」は `{schema:'gijutsu-bundle/1', artifacts:[...]}` を出します。
ボタンの名前は全アプリで **「ファイルに書き出す」「ファイルから読み込む」** にそろえる(「JSON」は付けない)。
各アプリの読み込みは `G.normalizeImport(obj, 'アプリ名')` を通せば、単体・配列・まとめファイルのどれでも受け取れます。

## ルビ(ふりがな)

- 文章は普通に書けば、辞書にある語に自動で `<ruby>` が付きます(あとから追加した要素にも付く)。
- 辞書: `ruby-dict-src.txt`(手で書いた辞書、1行「語 よみ」)と `ruby-dict-auto.txt`(自動推定)から `python3 build/build-ruby-dict.py`(A-materials で実行)で `ruby-dict.js` を作ります。
  `python3 build/build-ruby-dict.py --scan` は全アプリの文章を読み、辞書にない語の読みを推定して足します(共通基盤スレッドがときどき実行)。
  読みのまちがいを見つけたら、正しい読みを `ruby-dict-src.txt` に書けば上書きされます。
  共有辞書に足したい語は共通基盤スレッドへ。アプリだけで使う語は `G.ruby.add({'等角図':'とうかくず'})` で追加できます。
- 個別に指定: 本文に `{柾目|まさめ}` と書く。
- ルビを付けない: 要素に `data-noruby`。input / textarea / select / option / svg / canvas / code には付きません。
- ルビ入りの要素から文字だけ取り出す: `G.ruby.plain(el)`(`textContent` だとふりがなも混ざる)。
- 表示の切り替えはヘッダーのボタン(`html.ruby-off` で `rt` を隠す)。
- `rt` には小さな負の字間(`letter-spacing: -.06em`)を付け、読みが長い語(材料 ざいりょう など)の前後のすき間を少しへらしている。

## 計算・データ

- `materials.js` → `G.materials`: 材料の目安値(E: GPa、density: g/cm³、strength: MPa)と出典文 `G.materials.source`。
- `beam.js` → `window.Beam`: 梁の計算(M3 スレッド作成。テスト `node --test beam.test.js`)。
  **`materials.js` を先に読み込む**(Beam.MATERIALS が共通の値になる)。単位は E が N/mm²(= GPa × 1000)。

## スタイル(base.css)

`card` / `btn`(`primary` `danger` `ghost` `small` `link`)/ `g-row` / `g-grid` / `g-cols` / `g-table` / `g-field` / `g-check` / `g-slider` / `badge`(`ok` `ng` `warn`)/ `g-note` / `g-muted` / `sr-only`。
色は `--ink` `--muted` `--line` `--accent` `--ok` `--ng` `--warn` `--wood` などのトークンを使ってください。
文字サイズは `rem` で書くと、ヘッダーの文字サイズ切り替えに追従します。

## オフライン

ルートの `sw.js` がメニューと `common/` を先にキャッシュし、各アプリの `G.initApp({files})` に書いたファイルを初回オープン時にキャッシュします。
一度開いたファイルは自動でキャッシュされるので、書き忘れても2回目以降は動きます。
配布物を更新したら、共通基盤スレッドに `sw.js` の VERSION を上げるよう伝えてください。

## 画面のデザイン(中学生向け・10インチ Chromebook)

- 基準の画面: 1280×800(1.25倍表示なら 1024×640)と 1024×600。どちらでも横スクロールなし。
- さわる部分は高さ 44px 以上(`--tap`)。タブは 48px。チェックボックス・ラジオは 24px 以上。スライダーのつまみは 28px。
- 文字の基本は 17px(ヘッダーの「文字」で 15/20/24px)。サイズは rem で書く。
- ヘッダーとタブはスクロールしても上に残る(タブは `.g-tablist`)。大きな図は `max-height: calc(100vh - 190px)` くらいにして、1画面に収める。
- 画面の高さが 680px 以下のときは、共通 CSS が余白を自動でつめる。
- ルビを自前で付けるアプリは、flex の中で文字がばらけないよう `gap: 0` にするか、1つの要素に包む。

## 1ファイル版

A-materials で `python3 build/build-single.py` を実行すると、各ページの CSS・JS を中に入れて1つの HTML `dist/材料と加工_教材アプリ.html` にします(出力先は引数で変えられます)。
各ページは iframe(srcdoc)で開き、`../index.html` などのリンクは親ページ(`window.GSingle`)が付けかえます。`G.single` があれば1ファイル版の中です(Service Worker は使わない)。
新しいページやファイルを足したら、`build/build-single.py` の `PAGES` を直してください。実行時に別ファイルを fetch するしくみは1ファイル版では動きません。

## 変更の記録

- 2026-10-14(中学生目線レビューの改善): `G.psCycle` に「▶ = このアプリでとりくむ段階」の説明を追加(呼び出し方は同じ。スタイルは `.g-ps .g-ps-note`)。`rt` に小さな負の字間。
  メニュー: 先生用ビューアと使い方はページ下の折りたたみ「先生用」へ、全データの削除は「保存したデータ」内の折りたたみ「データの管理(削除)」へ移動。カード題名は「・」ごとにまとめて折り返す(1文字だけ次の行に落ちない)。ボタン名を「すべてファイルに書き出す」「ファイルから読み込む」に。
- 2026-10-15(第2.1版 4分野共通の枠): 各ページで `../../shared/eduit-frame.css`(base.css より先)・`../eduit-info.js`・`EDUIT_INFO.app = {name}`・`../../shared/eduit-frame.js` を読む。
  base.css の `--bg` `--panel` `--ink` `--muted` `--line` などは `--ef-*` に合わせ、ヘッダー・主なボタン(`.btn.primary`)・タブの選択中は分野の色 `--frame`(木の茶)。`--accent`(図や強調の青)は各アプリの中身のまま。
  作成者の表示は共通のフッターに1つだけ(旧 `.g-footer` のクレジットは、共通の枠が読めないときの予備)。版と更新履歴は `A-materials/eduit-info.js` に書く。
