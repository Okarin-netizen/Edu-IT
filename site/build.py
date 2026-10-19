#!/usr/bin/env python3
"""生徒用の公開サイト(GitHub Pages)を _site/ に作る。実行: python3 site/build.py

入れるのは生徒用のものだけ: 入口ページ(site/index.html)と、クラスルーム配布/生徒に配る/ のガイダンス(g.html)・4つの統一版・自習ワークシート(ws/)。
先生用ガイド(クラスルーム配布/先生用/)と teacher-tools/ は入れない。
アドレスに日本語が入らないように、統一版は apps/a.html〜apps/d.html(ガイダンスは apps/g.html)という名前で置き、
a.html〜d.html・g.html は、いちばん上の「分野をえらぶ」のバーの下に統一版を出すページにする(配るファイルそのものは変えない)。
先に python3 クラスルーム配布/まとめる.py で 生徒に配る/ を新しくしておく(.github/workflows/pages.yml は今あるファイルをそのまま使う)。
"""
import pathlib, re, shutil

here = pathlib.Path(__file__).resolve().parent
repo = here.parent
student = repo / "クラスルーム配布/生徒に配る"
out = repo / "_site"

PAGES = {
    "G_技術分野のガイダンス.html": "g.html",
    "A_材料と加工_統一版.html": "a.html",
    "B_生物育成_統一版.html": "b.html",
    "C_エネルギー変換_統一版.html": "c.html",
    "D_情報の技術_統一版.html": "d.html",
}


def read(path):
    """配るファイルを読む。なければ、何をすればよいかを出して止める(長いエラーの表示にしない)"""
    if not path.is_file():
        raise SystemExit(f"{path.relative_to(repo)} がありません。先に python3 クラスルーム配布/まとめる.py を実行してください")
    return path.read_text(encoding="utf-8")


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

# 統一版は apps/ に置き、a.html〜d.html は「入口へもどる」の細いバーの下に統一版を画面いっぱいに出すページにする。
# 統一版の中(上のバーが固定のものもある)には手を入れないので、見た目や動きは配るファイルと同じ(配るファイルそのものも変えない)。
FRAME = """<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<style>
  html, body {{ margin: 0; height: 100%; }}
  body {{ display: flex; flex-direction: column; height: 100vh; height: 100dvh; background: #33373d; }}
  #site-topbar {{ flex: 0 0 auto; display: flex; align-items: center; min-height: 34px; padding: 2px 10px; box-sizing: border-box;
    font: 600 14px/1.4 "BIZ UDPGothic", "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Noto Sans JP", "Yu Gothic UI", Meiryo, sans-serif; }}
  #site-topbar a {{ color: #fff; text-decoration: none; padding: 4px 10px; border-radius: 6px; }}
  #site-topbar a:hover, #site-topbar a:focus-visible {{ background: rgba(255, 255, 255, .2); outline: 2px solid #f08c00; outline-offset: 0; }}
  iframe {{ flex: 1 1 auto; width: 100%; border: 0; background: #fff; }}
</style>
</head>
<body>
<nav id="site-topbar" aria-label="ホームページ"><a href="./" target="_top">◀ 分野をえらぶ(技術分野 教材集)</a></nav>
<iframe src="apps/{file}" title="{title}" allow="fullscreen; microphone; camera; clipboard-write" allowfullscreen></iframe>
<script>
  // アドレスの #… を中の教材に渡す(あとから開いても、同じ教材のページから始まる)
  var f = document.querySelector('iframe');
  // ?jishu=on などの設定も中の教材に渡す(ワークシートの「教材をひらく(自習モード)」が使う)
  if (location.search || location.hash) f.src = 'apps/{file}' + location.search + location.hash;
  f.addEventListener('load', function () {{
    try {{
      document.title = f.contentDocument.title || document.title;
      f.contentWindow.addEventListener('hashchange', function () {{ history.replaceState(null, '', f.contentWindow.location.hash || location.pathname + location.search); }});
    }} catch (e) {{}}
  }});
</script>
</body>
</html>
"""
TITLES = {"g.html": "技術分野のガイダンス", "a.html": "材料と加工の技術 教材集", "b.html": "生物育成の技術 教材集", "c.html": "エネルギー変換の技術 教材集", "d.html": "情報の技術 教材集"}

(out / "apps").mkdir()
for src, dst in PAGES.items():
    old = "../クラスルーム配布/生徒に配る/" + src
    if old not in html:
        raise SystemExit(f"site/index.html: {old} へのリンクがありません")
    html = html.replace(old, dst)
    page = read(student / src)
    if dst == "b.html":
        # 生物育成の教材は「ほかのページの枠の中」だと見出し(◀ メニューなど)をかくす。ここの枠では見出しを出したままにする
        page, n = re.subn(r"embed = window\.self !== window\.top;", "embed = false;", page)
        if n == 0:
            raise SystemExit(f"{src}: 枠の中かどうかを調べるところが見つかりません(site/build.py を直してください)")
    (out / "apps" / dst).write_text(page, encoding="utf-8")
    (out / dst).write_text(FRAME.format(title=TITLES[dst], file=dst), encoding="utf-8")

# 自習ワークシート(worksheet/build.py → まとめる.py が 生徒に配る/ワークシート/ に置いたもの)は ws/a.html〜ws/d.html に置く。
# 教材へのリンクは、自習用の統一版から公開用の a.html?jishu=on などに、左上に入口へもどるリンクを足す
WS = {"G_技術分野のガイダンス_ワークシート.html": "g.html", "A_材料と加工_ワークシート.html": "a.html", "B_生物育成_ワークシート.html": "b.html",
      "C_エネルギー変換_ワークシート.html": "c.html", "D_情報の技術_ワークシート.html": "d.html"}
(out / "ws").mkdir()
for src, dst in WS.items():
    old = "../クラスルーム配布/生徒に配る/ワークシート/" + src
    if old not in html:
        raise SystemExit(f"site/index.html: {old} へのリンクがありません")
    html = html.replace(old, "ws/" + dst)
    page = read(student / "ワークシート" / src)
    unified = next(k for k, v in PAGES.items() if v == dst)
    n = page.count(f'href="../自習用/{unified}"') + page.count("<!--site-home-->")
    if n != 2:
        raise SystemExit(f"{src}: 教材へのリンクか入口へもどる印が見つかりません(worksheet/build.py を直してください)")
    page = page.replace(f'href="../自習用/{unified}"', f'href="../{dst}?jishu=on"')
    page = page.replace("<!--site-home-->", '<a class="ef-btn ef-back" href="../">◀ 入口</a>')
    (out / "ws" / dst).write_text(page, encoding="utf-8")

(out / "index.html").write_text(html, encoding="utf-8")
(out / ".nojekyll").write_text("", encoding="utf-8")

for p in sorted(out.rglob("*")):
    if p.is_file():
        print(f"{p.relative_to(repo)}  ({p.stat().st_size // 1024} KB)")
