# 倉庫(いまは使わない教材・タブ)

教科書との照らし合わせ(2026-10-23)で、配布・メニュー・生徒用サイトから外したものを置いています。
消さずに残してあるので、必要になったらもどせます。
ここにあるファイルは、どのビルド(各分野の build・`クラスルーム配布/まとめる.py`・`site/build.py`)も読みません。

## 入っているもの

| 場所 | もとの場所 | 外した理由 |
|---|---|---|
| `D4_情報セキュリティ体験ラボ/modules/digital.js`・`js/digitallib.js` | D4 の ① デジタル化と情報量 | D2 デジタル化ラボと同じ内容(D2 のほうがくわしい) |
| `D4_情報セキュリティ体験ラボ/modules/network.js` | D4 の ⑤ ネットワーク通信の模擬 | D3 ネットワーク通信シミュレータの ④ のぞき見と暗号化と同じ内容 |
| `D4_情報セキュリティ体験ラボ/modules/hash.js` | D4 の ⑪ ハッシュ体験(発展) | D10 ハッシュ化体験ラボと同じ内容(D10 のほうがくわしいので、D10 を発展編に残した) |
| `D4_情報セキュリティ体験ラボ/data/quiz.json` | D4 の `data/quiz.json` | 上の3つのモジュールの理解度チェックの問題(10問) |
| `D4_情報セキュリティ体験ラボ/catalog-の行.txt` | D4 の `js/catalog.js` | 上の3つのモジュールの import・CATALOG・EASY_STEPS の行 |

## もどし方(D4 のモジュール)

1. `modules/`・`js/` のファイルを `D-information/security-lab/` の同じ場所にもどす。
2. `catalog-の行.txt` の行を `js/catalog.js` にもどす(import・CATALOG の行・EASY_STEPS)。GROUPS に `digital`(情報のデジタル化と情報量)・`advanced`(発展)のグループも足し、CATALOG の `num` を付け直す。
3. `data/quiz.json` の問題を `security-lab/data/quiz.json` の questions に足し、`data/config.json` の enabledModules にモジュールの id を足す。
4. `tools/build-standalone.mjs` の ORDER と `sw.js` の FILES にファイルを足す。
5. `D-information/eduit-info.js`(levels・jishu)、`kyozai-shu/data/materials.json`(recordNames)、`T-textbook/course-data.js` のタブの番号を直す。
6. テストは、外したときのコミットより前の `security-lab/tests/` にある(git の履歴で見られる)。
