# 配布用ZIPを作る（先に node tools/build.mjs）。実行: python3 tools/make-zip.py  → ../dist/情報の技術_体験教材集_第1.6版.zip
# ZIPの中: 教材集の1ファイル版、先生用の手引き、はじめにお読みください、個別の教材9つ
import json, pathlib, zipfile

root = pathlib.Path(__file__).resolve().parent.parent
projects = root.parent
data = json.loads((root / "data/materials.json").read_text(encoding="utf-8"))
top = "情報の技術_体験教材集_第1.6版"
out = projects / "dist" / f"{top}.zip"
out.parent.mkdir(exist_ok=True)

readme = """情報の技術 体験教材集（第1.6版 2026年10月）
作成：羽生市立南中学校　技術　岡田

中学校技術・家庭科（技術分野）D「情報の技術」で使う9つの体験教材を、
「基本編」「発展編」に分けたメニュー付きの1つのファイルにまとめたものです。

■ 生徒に配るもの
  「情報の技術_体験教材集.html」1つだけです。
  ダブルクリックするとブラウザ（Edge・Chrome など）で開き、メニューの「基本編」「発展編」から教材を選べます。
  インストールもインターネット接続も不要です。
  Chromebook では、Google ドライブの画面で開くと「プレビュー」になり動きません。
  端末にダウンロードしてから「ファイル」アプリで開いてください（くわしくは先生用の手引き）。

■ 1つの教材だけを配りたいとき
  「個別の教材」フォルダの中のファイルを配ってください。中身は教材集と同じです。

■ 先生が読むもの
  「先生用の手引き.html」：教材集の使い方、収録教材と学習指導要領の対応、
  内容が重なっている単元の使い分け、記録の提出。
  「先生用の手引き_情報セキュリティ体験ラボ.html」：情報セキュリティ体験ラボの詳しい手引き。

■ 安全について
  ・外部のサイトには一切接続しません。
  ・学習の記録はその端末のブラウザの中だけに保存されます。
    提出は、メニューの「記録をまとめて書き出す」で9教材分を1つのファイルにできます。
    端末を共有する場合は、提出したあと、メニューの「はじめからやり直す」で消してください。
  ・登場する会社名・アドレスはすべて架空です。
  ・作成者・安全と個人情報・ライセンス（使ってよい条件）・更新履歴は、
    メニューや各教材のいちばん下の「安全と個人情報・ライセンス・更新履歴」で見られます。
"""

with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    z.writestr(f"{top}/はじめにお読みください.txt", "﻿" + readme.replace("\n", "\r\n"))
    z.write(projects / "dist/情報の技術_体験教材集.html", f"{top}/情報の技術_体験教材集.html")
    z.write(projects / "docs/先生用の手引き.html", f"{top}/先生用の手引き.html")
    z.write(projects / "docs/情報セキュリティ体験ラボ_先生用の手引き.html", f"{top}/先生用の手引き_情報セキュリティ体験ラボ.html")
    for m in data["materials"]:
        z.write(projects / m["source"], f"{top}/個別の教材/{m['title']}.html")
print(f"D-information/{out.relative_to(projects)} を作りました（{out.stat().st_size // 1024} KB）")
