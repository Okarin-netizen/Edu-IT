#!/usr/bin/env python3
"""振り返り一覧を、インターネットなしで動く1ファイルにする。
実行: python3 teacher-tools/furikaeri-ichiran/build.py  → dist/振り返り一覧.html
"""
import pathlib

here = pathlib.Path(__file__).resolve().parent
repo = here.parent.parent
out = here / "dist" / "振り返り一覧.html"


def read(p):
    return p.read_text(encoding="utf-8")


def script(code):
    return "<script>\n" + code.replace("</script", "<\\/script") + "\n</script>"


html = read(here / "index.html")
parts = {
    '<link rel="stylesheet" href="../../shared/eduit-frame.css">': "<style>\n" + read(repo / "shared/eduit-frame.css") + "\n</style>",
    '<script src="../eduit-info.js"></script>': script(read(here.parent / "eduit-info.js")),
    '<script src="../../shared/eduit-frame.js"></script>': script(read(repo / "shared/eduit-frame.js")),
    '<script src="parse.js"></script>': script(read(here / "parse.js")),
}
for tag, inline in parts.items():
    if tag not in html:
        raise SystemExit(f"index.html に {tag} がありません")
    html = html.replace(tag, inline, 1)
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding="utf-8")
print(f"{out.relative_to(repo)}  ({out.stat().st_size // 1024} KB)")
