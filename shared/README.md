# shared/ 4分野共通の枠

4分野(A 材料と加工・B 生物育成・C エネルギー変換・D 情報)のすべてのアプリで、見た目の「枠」と、
作成者・安全と個人情報・ライセンス・更新履歴の表示をそろえるための部品です。

| ファイル | 中身 |
|---|---|
| `eduit-frame.css` | 共通の色・文字・ヘッダー・ボタン・カード・フッター・ダイアログ |
| `eduit-guide.css` | 先生用ガイド(各分野の `docs/先生用ガイド.html` など)の共通の見た目。章立ては下の「先生用ガイドの形」 |
| `eduit-frame.js`  | 自習モードの「自習ガイド」(下の「自習モード」)、フッター(作成者・版・「安全と個人情報・ライセンス・更新履歴」)と「このアプリについて」ダイアログ、メニューの「基本編」「発展編」のタブ(`EduitFrame.levels`)、メニューのカード(`EduitFrame.card`)、記号の印(`EduitFrame.code`)、メニューの上のバーの名前(`EduitFrame.menuTitle`) |
| `style-check.py` | 見た目の点検の道具。教材の CSS に、決まりにない色の値・角丸・影・フォントの指定・`!important`・古い色の名前・px の文字の大きさがないかを、ファイル名と行番号つきで出す(下の「見た目の点検と撮影」) |
| `tools/shots.js` | 撮影の道具。生徒に配る統一版のメニューと全教材を、PC とスマホのはばで撮る(下の「見た目の点検と撮影」) |
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

**見た目は「教科書の目次」(案1, 2026-10-24)**: 白地・黒の細い線・角なし・影なし・絵文字なし。色は分野の色を、記号(A1 など)・開いているタブの下線・ON のボタンの下線にだけ使う。
新しい教材も角丸(`border-radius`)と落ちる影(`box-shadow`)を使わない(丸い点・つまみなど、もとから丸いものは別)。
- **絵文字を出さない**: `eduit-frame.js` が、ボタン・見出し・文についた絵文字を画面に出る前にとる(✅ → ✓、⭕ → ○、❌ → × のように字の記号にできるものは字の記号にする)。
  まわりに字のない絵文字(部品の絵・盤面の絵など)はそのまま。絵として残したい所は `data-ef-emoji` を付ける。SVG の中・入力欄の中は変えない。
  教材のソースに絵文字を書いても画面には出ないが、新しく書くときは字だけにする。

- 色は `<html data-ef-domain="A|B|C|D|G|T|M|F|Z">` で分野の色になる(`EDUIT_INFO.domain` があれば自動)。
  A 木の茶 `#985a26` / B 緑 `#2e7d32` / C だいだい `#b45309` / D 青 `#1a5fc8` / G(技術分野のガイダンス、`G-guidance/`)青緑 `#0f766e`。
  `T-textbook/` の T(教科書の順に進む学習コース)灰青 `#475569` / M(身の回りの技術さがし)赤紫 `#9d174d` / F(これからの技術ラボ)あい色 `#4338ca` / Z(学習を終えて)こげ茶 `#7c4a03`。
- 画面の地 `--ef-bg`、カード・ヘッダーは白、枠線 `--ef-line`、文字 `--ef-text`、フォント `--ef-font`。
- **記号**: 4分野とも分野の文字 + 番号(A1〜A8・B1〜B6・C1〜C8・D1〜D11)。番号の順 = おすすめの順 = メニューのカードの順。分野に入らないガイダンスは番号なしの `G`(自習ガイドも `jishu.apps.G`)。分野をまたぐ `T-textbook/` の教材も番号なしの `M`・`F`・`Z`。
  画面では `EduitFrame.code('A2')`(`<span class="ef-code">A2</span>`、分野の色の小さな印)で出す。
- **メニューの上のバー** `.ef-header`: 左に `EduitFrame.menuTitle(h1)` の「[A] 材料と加工の技術 教材集」。
  右の道具は4分野とも「ふりがな → 文字 中 → 使い方 → 先生用」の4つだけで、字だけ(絵文字なし)・同じ大きさ(名前 18px・ボタンの高さ 40px、スマホは 16px・36px)。
  くっきり・全画面・教材の切りかえボタンは、アプリを開いたときの上のバーにだけ出す。「使い方」の画面がない分野は `EduitFrame.howto(本文の HTML)` のダイアログを使う。「先生用」はその分野の先生用のところへ移る。
- **アプリの上のバー** `.ef-header.ef-appbar`(C エネルギー変換の形。A・B・D・G・T もこれにそろえる): 白地・下に黒の細い線(1px)。
  左から「◀ メニュー」(`.ef-btn.ef-back`)→ 同じ分野の教材の切りかえ(`nav.ef-switch` に `.ef-swchip` をならべる。記号の印＋短い名前 `.ef-sw-n`。開いている教材は `aria-current="page"` で分野の色の下線)→ 右寄せの道具(`.ef-tools`)。
  道具の並びは「ふりがな → 文字の大きさ → くっきり → そのアプリだけのボタン → 全画面 → ⓘ このアプリについて」。全画面は `<span data-ef-fs></span>`、このアプリについては `<span data-ef-about></span>` を置くと `EduitFrame.mount()` がボタンにする。
  アプリ名(`.ef-apptitle`)は、はば1441px以上とスマホだけ出す。1440px以下ではほかの教材の名前をかくし(記号だけ)、1180px以下で「このアプリについて」、900px以下で「全画面」の字をかくす。スマホでは全画面のボタンを出さず、バーを2段にする。
- **メニューの下の部分**: 基本編・発展編(カード)→ 記録(書き出し・データの管理)→ 先生用、の順。
- **表示の道具**(4分野で同じ形): ふりがな・くっきりは `.ef-btn.ef-toggle`(`aria-pressed="true"` で下に分野の色の線が付き、✓ が付く)。
  文字の大きさは「文字 中」の1つのボタン `.ef-btn.ef-size`。段が3つ以上なら `EduitFrame.sizeButton(btn, { steps, get, set })`(押すたびに次の段へ)、
  「中・大」の2段だけなら `<button class="ef-btn ef-size" aria-pressed>文字 <span class="ef-size-v"></span></button>`(「中」「大」は CSS が出す)。
- **明るい画面だけ**: `eduit-frame.css` は `color-scheme: light`。端末がダークモードでも黒い画面にはしない(分野ごとの CSS にもダークモードの指定を書かない)。
- **スマホ(幅 640px 以下)**: 上のバーは名前を1行目に、道具は入りきらなければ次の行へ(`.ef-title` は 9em 以上の幅を取る)。
  横に長い表や道具の帯は、その部分だけ横にスクロールさせ、ページ全体が横にはみ出さないようにする。
- **アプリの中のタブの帯** `.ef-apptabs`(ボタンは `.ef-apptab`): 白い帯・下に黒の細い線・字だけのタブ(高さ44px・太字)。開いているタブ(`aria-selected` / `aria-current` / `.is-on`)は下に分野の色の線(4px)。上に固定(`position: sticky`)し、`data-ef-autohide` を付ける。下へ読み進めると隠れ、上へ戻すと出る(`eduit-frame.js`)。
  スマホではタブの名前を折り返さず(`white-space: nowrap`)、帯を1行にして横にスクロールさせる。
- **ボタン** `.ef-btn`(白地・黒の細い枠・角なし)、ON は `.is-on` か `aria-pressed="true"`(下に分野の色の線)。いちばん大事な操作は `.ef-btn-primary`(黒地に白い字)。
- **メニュー** `main.ef-menu`(はば 1040px まで・真ん中): タブ(基本編・発展編。字と下線)のすぐ下に、教材を1行ずつならべた一覧 `.ef-mgrid`(教科書の目次の形。章の見出しの下は黒の線、行の間は細い線)。
- **メニューのカード**: `EduitFrame.card({ code, icon, title, desc, parts, extra, href か onOpen, openAttrs })` で作る(`.ef-card.ef-mcard`)。
  1行の中は、左に記号(分野の色の太い字)、まん中に名前・説明・使うところ・追加の欄(extra: B の目安時間・振り返りの印、C のタグ・進み具合 など)、右に「ひらく ▶」。アイコン(icon)は出さない。行のどこを押しても開く。
- **フッター**: 画面の下に「作成: 技術 岡田 ・ 第◯版 ・ 安全と個人情報・ライセンス・更新履歴」。
  画面いっぱいを使うアプリは、ヘッダーの道具に `<span data-ef-about></span>` を置くと「ⓘ このアプリについて」ボタンになる。

## 見た目の点検と撮影

見た目を直すときは、直す前と後に次の2つを使う。

- **点検** `python3 shared/style-check.py`(`--sum` でファイルごとの数、`--only color,radius` で種類をしぼる、フォルダを書けばそこだけ、`--strict` で1件でもあれば終了コード 1)。
  色・文字・余白・線の値は `eduit-frame.css` のいちばん上にだけ書き、教材は `--ef-…` の名前と共通の部品を使う、という決まりに合わない所を出す。
  図の色は、教材の CSS のいちばん上で `--fig-…` の名前を付けて書けば出ない。本物に似せた画面など決まりの外にしたい所は `/* style-check: off */` 〜 `/* style-check: on */` ではさむ。
- **撮影** `node shared/tools/shots.js <出す先のフォルダ> [A B C D G T M F Z] [--pc|--sp]`。
  `クラスルーム配布/生徒に配る/` の統一版を開き、メニューと全教材(開いた画面と、2つ目のタブの画面)を PC(1280×800)とスマホ(390×844)で撮る。
  スマホでページ全体が横にはみ出している教材があれば、そのはば(px)を出す。先に各分野の作り直しのコマンドで配布用のファイルを作っておく。

## 振り返りを隠す設定

先生が振り返りを Google フォームなど別の方法で集めるときのために、教材の中の振り返りを出さないようにできます(既定は出す)。

- `eduit-frame.js` が設定を読み、隠すときは `<html data-ef-furikaeri="off">` にして `EduitFrame.furikaeri = false` にします。
  決め方(先のものが勝つ): アドレスの `?furikaeri=off|on`(自分か、同じサイトの親の画面。localStorage `eduit.furikaeri` に覚える)→ `window.EDUIT_FURIKAERI = 'off'|'on'`(自分か親の画面)→ localStorage `eduit.furikaeri`。
- 振り返りのタブ・欄・カードの印などには **`data-ef-reflect`** を付けます。隠す設定のとき `eduit-frame.css` が出さなくします。
- 振り返りを書かないと先へ進めない・前に開いていたタブが振り返り、のように JS で決めているところは `EduitFrame.furikaeri` を見て、隠すときは振り返りをとばします。
- `クラスルーム配布/まとめる.py` は、生徒に配るファイルの `<head>` のすぐあとに `window.EDUIT_FURIKAERI = 'off'` を入れた版を `生徒に配る/振り返りなし/` に作ります。

## 自習モード(自習ガイド)

先生の説明なしで1人で進めるときのための表示です(既定は切)。決め方は振り返りと同じで、アドレスの `?jishu=on|off`(localStorage `eduit.jishu` に覚える)→ `window.EDUIT_JISHU = 'on'` → localStorage。入っているときは `<html data-ef-jishu="on">`、`EduitFrame.jishu = true` になります。

- アプリ: `eduit-frame.js` が、アプリ名(`EDUIT_INFO.app.name` の先頭の「A3」など)の記号で `EDUIT_INFO.jishu.apps[記号]` を探し、あれば右はしに「自習ガイド」のボタン(`.ef-jishu-fab`)とパネル(`.ef-jishu`。スマホは下から出る)を出す。まわりを暗くしないので、教材を操作しながら読める。はじめて開いた教材ではパネルを開いておく。
- 1つのページの中でアプリを切りかえる教材集(C)は、開いたときに `EduitFrame.jishuApp('C4', 'C4 電気回路ラボ')`、メニューなどにもどったら `EduitFrame.jishuApp(null)` を呼ぶ。
- メニュー: `EduitFrame.levels` に `code` を渡していれば、基本編の上に進め方の説明、カードに「自習 進め方 3/6・たしかめ 2/3」(全部できたら「✓ クリア」)を出す。
- データ(各分野の `eduit-info.js` の `window.EDUIT_INFO.jishu = { lead, apps: { A1: {…}, … } }`):
  `goal`(ねらい)・`time`(時間の目安)・`steps`(`where` 画面のタブの名前 / `do` やること / `hint` ヒント / `go` 「この場所へ」の行き先: `#` で始まれば location.hash、ほかは click する CSS セレクタ / `level: 'advanced'` 発展にまとめる / `reflect: true` 振り返りを隠す設定のとき出さない)・`check`(`q`・`choices`・`answer` 0からの正解の番号・`explain`)。
  `where` は `levels` の `parts` と同じ番号・名前にそろえる。タブの名前やセレクタを変えたら、ここも直す。
- できた印と答えは localStorage `eduit.jishu.v1.<記号>`(書き出すファイルには入らない)。
- ふりがな: パネルの文には、`EDUIT_INFO.jishu.ruby`(言葉 → 読み)で長い言葉から順にふりがなを付ける(言葉の中のかなには付けない)。パネルの「ふりがな」ボタンで消せる(はじめは付いている。localStorage `eduit.jishu.ruby`)。教材のふりがなのオン・オフとは別。
  `jishu.ruby` は `python3 shared/jishu-ruby.py` が形態素解析(Sudachi。`python3 -m pip install sudachipy sudachidict_core`)で作り、各 `eduit-info.js` のいちばん下に書きこむ。**jishu の文を直したら実行しなおす**(読みのまちがいは、そのスクリプトの `OVERRIDES`・`ACCEPT` で直す)。自習ワークシートも同じ表を使う。
- 文の書き方: 1つの手順に文が2つ以上あると、パネルでは文ごとに行を分ける。読むのが苦手な生徒のために、1つの文は短く(50字くらいまで)、1つの文でしてほしいことは1つにする。
- `クラスルーム配布/まとめる.py` は、`<head>` のすぐあとに `window.EDUIT_JISHU = 'on'` を入れた版を `生徒に配る/自習用/` に作る。生徒用サイトの入口ページには自習モードの切りかえボタンがある。

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
