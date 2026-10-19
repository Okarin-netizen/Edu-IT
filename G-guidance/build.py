#!/usr/bin/env python3
"""技術分野のガイダンスを、インターネットなしで動く1ファイルにする。
実行: python3 G-guidance/build.py  → G-guidance/dist/技術分野のガイダンス.html と dist/先生用ガイド.html
(クラスルーム配布/まとめる.py もこれを実行する)
"""
import pathlib, re

here = pathlib.Path(__file__).resolve().parent
repo = here.parent
dist = here / "dist"


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
for src, name in ((here / "index.html", "技術分野のガイダンス.html"), (here / "docs/先生用ガイド.html", "先生用ガイド.html")):
    out = dist / name
    out.write_text(inline(src), encoding="utf-8")
    print(f"{out.relative_to(repo)}  ({out.stat().st_size // 1024} KB)")
