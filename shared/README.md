# shared/ 4分野共通の枠

4分野(A 材料と加工・B 生物育成・C エネルギー変換・D 情報)のすべてのアプリで、見た目の「枠」と、
作成者・安全と個人情報・ライセンス・更新履歴の表示をそろえるための部品です。

| ファイル | 中身 |
|---|---|
| `eduit-frame.css` | 共通の色・文字・ヘッダー・ボタン・カード・フッター・ダイアログ |
| `eduit-frame.js`  | フッター(作成者・版・「安全と個人情報・ライセンス・更新履歴」)と「このアプリについて」ダイアログ |

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
- **フッター**: 画面の下に「作成: 技術 岡田 ・ 第◯版 ・ 安全と個人情報・ライセンス・更新履歴」。
  画面いっぱいを使うアプリは、ヘッダーの道具に `<span data-ef-about></span>` を置くと「ⓘ このアプリについて」ボタンになる。
