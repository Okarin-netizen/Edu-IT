#!/usr/bin/env python3
"""生徒用の公開サイト(GitHub Pages)を _site/ に作る。実行: python3 site/build.py

入れるのは生徒用のものだけ: 入口ページ(site/index.html)と、クラスルーム配布/生徒に配る/ の4つの統一版。
先生用ガイド(クラスルーム配布/先生用/)と teacher-tools/ は入れない。
アドレスに日本語が入らないように、統一版は a.html・b.html・c.html・d.html という名前で置く。
先に python3 クラスルーム配布/まとめる.py で 生徒に配る/ を新しくしておく(.github/workflows/pages.yml は今あるファイルをそのまま使う)。
"""
import pathlib, re, shutil

here = pathlib.Path(__file__).resolve().parent
repo = here.parent
student = repo / "クラスルーム配布/生徒に配る"
out = repo / "_site"

PAGES = {
    "A_材料と加工_統一版.html": "a.html",
    "B_生物育成_統一版.html": "b.html",
    "C_エネルギー変換_統一版.html": "c.html",
    "D_情報の技術_統一版.html": "d.html",
}

if out.exists():
    shutil.rmtree(out)
out.mkdir()

html = (here / "index.html").read_text(encoding="utf-8")


def css(m):
    return "<style>\n" + (here / m.group(1)).read_text(encoding="utf-8").replace("</style", "<\\/style") + "\n</style>"


def js(m):
    return "<script>\n" + (here / m.group(1)).read_text(encoding="utf-8").replace("</script", "<\\/script") + "\n</script>"


html, n1 = re.subn(r'<link rel="stylesheet" href="([^"]+)">', css, html)
html, n2 = re.subn(r'<script src="([^"]+)"></script>', js, html)
if (n1, n2) != (1, 1):
    raise SystemExit("site/index.html: 共通の枠(eduit-frame.css・eduit-frame.js)を中に入れられませんでした")

for src, dst in PAGES.items():
    old = "../クラスルーム配布/生徒に配る/" + src
    if old not in html:
        raise SystemExit(f"site/index.html: {old} へのリンクがありません")
    html = html.replace(old, dst)
    shutil.copyfile(student / src, out / dst)

(out / "index.html").write_text(html, encoding="utf-8")
(out / ".nojekyll").write_text("", encoding="utf-8")

for p in sorted(out.iterdir()):
    print(f"_site/{p.name}  ({p.stat().st_size // 1024} KB)")
