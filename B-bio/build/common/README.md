# 共通部品(B1〜B6・メニュー用)

各教材の **kzConfirm の `<script>` のすぐ後ろ** に、下のファイルの中身をそのまま貼る(順番: kz-embed → kz-ruby → kz-print)。
どれも ES5・外部通信なし・file:// で動く。2回入れても害はない。くわしい API は各ファイルの先頭のコメントにある。

| ファイル | グローバル | すること |
|---|---|---|
| kz-embed.html | — | 教材集(メニュー)の iframe の中なら `<html class="kz-embed">` を付ける(K3)。site/build.py が中の `embed = window.self !== window.top;` を書きかえるので、この書き方を変えない |
| kz-ruby.html | `kzRuby` | 用語辞書(301語)で自動ルビ(K8)。`kzRuby(root, {skip})` は描画のたびによんでよい(二重にならない)。`kzRuby.str(html)` は文字列版、`kzRuby.plain(html)` はテキスト書き出し用にルビとタグを取る。`kzRuby.add([[語,よみ]])` で教材だけの語を追加 |
| kz-print.html | `kzPrintText` | 印刷で textarea の文章を切らない(K5)。描画のあとに `kzPrintText(root)`、JS で値を変えたら `kzPrintText.sync()` |
| kz-ruby-dict.json | — | 辞書と同じ内容。B1 は自分の RUBY の読みをこれにそろえる(「分げつ」は `[['分','ぶん'],'げつ']`) |
| dict-src.txt / build-dict.js | — | 辞書の元。`node build-dict.js` で json と kz-ruby.html の辞書を作り直す |

## 表示の設定(ふりがな・文字の大きさ・くっきり)
- 4分野で共通の `EduitFrame.prefs`(shared/eduit-frame.js)を使う。覚える場所は `localStorage['eduit.prefs']` の1つで、どの教材で変えても全教材に効く(2026-10 段4 で kzPrefs・hub_ruby・hub_fs をやめた)。
- 見出しのボタンは `<button type="button" data-ef-pref="ruby">ふりがな</button>`・`data-ef-pref="fs"`・`data-ef-pref="kukkiri"` を置いて `EduitFrame.prefs.mount()` を呼ぶだけ。ON の形・文字の大きさ(小・中・大・特大 = 15・17・20・24px)は共通。
- ふりがなを隠す(`<html data-ef-ruby="off">` で rt を消す)と `<html>` の字の大きさは eduit-frame がする。教材の字は rem・em で書く。
- 大きさが変わったときにグラフをかき直すなどは `EduitFrame.prefs.on(function (key, value) {…})`。

## 見た目(段4 でそろえた)
- 色は共通の `--ef-…`、図の色は教材の `<style>` のいちばん上の `:root` に `--fig-…` で書く。JS がはかった高さなどは `--app-…`。
- 箱は `.ef-box`、注意は `.ef-note.is-warn / .is-ok / .is-ng / .is-info`、ラベルは `.ef-tag`、ボタンは `.ef-btn`(小さいのは `.is-s`、消すのは `.is-danger`)、いちばん大事な操作は `.ef-btn-primary`(黒)。
- 切りかえの ON はぬらずに、下に分野の色の線(`box-shadow: inset 0 calc(-1 * var(--ef-mark)) 0 var(--ef-accent)`)。
- `python3 shared/style-check.py B-bio` が 0 件であること。

## K3 メニューの中(`html.kz-embed`)
- 教材の大きな見出し行と、ふりがな・A−・A＋ のボタンを隠す(メニューの上の帯に同じボタンがある)。
- B4 だけは名前(プロフィール)ボタンを、右よせの細い行(高さ48px以下)に残す。
- タブの帯はそのまま、いちばん上に来る。

## K4 タブの見た目
- 4分野共通の `.ef-apptabs`・`.ef-apptab`(字＋下線)。B1〜B3 は学ぶ中身のタブに「① そだてる」のように丸数字＋名前。

## K6 確認ダイアログ
- 見た目(`.kzd-…`)は B1〜B6・メニューに同じものが入っている。色・字は共通の `--ef-…`。直すときは7か所とも同じに直す。
- 消える操作はすべて `kzConfirm(文, {ok:'消す', danger:true})`。文に「何が消えるか」を書く。confirm/alert/prompt は使わない。

## K7 振り返りの形
- 先頭に「組」「番号」「名前」の3つの欄。
- 自己評価は「◎ よくできた / ○ できた / △ もう少し」。(B4 の★は 5→◎、3〜4→○、1〜2→△ に変換)
- 本文は入力のたびに自動保存し、「最後に保存 hh:mm」を表示する。

## K9 振り返りの書きぐあい
- 振り返りタブの **記述の問い(自由に書く欄)** のうち、空白以外の文字がある数を `filled`、問いの数を `total` とする(組・番号・名前・自己評価は数えない)。
- 保存のたびに `localStorage['b1_reflstat'…'b4_reflstat'] = JSON.stringify({filled:n, total:m})`。
- メニューは filled==total →「✅ 書いた」、0<filled<total →「📝 書きかけ」、0 →「✏️ まだ」。
