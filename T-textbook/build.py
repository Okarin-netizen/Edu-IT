#!/usr/bin/env python3
"""教科書順コースと M・F・Z の教材を、インターネットなしで動く1ファイルにする。
実行: python3 T-textbook/build.py  → T-textbook/dist/ に5つのファイル
(クラスルーム配布/まとめる.py もこれを実行する)
"""
import pathlib, re

here = pathlib.Path(__file__).resolve().parent
repo = here.parent
dist = here / "dist"

PAGES = (
    ("index.html", "教科書の順に進む_学習コース.html"),
    ("M-mimawari/index.html", "M_身の回りの技術さがし.html"),
    ("F-korekara/index.html", "F_これからの技術ラボ.html"),
    ("Z-owari/index.html", "Z_学習を終えて.html"),
    ("docs/先生用ガイド.html", "先生用ガイド.html"),
)
# コースの教材へのリンク: リポジトリの中で開くときは 生徒に配る/ を見る。配るファイルでは同じフォルダのファイルを見る
COURSE_BASE = "var BASE = '../クラスルーム配布/生徒に配る/', WS_BASE = BASE + 'ワークシート/';"
COURSE_BASE_DIST = "var BASE = '', WS_BASE = 'ワークシート/';"


def inline(src):
    html = src.read_text(encoding="utf-8")
    base = src.parent

    def css(m):
        return "<style>\n" + (base / m.group(1)).read_text(encoding="utf-8").replace("</style", "<\\/style") + "\n</style>"

    def js(m):
        return "<script>\n" + (base / m.group(1)).read_text(encoding="utf-8").replace("</script", "<\\/script") + "\n</script>"

    want = len(re.findall(r'<link rel="stylesheet"|<script src=', html))
    html, n1 = re.subn(r'<link rel="stylesheet" href="([^"]+)">', css, html)
    html, n2 = re.subn(r'<script src="([^"]+)"></script>', js, html)
    if n1 + n2 != want:
        raise SystemExit(f"{src}: 中に入れられなかったファイルがあります")
    return html


dist.mkdir(exist_ok=True)
for src, name in PAGES:
    html = inline(here / src)
    if src == "index.html":
        if COURSE_BASE not in html:
            raise SystemExit("T-textbook/index.html: 教材へのリンクの置き場所(var BASE = …)が見つかりません")
        html = html.replace(COURSE_BASE, COURSE_BASE_DIST)
    out = dist / name
    out.write_text(html, encoding="utf-8")
    print(f"{out.relative_to(repo)}  ({out.stat().st_size // 1024} KB)")
