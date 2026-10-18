# shared/ 4分野共通の枠

4分野(A 材料と加工・B 生物育成・C エネルギー変換・D 情報)のすべてのアプリで、見た目の「枠」と、
作成者・安全と個人情報・ライセンス・更新履歴の表示をそろえるための部品です。

| ファイル | 中身 |
|---|---|
| `eduit-frame.css` | 共通の色・文字・ヘッダー・ボタン・カード・フッター・ダイアログ |
| `eduit-guide.css` | 先生用ガイド(各分野の `docs/先生用ガイド.html` など)の共通の見た目。章立ては下の「先生用ガイドの形」 |
| `eduit-frame.js`  | フッター(作成者・版・「安全と個人情報・ライセンス・更新履歴」)と「このアプリについて」ダイアログ、メニューの「基本編」「発展編」のタブ(`EduitFrame.levels`)、メニューのカード(`EduitFrame.card`)、記号の印(`EduitFrame.code`)、メニューの上のバーの名前(`EduitFrame.menuTitle`) |
| `mondai-note/` | 4分野で同じ教材「問題解決ノート」の本体(`mondai-note.js` 画面と計算・`mondai-note-data.js` 分野ごとの例と観点・`mondai-note.css` 見た目・`mondai-note.test.js` テスト)。下の「問題解決ノート」 |

分野ごとの版と更新履歴は、各分野の `eduit-info.js`(`window.EDUIT_INFO`)に書きます。
安全の説明とライセンスの文は `eduit-frame.js` にあり、全分野で同じです。

## 読み込み方

```html
<link rel="stylesheet" href="../../shared/eduit-frame.css">
<script src="../eduit-info.js"></script>          <!-- 分野ごと: window.EDUIT_INFO -->
<script>EDUIT_INFO.app = { name: 'A3 構造強化ラボ' };</script>  <!-- アプリ名(なければ教材集の名前) -->
<script src="../../shared/eduit-frame.js"></script>
```

1ファイル版を作るビルドでは、この3つを `<style>` / `<script>` として中に入れます(外部ファイルを読まない)。

## 枠の決まり

- 色は `<html data-ef-domain="A|B|C|D">` で分野の色になる(`EDUIT_INFO.domain` があれば自動)。
  A 木の茶 `#985a26` / B 緑 `#2e7d32` / C だいだい `#b45309` / D 青 `#1a5fc8`。
- 画面の地 `--ef-bg`、カード・ヘッダーは白、枠線 `--ef-line`、文字 `--ef-text`、フォント `--ef-font`。
- **記号**: 4分野とも分野の文字 + 番号(A1〜A8・B1〜B6・C1〜C8・D1〜D9)。番号の順 = おすすめの順 = メニューのカードの順。
  画面では `EduitFrame.code('A2')`(`<span class="ef-code">A2</span>`、分野の色の小さな印)で出す。
- **メニューの上のバー** `.ef-header`: 左に `EduitFrame.menuTitle(h1)` の「[A] 材料と加工の技術 教材集」。
  右の道具は「ふりがな → 文字の大きさ → (くっきり) → 使い方 → 先生用」。その分野にない機能のボタンは出さない。「先生用」はメニューの下の先生用のところへ移る。
- **アプリの上のバー** `.ef-header`: 白地・下に分野の色の線(3px)。左から「◀ メニュー」(`.ef-btn.ef-back`)→ 記号の印とアプリ名(`.ef-title`、「[A2] 木材の繊維・収縮ラボ」)→ 右寄せの道具(`.ef-tools`)。
  道具の並びは「ふりがな → 文字の大きさ → くっきり → 使い方 → そのアプリだけのボタン」。同じ分野の教材を切りかえるボタンにも記号を出す(「[D2] CPU」)。
- **メニューの下の部分**: 基本編・発展編(カード)→ 記録(書き出し・データの管理)→ 先生用、の順。
- **表示の道具**(4分野で同じ形): ふりがな・くっきりは `.ef-btn.ef-toggle`(`aria-pressed="true"` で分野の色に塗り、✓ が付く)。
  文字の大きさは「文字 中」の1つのボタン `.ef-btn.ef-size`。段が3つ以上なら `EduitFrame.sizeButton(btn, { steps, get, set })`(押すたびに次の段へ)、
  「中・大」の2段だけなら `<button class="ef-btn ef-size" aria-pressed>文字 <span class="ef-size-v"></span></button>`(「中」「大」は CSS が出す)。
- **明るい画面だけ**: `eduit-frame.css` は `color-scheme: light`。端末がダークモードでも黒い画面にはしない(分野ごとの CSS にもダークモードの指定を書かない)。
- **スマホ(幅 640px 以下)**: 上のバーは名前を1行目に、道具は入りきらなければ次の行へ(`.ef-title` は 9em 以上の幅を取る)。
  横に長い表や道具の帯は、その部分だけ横にスクロールさせ、ページ全体が横にはみ出さないようにする。
- **アプリの中のタブの帯**: 上に固定(`position: sticky`)し、`data-ef-autohide` を付ける。下へ読み進めると隠れ、上へ戻すと出る(`eduit-frame.js`)。
  スマホではタブの名前を折り返さず(`white-space: nowrap`)、帯を1行にして横にスクロールさせる。
- **ボタン** `.ef-btn`(白地・丸い枠)、ON は `.is-on` か `aria-pressed="true"`(分野の色で塗る)。いちばん大事な操作は `.ef-btn-primary`。
- **メニューのカード**: `EduitFrame.card({ code, icon, title, desc, parts, extra, href か onOpen, openAttrs })` で作る(`.ef-card.ef-mcard`)。
  記号・アイコン・名前・説明・使うところ・追加の欄(extra: B の目安時間・振り返りの印、C のタグ・進み具合 など)・「ひらく ▶」の順。カードのどこを押しても開く。
- **フッター**: 画面の下に「作成: 羽生市立南中学校 技術 岡田 ・ 第◯版 ・ 安全と個人情報・ライセンス・更新履歴」。
  画面いっぱいを使うアプリは、ヘッダーの道具に `<span data-ef-about></span>` を置くと「ⓘ このアプリについて」ボタンになる。

## 振り返りを隠す設定

先生が振り返りを Google フォームなど別の方法で集めるときのために、教材の中の振り返りを出さないようにできます(既定は出す)。

- `eduit-frame.js` が設定を読み、隠すときは `<html data-ef-furikaeri="off">` にして `EduitFrame.furikaeri = false` にします。
  決め方(先のものが勝つ): アドレスの `?furikaeri=off|on`(自分か、同じサイトの親の画面。localStorage `eduit.furikaeri` に覚える)→ `window.EDUIT_FURIKAERI = 'off'|'on'`(自分か親の画面)→ localStorage `eduit.furikaeri`。
- 振り返りのタブ・欄・カードの印などには **`data-ef-reflect`** を付けます。隠す設定のとき `eduit-frame.css` が出さなくします。
- 振り返りを書かないと先へ進めない・前に開いていたタブが振り返り、のように JS で決めているところは `EduitFrame.furikaeri` を見て、隠すときは振り返りをとばします。
- `クラスルーム配布/まとめる.py` は、生徒に配るファイルの `<head>` のすぐあとに `window.EDUIT_FURIKAERI = 'off'` を入れた版を `生徒に配る/振り返りなし/` に作ります。

## 基本編・発展編のタブ(メニュー用)

`EduitFrame.levels(置き場所, { card: function (item, parts, levelKey) { return カードの要素; }, gridClass, onRender })` で、
`EDUIT_INFO.levels`(各分野の `eduit-info.js`)の分け方どおりに「基本編」「発展編」のタブとカードの並びを作ります。
カードは `EduitFrame.card` で作り、`parts`(「使うところ」の要素)を渡します。`code: function (item) { return 'A1'; }` を渡すと、基本編の上に「おすすめの順番: A1 → A2 → …」の1行が出ます。選んだ編は localStorage `eduit.level.<分野>` に覚えます。

アプリの中のタブ・ページは「基本のタブ → 発展のタブ」の順にならべ、①②③…の続き番号にします(「はじめに」「振り返り」「記録」は番号なし、振り返り・記録はいつも最後)。`levels` の `parts` にも同じ番号で書きます。
分け方の一覧(先生用)は `teacher-tools/kihon-hatten/` が作ります。

## 先生用ガイドの形

各分野の先生用ガイドは、名前・章立て・見た目を4分野でそろえています。新しく書くときや直すときも、この形にします。

- 元のファイル: A `A-materials/docs/先生用ガイド.html`・B `B-bio/docs/先生用ガイド.html`・C `C-energy/build/help.py`(`build.py` が `docs/先生用ガイド.html` を作る)・D `D-information/docs/先生用ガイド.html` と `D-information/docs/情報セキュリティ体験ラボ_先生用ガイド.html`
- 配布用フォルダでの名前: `X_分野名_先生用ガイド.html`(`クラスルーム配布/まとめる.py` がコピーする)
- 読み込み: `eduit-frame.css` → `eduit-guide.css` → `eduit-info.js` → `EDUIT_INFO.app = { name: '先生用ガイド(〇〇の技術)' }` → `eduit-frame.js`
- `<title>先生用ガイド | 〇〇の技術</title>`、上のバーの題名は「先生用ガイド」、見出しは「〇〇の技術 先生用ガイド」
- 章は次の7つ(`<section class="eg-sec">` と `<h2>`)で、この順・この名前にする:
  1. 配り方と開き方 2. 教材の一覧(基本編・発展編) 3. 単元での使い方 4. 記録の保存と提出 5. 授業で使うときの注意 6. こまったとき 7. 更新履歴
- 部品のクラスは `eduit-guide.css` の先頭に書いてあります。

## 問題解決ノート(4分野で同じ教材) → `mondai-note/`

教科書の各編の2章「問題の発見と課題の設定」「問題解決の評価、改善・修正」と3章(D は4章)「技術の最適化」に合わせた教材です。
タブは「はじめに → ① 問題の発見 → ② 評価、改善・修正(ここまで基本編)→ ③ 技術の最適化(発展編)→ 振り返り → 記録」(`MondaiNote.TABS`)。

- 分野は `EDUIT_INFO.domain` で切りかえる。分野ごとの例(付箋のヒント・クイズ)・評価の観点・過程のチェック・最適化の製品(3つ × 3案、観点ごとの 1〜5 の目安の点、立場の重み、制約条件)は `mondai-note-data.js` の `MondaiNote.DOMAINS.A〜D` にある。
- 本体はタブの中身だけを作る。上のバー・タブの切りかえ・保存・ファイルの書き出しは、各分野のページ(アダプタ)が受け持つ:
  `MondaiNote.mount({ domain, data, panels: { intro, find, eval, opt, refl, rec }, onChange, go, recordTools, furikaeri })`。ノートの中身は `note.data`(形は `MondaiNote.defaults()`)。
- 印刷は「記録」の「印刷する」(または Ctrl+P)で、A4 の問題解決シート(`.mn-sheet`)だけを出す。書いていない欄は線だけになる。
- 振り返り一覧(`teacher-tools/furikaeri-ichiran/parse.js` の `mondaiRows`)は、ノートの中身から行を作る。B・C・D の書き出しの形でも、ノートの中身をこの関数に渡せばよい。
- A は `A-materials/a8-mondai-note/`(A8)。`build-single.py` が相対パスの `../../shared/mondai-note/*` をそのまま中に入れる。
- テスト: `node --test shared/mondai-note/mondai-note.test.js`(データがそろっているか・どの製品も重みを変えればどの案も1位になれるか)
