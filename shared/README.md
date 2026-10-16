# shared/ 4分野共通の枠

4分野(A 材料と加工・B 生物育成・C エネルギー変換・D 情報)のすべてのアプリで、見た目の「枠」と、
作成者・安全と個人情報・ライセンス・更新履歴の表示をそろえるための部品です。

| ファイル | 中身 |
|---|---|
| `eduit-frame.css` | 共通の色・文字・ヘッダー・ボタン・カード・フッター・ダイアログ |
| `eduit-guide.css` | 先生用ガイド(各分野の `docs/先生用ガイド.html` など)の共通の見た目。章立ては下の「先生用ガイドの形」 |
| `eduit-frame.js`  | フッター(作成者・版・「安全と個人情報・ライセンス・更新履歴」)と「このアプリについて」ダイアログ、メニューの「基本編」「発展編」のタブ(`EduitFrame.levels`) |

分野ごとの版と更新履歴は、各分野の `eduit-info.js`(`window.EDUIT_INFO`)に書きます。
安全の説明とライセンスの文は `eduit-frame.js` にあり、全分野で同じです。

## 読み込み方

```html
<link rel="stylesheet" href="../../shared/eduit-frame.css">
<script src="../eduit-info.js"></script>          <!-- 分野ごと: window.EDUIT_INFO -->
<script>EDUIT_INFO.app = { name: 'M3 構造強化ラボ' };</script>  <!-- アプリ名(なければ教材集の名前) -->
<script src="../../shared/eduit-frame.js"></script>
```

1ファイル版を作るビルドでは、この3つを `<style>` / `<script>` として中に入れます(外部ファイルを読まない)。

## 枠の決まり

- 色は `<html data-ef-domain="A|B|C|D">` で分野の色になる(`EDUIT_INFO.domain` があれば自動)。
  A 木の茶 `#985a26` / B 緑 `#2e7d32` / C だいだい `#b45309` / D 青 `#1a5fc8`。
- 画面の地 `--ef-bg`、カード・ヘッダーは白、枠線 `--ef-line`、文字 `--ef-text`、フォント `--ef-font`。
- **ヘッダー** `.ef-header`: 白地・下に分野の色の線(3px)。左から「◀ メニュー」(`.ef-btn.ef-back`)→ アイコンとアプリ名(`.ef-title`)→ 右寄せの道具(`.ef-tools`)。
  道具の並びは「ふりがな → 文字の大きさ → くっきり → 使い方 → そのアプリだけのボタン」。
- **ボタン** `.ef-btn`(白地・丸い枠)、ON は `.is-on` か `aria-pressed="true"`(分野の色で塗る)。いちばん大事な操作は `.ef-btn-primary`。
- **メニューのカード** `.ef-card`(白・上に分野の色の線 4px・角丸 12px)、`.ef-card-tag`(M1 などの記号)、`.ef-card-title`。
- **フッター**: 画面の下に「作成: 羽生市立南中学校 技術 岡田 ・ 第◯版 ・ 安全と個人情報・ライセンス・更新履歴」。
  画面いっぱいを使うアプリは、ヘッダーの道具に `<span data-ef-about></span>` を置くと「ⓘ このアプリについて」ボタンになる。

## 基本編・発展編のタブ(メニュー用)

`EduitFrame.levels(置き場所, { card: function (item, parts, levelKey) { return カードの要素; }, gridClass, onRender })` で、
`EDUIT_INFO.levels`(各分野の `eduit-info.js`)の分け方どおりに「基本編」「発展編」のタブとカードの並びを作ります。
カードの形は各メニューが作り、`parts`(「使うところ」の要素)をカードの中に入れます。選んだ編は localStorage `eduit.level.<分野>` に覚えます。
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
