# D 情報の技術

中学校技術・家庭科（技術分野）D「情報の技術」の体験教材です。どれもインターネットにつながずに、ブラウザだけで動きます。

作成：羽生市立南中学校　技術　岡田

## 生徒に配るもの・先生が読むもの

- `dist/情報の技術_体験教材集.html` … 6つの教材をメニュー付きの1つのファイルにまとめたもの（生徒に配る）
- `dist/情報の技術_体験教材集_第1.5版.zip` … 配布用のまとめ（上のHTML、先生用の手引き2つ、個別の教材6つ、はじめにお読みください）
- `dist/生成AIのしくみラボ.html` … 生成AIのしくみラボの1ファイル版（教材集とは別に配る）
- `dist/ネット詐欺_追体験ラボ.html` … ネット詐欺 追体験ラボの1ファイル版（教材集とは別に配る）
- `dist/ハッシュ化体験ラボ.html` … ハッシュ化体験ラボの1ファイル版（教材集とは別に配る）
- `docs/先生用の手引き.html` … 教材集の使い方、学習指導要領との対応（画面の例は `docs/画面例/`）
- `docs/情報セキュリティ体験ラボ_先生用の手引き.html` … 情報セキュリティ体験ラボの詳しい手引き

## フォルダの地図

```
D-information/
├─ kyozai-shu/           体験教材集（6教材をまとめるメニュー）
├─ digitization-lab/     デジタル化ラボ
├─ virtual-cpu/          仮想CPUラボ
├─ network-sim/          ネットワーク通信シミュレータ
├─ security-lab/         情報セキュリティ体験ラボ
├─ interactive-studio/   双方向コンテンツ制作スタジオ
├─ measure-control-sim/  計測・制御シミュレータ
├─ genai-lab/            生成AIのしくみラボ
├─ scam-lab/             ネット詐欺 追体験ラボ
├─ hash-lab/             ハッシュ化体験ラボ
├─ eduit-info.js         情報の技術の版・更新履歴（4分野共通の枠が読む）
├─ dist/                 配布用の完成ファイル
├─ docs/                 先生用の文書
├─ build/                作る道具（eduit-inline.mjs：共通の枠を1ファイル版に入れる）
└─ review/               レビューと改善計画（計画/ に各教材の計画書）
```

各教材のフォルダには `index.html`・`js/`・`css/`・`tests/`・`tools/` と、1ファイル版の `dist/`（教材集を作るときの材料）があります。

## 作り直す順番

教材を直したら、次の順に作り直します（Node.js 20以上。ブラウザのテストには playwright が必要）。

```
# 1. 直した教材のフォルダで（例: security-lab）
npm test             # 点検
npm run build        # dist/ の1ファイル版を作る（genai-lab・scam-lab・hash-lab は ../dist/ の配布用も作る）

# 2. kyozai-shu で
node tools/build.mjs        # ../dist/情報の技術_体験教材集.html を作る
node tests/e2e.browser.cjs  # ブラウザで確認

# 3. kyozai-shu で（配布用ZIP）
python3 tools/make-zip.py   # ../dist/情報の技術_体験教材集_第1.5版.zip を作る
```

`kyozai-shu` は兄弟のフォルダ（`security-lab/` など）と `docs/` を読むので、`D-information/` の中はまとめて動かしてください。共通の枠は `../shared/` にあります。
