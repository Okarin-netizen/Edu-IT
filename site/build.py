#!/usr/bin/env python3
"""生徒用の公開サイト(GitHub Pages)を _site/ に作る。実行: python3 site/build.py

入れるのは生徒用のものだけ: 入り口のページ index.html(教科書の目次。クラスルーム配布/生徒に配る/教科書の順に進む_学習コース.html と同じもの)と、
クラスルーム配布/生徒に配る/ のガイダンス(g.html)・4つの統一版・M・F・Z(m.html・f.html・z.html)・自習ワークシート(ws/)。
目次から節を開くと、目次のページの中で apps/a.html などを ?sec=節 で開く(上の帯は目次のものだけ)。
前の入り口(jugyo.html・jishu.html・kyokasho.html)は、目次へ送るだけのページにする(古いリンクのため)。
先生用ガイド(クラスルーム配布/先生用/)と teacher-tools/ は入れない。
アドレスに日本語が入らないように、統一版は apps/a.html〜apps/d.html(ガイダンスは apps/g.html)という名前で置き、
a.html〜d.html・g.html は、いちばん上の「◀ 入り口へもどる」のバーの下に統一版を出すページにする(配るファイルそのものは変えない)。
先に python3 クラスルーム配布/まとめる.py で 生徒に配る/ を新しくしておく(.github/workflows/pages.yml は今あるファイルをそのまま使う)。
"""
import json, pathlib, re, shutil

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
    "M_身の回りの技術さがし.html": "m.html",
    "F_これからの技術ラボ.html": "f.html",
    "Z_学習を終えて.html": "z.html",
}


def read(path):
    """配るファイルを読む。なければ、何をすればよいかを出して止める(長いエラーの表示にしない)"""
    if not path.is_file():
        raise SystemExit(f"{path.relative_to(repo)} がありません。先に python3 クラスルーム配布/まとめる.py を実行してください")
    return path.read_text(encoding="utf-8")


if out.exists():
    shutil.rmtree(out)
out.mkdir()

# 前の入り口のページ(古いリンク・ブックマークのため)は、教科書の目次(index.html)へ送るだけ
REDIRECT = """<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>技術分野 教材集</title><meta http-equiv="refresh" content="0; url=./">
<script>location.replace('./' + location.hash);</script></head>
<body><p><a href="./">技術分野 教材集(教科書の目次)へ</a></p></body></html>
"""
OLD_ENTRIES = ["jugyo.html", "jishu.html", "kyokasho.html"]


# 統一版は apps/ に置き、a.html〜d.html は「入り口へもどる」の細いバーの下に統一版を画面いっぱいに出すページにする。
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
  #site-fs {{ margin-left: auto; flex: none; min-height: 28px; padding: 2px 12px; border: 1px solid rgba(255, 255, 255, .6); border-radius: 6px;
    background: transparent; color: #fff; font: inherit; cursor: pointer; white-space: nowrap; }}
  #site-fs:hover, #site-fs:focus-visible {{ background: rgba(255, 255, 255, .2); outline: 2px solid #f08c00; outline-offset: 0; }}
  #site-fs[aria-pressed="true"] {{ background: #fff; color: #33373d; }}
  #site-fs[hidden] {{ display: none; }}
  #site-fs-note {{ position: fixed; top: 38px; right: 8px; z-index: 10; max-width: calc(100% - 16px); padding: 8px 12px; border-radius: 8px; box-sizing: border-box;
    background: #33373d; color: #fff; font: 600 14px/1.5 "BIZ UDPGothic", "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Noto Sans JP", "Yu Gothic UI", Meiryo, sans-serif;
    box-shadow: 0 2px 8px rgba(0, 0, 0, .3); }}
  #site-fs-note[hidden] {{ display: none; }}
  iframe {{ flex: 1 1 auto; width: 100%; border: 0; background: #fff; }}
</style>
</head>
<body>
<nav id="site-topbar" aria-label="ホームページ"><a href="./" target="_top">◀ 教科書の目次</a><button id="site-fs" type="button" aria-pressed="false" hidden>全画面</button></nav>
<div id="site-fs-note" role="status" hidden></div>
<iframe src="apps/{file}" title="{title}" allow="fullscreen; microphone; camera; clipboard-write" allowfullscreen></iframe>
<script>
  // アドレスの #… を中の教材に渡す(あとから開いても、同じ教材のページから始まる)
  var f = document.querySelector('iframe');
  // ?bunya=… などの設定も中の教材に渡す
  if (location.search || location.hash) f.src = 'apps/{file}' + location.search + location.hash;
  // 全画面: このバーごと画面いっぱいにする(ブラウザのタブやアドレスバーが消える。やめるときはもう一度押すか Esc)。
  // 全画面にできないブラウザ(iPhone の Safari など)では、ボタンを出さない。
  // キー(F11・Chromebook の全画面キー)で全画面にしたときも、ボタンは「全画面をやめる」にする。
  // ただしキーの全画面はページからはやめられないので、押したら「同じキーでもどせます」と出す
  var D = document, fs = document.getElementById('site-fs'), note = document.getElementById('site-fs-note');
  var keyMq = window.matchMedia ? window.matchMedia('(display-mode: fullscreen)') : null;
  function isFull() {{ return !!(D.fullscreenElement || D.webkitFullscreenElement); }}
  function isKeyFull() {{ return !isFull() && !!(keyMq && keyMq.matches); }}
  function updFull() {{
    var on = isFull() || isKeyFull();
    if (!on) note.hidden = true;
    fs.textContent = on ? '全画面をやめる' : '全画面';
    fs.setAttribute('aria-pressed', on ? 'true' : 'false');
  }}
  if (D.fullscreenEnabled || D.webkitFullscreenEnabled) {{
    fs.hidden = false;
    fs.addEventListener('click', function () {{
      var el = D.documentElement;
      try {{
        if (isFull()) (D.exitFullscreen || D.webkitExitFullscreen).call(D);
        else if (isKeyFull()) {{
          note.textContent = 'キーで全画面にしたときは、同じキー(F11 など)でもどせます';
          note.hidden = false;
          clearTimeout(note.t); note.t = setTimeout(function () {{ note.hidden = true; }}, 4000);
        }}
        else {{ var r = (el.requestFullscreen || el.webkitRequestFullscreen).call(el); if (r && r.catch) r.catch(function () {{}}); }}
      }} catch (e) {{}}
    }});
    D.addEventListener('fullscreenchange', updFull);
    D.addEventListener('webkitfullscreenchange', updFull);
    if (keyMq) {{ if (keyMq.addEventListener) keyMq.addEventListener('change', updFull); else if (keyMq.addListener) keyMq.addListener(updFull); }}
    window.addEventListener('resize', updFull);
    updFull();
  }}
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
TITLES = {"g.html": "技術分野のガイダンス", "a.html": "材料と加工の技術 教材集", "b.html": "生物育成の技術 教材集", "c.html": "エネルギー変換の技術 教材集", "d.html": "情報の技術 教材集",
          "m.html": "M 身の回りの技術さがし", "f.html": "F これからの技術ラボ", "z.html": "Z 学習を終えて"}

WS = {"G_技術分野のガイダンス_ワークシート.html": "g.html", "A_材料と加工_ワークシート.html": "a.html", "B_生物育成_ワークシート.html": "b.html",
      "C_エネルギー変換_ワークシート.html": "c.html", "D_情報の技術_ワークシート.html": "d.html", "Z_学習を終えて_ワークシート.html": "z.html"}


def course_links(page):
    """教科書の目次の var FILES・WS・MENU を公開用の名前にする。節の画面で開く教材は apps/a.html など(上の帯は目次のものだけ)、
    教材の一覧から開くのは a.html など(上に「◀ 教科書の目次」のバー)、ワークシートは ws/a.html など"""
    def table(name):
        m = re.search(r"var " + name + r" = (\{.*?\});", page)
        if not m:
            raise SystemExit(f"教科書の目次: var {name} = {{…}}; が見つかりません(site/build.py を直してください)")
        return m, json.loads(m.group(1))

    def put(name, new):
        nonlocal page
        m, _ = table(name)
        page = page[:m.start(1)] + json.dumps(new, ensure_ascii=False) + page[m.end(1):]

    _, files = table("FILES")
    _, ws = table("WS")
    for v in files.values():
        if v not in PAGES:
            raise SystemExit(f"教科書の目次: {v} の公開用の名前がありません(site/build.py の PAGES に足してください)")
    for v in ws.values():
        if v not in WS:
            raise SystemExit(f"教科書の目次: {v} の公開用の名前がありません(site/build.py の WS に足してください)")
    put("FILES", {k: "apps/" + PAGES[v] for k, v in files.items()})
    put("WS", {k: "ws/" + WS[v] for k, v in ws.items()})
    menu = "var MENU = FILES;"
    if menu not in page:
        raise SystemExit("教科書の目次: var MENU = FILES; が見つかりません(site/build.py を直してください)")
    page = page.replace(menu, "var MENU = " + json.dumps({k: PAGES[v] for k, v in files.items()}, ensure_ascii=False) + ";")
    base = "var BASE = '', WS_BASE = 'ワークシート/';"
    if base not in page:
        raise SystemExit("教科書の目次: var BASE = …; が見つかりません(site/build.py を直してください)")
    return page.replace(base, "var BASE = '', WS_BASE = '';")


(out / "apps").mkdir()
for src, dst in PAGES.items():
    page = read(student / src)
    if dst == "b.html":
        # 生物育成の教材は「ほかのページの枠の中」だと見出し(◀ メニューなど)をかくす。このサイトの枠(上に「◀ 入り口」のバー)の
        # すぐ中にある統一版のメニューだけは見出しを出したままにする。統一版の中で開く B1〜B6 は、これまでどおり見出しをかくす
        # (全部を「枠の外」あつかいにすると、B1〜B6 の見出しが統一版のバーの下にもう1本出て、上のバーが二重になる)
        page, n = re.subn(r"embed = window\.self !== window\.top;",
                          "embed = window.parent !== window && !window.parent.document.getElementById('site-topbar');", page)
        if n == 0:
            raise SystemExit(f"{src}: 枠の中かどうかを調べるところが見つかりません(site/build.py を直してください)")
    if dst in ("a.html", "b.html", "c.html", "d.html"):
        # メニューの M・F へのリンク(shared/eduit-frame.js の SIBLINGS)は、配るフォルダでは同じフォルダのファイル名。公開用の名前(1つ上の m.html・f.html)にする
        n = 0
        for old, new in (("file: 'M_身の回りの技術さがし.html'", "file: '../m.html'"), ("file: 'F_これからの技術ラボ.html'", "file: '../f.html'")):
            n += page.count(old)
            page = page.replace(old, new)
        if n < 2:
            raise SystemExit(f"{src}: M・F へのリンクの置き場所が見つかりません(shared/eduit-frame.js の SIBLINGS を見てください)")
    (out / "apps" / dst).write_text(page, encoding="utf-8")
    (out / dst).write_text(FRAME.format(title=TITLES[dst], file=dst), encoding="utf-8")

# ワークシート(worksheet/build.py → まとめる.py が 生徒に配る/ワークシート/ に置いたもの。節ごとに1枚)は ws/g.html・a.html〜d.html・z.html に置く。
# 「この節をひらく」は公開用の目次(../#s=節)に、左上に教科書の目次へもどるリンクを足す
(out / "ws").mkdir()
for src, dst in WS.items():
    page = read(student / "ワークシート" / src)
    course = "../教科書の順に進む_学習コース.html"
    n = page.count(f'"{course}"') + page.count("<!--site-home-->")
    if n != 3:
        raise SystemExit(f"{src}: 学習コースへのリンクか入口へもどる印が見つかりません(worksheet/build.py を直してください)")
    page = page.replace(f'"{course}"', '"../"')
    page = page.replace("<!--site-home-->", '<a class="ef-btn ef-back" href="../">◀ 教科書の目次</a>')
    (out / "ws" / dst).write_text(page, encoding="utf-8")

# 入り口: 教科書の目次(配るものと同じファイル。教材・ワークシートへのリンクだけ公開用の名前にする)
(out / "index.html").write_text(course_links(read(student / "教科書の順に進む_学習コース.html")), encoding="utf-8")
for name in OLD_ENTRIES:
    (out / name).write_text(REDIRECT, encoding="utf-8")
(out / ".nojekyll").write_text("", encoding="utf-8")

for p in sorted(out.rglob("*")):
    if p.is_file():
        print(f"{p.relative_to(repo)}  ({p.stat().st_size // 1024} KB)")
