# 共通部品(B1〜B4・メニュー用)

各教材の **kzConfirm の `<script>` のすぐ後ろ** に、下のファイルの中身をそのまま貼る(順番: kz-prefs → kz-ruby → kz-print)。
どれも ES5・外部通信なし・file:// で動く。2回入れても害はない。くわしい API は各ファイルの先頭のコメントにある。

| ファイル | グローバル | すること |
|---|---|---|
| kz-prefs.html | `kzPrefs` | ふりがな・文字の大きさの共通設定(K1)。`hub_ruby`('1'/'0')・`hub_fs`(14〜26、2きざみ、初期18)。`get()` `set({ruby,fs})` `on(fn)` `clampFs(n)` `bump(±1)` `bind(rubyBtn,decBtn,incBtn)` `embed`。iframe の中なら `<html class="kz-embed">` を付ける。ほかの画面の変更は storage イベント(予備に postMessage)で届く |
| kz-ruby.html | `kzRuby` | 用語辞書(298語)で自動ルビ(K8)。`kzRuby(root, {skip})` は描画のたびによんでよい(二重にならない)。`kzRuby.str(html)` は文字列版、`kzRuby.plain(html)` はテキスト書き出し用にルビとタグを取る。`kzRuby.add([[語,よみ]])` で教材だけの語を追加 |
| kz-print.html | `kzPrintText` | 印刷で textarea の文章を切らない(K5)。描画のあとに `kzPrintText(root)`、JS で値を変えたら `kzPrintText.sync()` |
| kz-ruby-dict.json | — | 辞書と同じ内容。B1 は自分の RUBY の読みをこれにそろえる(「分げつ」は `[['分','ぶん'],'げつ']`) |
| dict-src.txt / build-dict.js | — | 辞書の元。`node build-dict.js` で json と kz-ruby.html の辞書を作り直す |

## 設定の使い方(K1)
- 起動時: `p=kzPrefs.get()`。`p.ruby`/`p.fs` が null のときだけ、その教材の古い設定(b1_ruby / b2_settings / b3_state_v1.set / b4_store.settings)を使う。
- 切りかえたら `kzPrefs.set(...)`(古い設定にも書いてよい)。`kzPrefs.on(apply)` でほかの画面の変更を反映する。
- 文字の大きさは px の整数(14〜26)。B4 の「big」は 22 として読みかえる。

## K2 見出しのボタン(単体で開いたとき)
- 見出し(タイトル)の右に、この順で3つ:「ふりがな」「A−」「A＋」。文字は全角の「−」「＋」。
- どれも高さ・幅 44px 以上、角丸、同じ形。
- 「ふりがな」は `aria-pressed="true|false"`。オンのときは **白い塗り**(文字は濃い緑)、オフは枠だけ。
- 「A−」は 14px で、「A＋」は 26px で `disabled`(うすく表示)。`kzPrefs.bind()` を使うと自動でこうなる。

## K3 メニューの中(`html.kz-embed`)
- 教材の大きな見出し行と、ふりがな・A−・A＋ のボタンを隠す(メニューの上の帯に同じボタンがある)。
- B4 だけは名前(プロフィール)ボタンを、右よせの細い行(高さ48px以下)に残す。
- タブの帯はそのまま、いちばん上に来る。

## K4 タブの見た目
- タブの帯の背景 `#1b5e20`。選ばれていないタブは、背景なし(透明)・文字 `#e3f1e4`・太字。
- 選ばれているタブは、背景 = ページの地色 `#f4f7f1`、文字 `#1b5e20`、上の角を 12px の角丸。
- タブの高さ 52px 以上。
- B1〜B3 は「① はじめに」のように丸数字＋名前。B4 は絵文字アイコン＋名前(番号なし)。
- 文字を大きくしても、タブは折り返すか短い名前にする。横スクロールでかくさない。

## K6 確認ダイアログ
- 消える操作はすべて `kzConfirm(文, {ok:'消す', danger:true})`。文に「何が消えるか」を書く。confirm/alert/prompt は使わない。

## K7 振り返りの形
- 先頭に「組」「番号」「名前」の3つの欄。
- 自己評価は「◎ よくできた / ○ できた / △ もう少し」。(B4 の★は 5→◎、3〜4→○、1〜2→△ に変換)
- 本文は入力のたびに自動保存し、「最後に保存 hh:mm」を表示する。

## K9 振り返りの書きぐあい
- 振り返りタブの **記述の問い(自由に書く欄)** のうち、空白以外の文字がある数を `filled`、問いの数を `total` とする(組・番号・名前・自己評価は数えない)。
- 保存のたびに `localStorage['b1_reflstat'…'b4_reflstat'] = JSON.stringify({filled:n, total:m})`。
- メニューは filled==total →「✅ 書いた」、0<filled<total →「📝 書きかけ」、0 →「✏️ まだ」。
