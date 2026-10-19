#!/usr/bin/env python3
"""一つのHTML版を作る: python3 build/build-single.py [出力ファイル.html]
(出力先を省くと A-materials/dist/材料と加工_教材アプリ.html)

メニュー・8つのアプリ・先生用ビューア・使い方を、CSS と JS を中に入れた形で1つのファイルにまとめる。
4分野共通の枠(../shared/eduit-frame.css・eduit-frame.js)と eduit-info.js も各ページの中に入れる。
各ページは iframe(srcdoc)で開き、メニューへ戻るなどのリンクは親ページ(window.GSingle)が受け持つ。
"""
import base64, json, os, re, sys

# この道具は A-materials/build/ にある。ページは1つ上(A-materials/)から読む
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_OUT = os.path.join(ROOT, 'dist', '材料と加工_教材アプリ.html')
# ページ id → index.html の場所(並び順はメニューと同じ)
PAGES = [
    ('menu', 'index.html'),
    ('a1-material-navi', 'a1-material-navi/index.html'),
    ('a2-wood-lab', 'a2-wood-lab/index.html'),
    ('a3-structure-lab', 'a3-structure-lab/index.html'),
    ('a4-drawing-trainer', 'a4-drawing-trainer/index.html'),
    ('a5-kidori', 'a5-kidori/index.html'),
    ('a6-tool-safety', 'a6-tool-safety/index.html'),
    ('a7-solid-maker', 'a7-solid-maker/index.html'),
    ('a8-mondai-note', 'a8-mondai-note/index.html'),
    ('teacher-viewer', 'teacher-viewer/index.html'),
    ('guide', 'docs/先生用ガイド.html'),
]


# 各ページの先頭に入れる: アプリ間のリンクを親ページ(GSingle)に任せる
CHILD = '''<script>(function () {
  var P; try { P = window.parent !== window && window.parent.GSingle; } catch (e) {}
  if (!P) return;
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    var h = a.getAttribute('href');
    if (/^(#|blob:|data:|https?:|javascript:)/.test(h)) return;
    if (P.go(h)) e.preventDefault();
  }, true);
})();</script>'''


def read(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


def inline(page_path):
    base = os.path.dirname(os.path.join(ROOT, page_path))
    html = read(os.path.join(ROOT, page_path))
    html = re.sub(r'\s*<link rel="(manifest|icon)"[^>]*>', '', html)

    def css(m):
        return '<style>\n' + read(os.path.join(base, m.group(1))).replace('</style', '<\\/style') + '\n</style>'

    def js(m):
        code = read(os.path.join(base, m.group(1)))
        return '<script>\n' + code.replace('</script', '<\\/script') + '\n</script>'

    want = len(re.findall(r'<link rel="stylesheet"|<script src=', html))
    html, n1 = re.subn(r'<link rel="stylesheet" href="([^"]+)">', css, html)
    html, n2 = re.subn(r'<script src="([^"]+)"></script>', js, html)
    if n1 + n2 != want:
        raise SystemExit(page_path + ': 埋め込めなかったファイルがあります')
    # 共通の枠(作成者・安全と個人情報・ライセンス・更新履歴のフッター)が入っているか
    for mark in ('Edu-IT 共通の枠', 'window.EDUIT_INFO = {', 'EDUIT_INFO.app = {', 'window.EduitFrame'):
        if mark not in html:
            raise SystemExit(page_path + ': 共通の枠(shared/eduit-frame.*・eduit-info.js)が読み込まれていません')
    html = html.replace('<head>', '<head>\n' + CHILD, 1)
    return html


def main(out):
    pages = {pid: inline(p) for pid, p in PAGES}
    dirs = {p.split('/')[0]: pid for pid, p in PAGES if '/' in p}
    with open(os.path.join(ROOT, 'icons/icon.svg'), 'rb') as f:
        icon = base64.b64encode(f.read()).decode()
    data = json.dumps({'pages': pages, 'dirs': dirs}, ensure_ascii=False)
    data = data.replace('</', '<\\/').replace('<!--', '<\\u0021--')
    shell = '''<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>材料と加工の技術 教材集(1ファイル版)</title>
<meta name="theme-color" content="#985a26">
<link rel="icon" href="data:image/svg+xml;base64,%(icon)s">
<style>
  html, body { margin: 0; height: 100%%; background: #f5f4f0; }
  #view { position: fixed; inset: 0; width: 100%%; height: 100%%; border: 0; display: block; }
  noscript p { font: 18px sans-serif; padding: 1rem; }
</style>
</head>
<body>
<noscript><p>JavaScript を有効にしてください。</p></noscript>
<iframe id="view" title="教材アプリ"></iframe>
<script>
/* 材料と加工の技術 教材集 1ファイル版(作成: 技術 岡田) */
(function () {
  'use strict';
  var DATA = %(data)s;
  var view = document.getElementById('view');
  var cur = null;
  function show(id) {
    if (!DATA.pages[id]) id = 'menu';
    if (id === cur) return;
    cur = id;
    view.srcdoc = DATA.pages[id];
  }
  // 「../index.html」「a1-material-navi/index.html」「docs/先生用ガイド.html」などを、ページ id に置きかえる
  function resolve(href) {
    var path = String(href).split('#')[0].split('?')[0];
    try { path = decodeURIComponent(path); } catch (e) {}
    var parts = path.split('/').filter(function (s) { return s && s !== '.' && s !== '..'; });
    if (!parts.length) return null;
    if (parts.length === 1) {
      if (parts[0] === 'index.html') return 'menu';
      if (parts[0] === '使い方_先生用.html' || parts[0] === '先生用ガイド.html') return 'guide';  // 古い名前・古い置き場所(A-materials/ 直下)へのリンク
      return null;
    }
    return DATA.dirs[parts[0]] || null;
  }
  window.GSingle = {
    go: function (href) {
      var id = resolve(href);
      if (!id) return false;
      if (location.hash.slice(1) === id) show(id); else location.hash = id;
      return true;
    }
  };
  function fromHash() {
    var id = location.hash.slice(1);
    try { id = decodeURIComponent(id); } catch (e) {}  // こわれた %%xx があっても止まらないように
    show(id || 'menu');
  }
  window.addEventListener('hashchange', fromHash);
  view.addEventListener('load', function () {
    try { document.title = view.contentDocument.title || document.title; } catch (e) {}
  });
  fromHash();
})();
</script>
</body>
</html>
''' % {'icon': icon, 'data': data}
    with open(out, 'w', encoding='utf-8') as f:
        f.write(shell)
    print(out, round(os.path.getsize(out) / 1024), 'KB', len(pages), 'ページ')


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_OUT
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    main(out)
