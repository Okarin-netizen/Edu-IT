#!/usr/bin/env python3
"""生徒用の公開サイト(GitHub Pages)を _site/ に作る。実行: python3 site/build.py

入れるのは生徒用のものだけ: 入り口のページ(site/index.html と、そこからえらぶ「授業で使う」jugyo.html・「自習で使う」jishu.html)と、クラスルーム配布/生徒に配る/ のガイダンス(g.html)・4つの統一版・
教科書の順に進む学習コース(kyokasho.html)と M・F・Z(m.html・f.html・z.html)・自習ワークシート(ws/)。
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
    "教科書の順に進む_学習コース.html": "kyokasho.html",
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

# 入り口のページ: トップ(授業か自習かをえらぶ)・授業で使う・自習で使う。CSS・JS は中に入れる
ENTRIES = ["index.html", "jugyo.html", "jishu.html"]


def css(m):
    return "<style>\n" + (here / m.group(1)).read_text(encoding="utf-8").replace("</style", "<\\/style") + "\n</style>"


def js(m):
    return "<script>\n" + (here / m.group(1)).read_text(encoding="utf-8").replace("</script", "<\\/script") + "\n</script>"


entries = {}
for name in ENTRIES:
    page = (here / name).read_text(encoding="utf-8")
    page, n1 = re.subn(r'<link rel="stylesheet" href="([^"]+)">', css, page)
    page, n2 = re.subn(r'<script src="([^"]+)"></script>', js, page)
    if n1 < 2 or n2 < 1:
        raise SystemExit(f"site/{name}: 共通の枠(eduit-frame.css・eduit-frame.js)と site.css を中に入れられませんでした")
    entries[name] = page


def relink(old, new):
    """入り口のページの中の、手元で開いたときの場所(old)を公開用の名前(new)にする"""
    if not any(old in page for page in entries.values()):
        raise SystemExit(f"site/: {old} へのリンクがありません(site/site.js を見てください)")
    for name in entries:
        entries[name] = entries[name].replace(old, new)


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
<nav id="site-topbar" aria-label="ホームページ"><a href="./" target="_top">◀ 入り口(技術分野 教材集)</a><button id="site-fs" type="button" aria-pressed="false" hidden>全画面</button></nav>
<div id="site-fs-note" role="status" hidden></div>
<iframe src="apps/{file}" title="{title}" allow="fullscreen; microphone; camera; clipboard-write" allowfullscreen></iframe>
<script>
  // アドレスの #… を中の教材に渡す(あとから開いても、同じ教材のページから始まる)
  var f = document.querySelector('iframe');
  // もどる先は、自習モード(?jishu=on か、この端末で覚えている)なら「自習で使う」、そうでなければ「授業で使う」の入り口
  var back = document.querySelector('#site-topbar a'), jm = /[?&]jishu=(on|off)(?:&|$)/.exec(location.search), jv = jm ? jm[1] : null;
  if (!jv) try {{ jv = localStorage.getItem('eduit.jishu'); }} catch (e) {{}}
  back.href = jv === 'on' ? 'jishu.html' : 'jugyo.html';
  back.textContent = jv === 'on' ? '◀ 自習で使う(入り口)' : '◀ 授業で使う(入り口)';
  // ?jishu=on などの設定も中の教材に渡す(ワークシートの「教材をひらく(自習モード)」が使う)
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
          "kyokasho.html": "教科書の順に進む 学習コース", "m.html": "M 身の回りの技術さがし", "f.html": "F これからの技術ラボ", "z.html": "Z 学習を終えて"}

WS = {"G_技術分野のガイダンス_ワークシート.html": "g.html", "A_材料と加工_ワークシート.html": "a.html", "B_生物育成_ワークシート.html": "b.html",
      "C_エネルギー変換_ワークシート.html": "c.html", "D_情報の技術_ワークシート.html": "d.html",
      "M_身の回りの技術さがし_ワークシート.html": "m.html", "F_これからの技術ラボ_ワークシート.html": "f.html", "Z_学習を終えて_ワークシート.html": "z.html"}


def course_links(page):
    """教科書順コースの var FILES = {…}; var WS = {…}; を公開用の名前にする"""
    def repl(name, table, prefix):
        nonlocal page
        m = re.search(r"var " + name + r" = (\{.*?\});", page)
        if not m:
            raise SystemExit(f"教科書順コース: var {name} = {{…}}; が見つかりません(site/build.py を直してください)")
        old = json.loads(m.group(1))
        new = {}
        for k, v in old.items():
            if v not in table:
                raise SystemExit(f"教科書順コース: {v} の公開用の名前がありません(site/build.py の PAGES・WS に足してください)")
            new[k] = prefix + table[v]
        page = page[:m.start(1)] + json.dumps(new, ensure_ascii=False) + page[m.end(1):]
    base = "var BASE = '', WS_BASE = 'ワークシート/';"
    if base not in page:
        raise SystemExit("教科書順コース: var BASE = …; が見つかりません(site/build.py を直してください)")
    page = page.replace(base, "var BASE = '', WS_BASE = '';")
    repl("FILES", PAGES, "../")
    repl("WS", WS, "../ws/")
    return page


(out / "apps").mkdir()
for src, dst in PAGES.items():
    relink("../クラスルーム配布/生徒に配る/" + src, dst)
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
    if dst == "kyokasho.html":
        # コースは apps/ の中の枠で開くので、教材とワークシートへのリンクは1つ上の公開用の名前(../a.html・../ws/a.html など)にする
        page = course_links(page)
    (out / "apps" / dst).write_text(page, encoding="utf-8")
    (out / dst).write_text(FRAME.format(title=TITLES[dst], file=dst), encoding="utf-8")

# 自習ワークシート(worksheet/build.py → まとめる.py が 生徒に配る/ワークシート/ に置いたもの)は ws/a.html〜ws/d.html(と g・m・f・z)に置く。
# 教材へのリンクは、自習用の統一版から公開用の a.html?jishu=on などに、左上に「自習で使う」の入り口へもどるリンクを足す
(out / "ws").mkdir()
for src, dst in WS.items():
    relink("../クラスルーム配布/生徒に配る/ワークシート/" + src, "ws/" + dst)
    page = read(student / "ワークシート" / src)
    unified = next(k for k, v in PAGES.items() if v == dst)
    n = page.count(f'href="../自習用/{unified}"') + page.count("<!--site-home-->")
    if n != 2:
        raise SystemExit(f"{src}: 教材へのリンクか入口へもどる印が見つかりません(worksheet/build.py を直してください)")
    page = page.replace(f'href="../自習用/{unified}"', f'href="../{dst}?jishu=on"')
    page = page.replace("<!--site-home-->", '<a class="ef-btn ef-back" href="../jishu.html">◀ 自習の入り口</a>')
    (out / "ws" / dst).write_text(page, encoding="utf-8")

for name, page in entries.items():
    (out / name).write_text(page, encoding="utf-8")
(out / ".nojekyll").write_text("", encoding="utf-8")

for p in sorted(out.rglob("*")):
    if p.is_file():
        print(f"{p.relative_to(repo)}  ({p.stat().st_size // 1024} KB)")
