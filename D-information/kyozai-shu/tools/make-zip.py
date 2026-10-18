# 配布用ZIPを作る（先に node tools/build.mjs）。実行: python3 tools/make-zip.py  → ../dist/情報の技術_体験教材集_第1.7版.zip
# ZIPの中: 教材集の1ファイル版、先生用ガイド2つ、はじめにお読みください、個別の教材11（D1_〜D11_ の名前）
# 先生用ガイドは共通の CSS・JS(../../shared/ と ../eduit-info.js)を読むので、中に入れてから ZIP に入れる
import json, pathlib, re, zipfile

root = pathlib.Path(__file__).resolve().parent.parent
projects = root.parent
data = json.loads((root / "data/materials.json").read_text(encoding="utf-8"))
top = "情報の技術_体験教材集_第1.7版"
out = projects / "dist" / f"{top}.zip"
out.parent.mkdir(exist_ok=True)

readme = """情報の技術 教材集（第1.7版 2026年10月）
作成：羽生市立南中学校　技術　岡田

中学校技術・家庭科（技術分野）D「情報の技術」で使う11の体験教材を、
「基本編」「発展編」に分けたメニュー付きの1つのファイルにまとめたものです。

■ 生徒に配るもの
  「情報の技術_体験教材集.html」1つだけです。
  ダブルクリックするとブラウザ（Edge・Chrome など）で開き、メニューの「基本編」「発展編」から教材を選べます。
  教材には D1〜D11 の記号が付いています。番号の順が、おすすめの順番です。
  インストールもインターネット接続も不要です。
  Chromebook では、Google ドライブの画面で開くと「プレビュー」になり動きません。
  端末にダウンロードしてから「ファイル」アプリで開いてください（くわしくは先生用ガイド）。

■ 1つの教材だけを配りたいとき
  「個別の教材」フォルダの中のファイルを配ってください。中身は教材集と同じです。

■ 先生が読むもの
  「先生用ガイド.html」：教材集の配り方と開き方、教材の一覧（基本編・発展編）、
  単元での使い方（内容が重なっている単元の使い分け）、記録の保存と提出。
  「先生用ガイド_情報セキュリティ体験ラボ.html」：情報セキュリティ体験ラボの詳しい先生用ガイド。

■ 安全について
  ・外部のサイトには一切接続しません。
  ・学習の記録はその端末のブラウザの中だけに保存されます。
    提出は、メニューの「記録をまとめて書き出す」で11教材分を1つのファイルにできます。
    端末を共有する場合は、提出したあと、メニューの「はじめからやり直す」で消してください。
  ・登場する会社名・アドレスはすべて架空です。
  ・作成者・安全と個人情報・ライセンス（使ってよい条件）・更新履歴は、
    メニューや各教材のいちばん下の「安全と個人情報・ライセンス・更新履歴」で見られます。
"""


def inline(src):
    """<link rel="stylesheet" href> と <script src> を、ファイルの中身に置きかえる(ZIP の中で1ファイルで開けるように)"""
    html = src.read_text(encoding="utf-8")

    def read(ref):
        return (src.parent / ref).resolve().read_text(encoding="utf-8")

    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">',
                  lambda m: "<style>\n" + read(m.group(1)) + "\n</style>", html)
    html = re.sub(r'<script src="([^"]+)"></script>',
                  lambda m: "<script>\n" + read(m.group(1)).replace("</script", "<\\/script") + "\n</script>", html)
    return html


with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    z.writestr(f"{top}/はじめにお読みください.txt", "﻿" + readme.replace("\n", "\r\n"))
    z.write(projects / "dist/情報の技術_体験教材集.html", f"{top}/情報の技術_体験教材集.html")
    z.writestr(f"{top}/先生用ガイド.html", inline(projects / "docs/先生用ガイド.html"))
    z.writestr(f"{top}/先生用ガイド_情報セキュリティ体験ラボ.html", inline(projects / "docs/情報セキュリティ体験ラボ_先生用ガイド.html"))
    for m in data["materials"]:
        z.write(projects / m["source"], f"{top}/個別の教材/{m['code']}_{m['title']}.html")
print(f"D-information/{out.relative_to(projects)} を作りました（{out.stat().st_size // 1024} KB）")
