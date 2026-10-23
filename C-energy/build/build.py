# -*- coding: utf-8 -*-
"""C1〜C8 を1つのHTMLに統合し、使い方と一緒に配布用zipにする。元ファイルは読むだけ。"""
import json, os, re, sys, zipfile
sys.path.insert(0, os.path.dirname(__file__))
import help as H

HERE = os.path.dirname(os.path.abspath(__file__))
# 元ファイルの場所(ふつうはこのリポジトリの C-energy = build/ の1つ上)。別の場所でビルドするときは EA_SRC=<フォルダ> を付けて実行する
# 出力: 配布用(統合版html・zip)は SRC/dist、使い方(tsukaikata.html)は SRC/docs
SRC = os.environ.get('EA_SRC', os.path.normpath(os.path.join(HERE, '..')))
OUT = os.path.join(SRC, 'dist')
DOCS = os.path.join(SRC, 'docs')
# 4分野共通の枠(shared/)。1ファイル版には中身を入れる(外部ファイルを読まない)
SHARED = os.environ.get('EA_SHARED', os.path.normpath(os.path.join(SRC, '..', 'shared')))
EF_CSS = open(os.path.join(SHARED, 'eduit-frame.css'), encoding='utf-8').read().strip()
EF_JS = open(os.path.join(SHARED, 'eduit-frame.js'), encoding='utf-8').read().strip()
EG_CSS = open(os.path.join(SHARED, 'eduit-guide.css'), encoding='utf-8').read().strip()  # 先生用ガイドの見た目
EF_INFO = open(os.path.join(SRC, 'eduit-info.js'), encoding='utf-8').read().strip()
# C8 問題解決ノートの本体(4分野共通 shared/mondai-note/)。C8/index.html は <link>・<script src> で読むので、統合版にはここで中身を入れる
MN_DIR = os.path.join(SHARED, 'mondai-note')
MN_CSS = open(os.path.join(MN_DIR, 'mondai-note.css'), encoding='utf-8').read().strip()
MN_DATA = open(os.path.join(MN_DIR, 'mondai-note-data.js'), encoding='utf-8').read().strip().replace('</script', '<\\/script')
MN_JS = open(os.path.join(MN_DIR, 'mondai-note.js'), encoding='utf-8').read().strip().replace('</script', '<\\/script')
assert '</style' not in MN_CSS and '</script' not in MN_DATA + MN_JS
# <script> の中に入れるので、コメントなどの </script を <\/script にする(JS としては同じ意味)
EF_JS = EF_JS.replace('</script', '<\\/script')
EF_INFO = EF_INFO.replace('</script', '<\\/script')
for _x in (EF_CSS, EG_CSS, EF_JS, EF_INFO):
    assert '</script' not in _x and '</style' not in _x and '{{' not in _x
VERSION = re.search(r"version: '([^']+)'", EF_INFO).group(1)
UPDATED = re.search(r"updated: '([^']+)'", EF_INFO).group(1)


def ef_inline(text):
    return text.replace('{{EF_CSS}}', EF_CSS).replace('{{EG_CSS}}', EG_CSS).replace('{{EF_INFO}}', EF_INFO).replace('{{EF_JS}}', EF_JS)


# 各アプリの CSS・DOM の接頭辞(.e1〜.e8・e1-app など)は記号ではない中の名前。
# 2026-10-23 に記号を教科書の順に付け直したので、記号の番号と中の名前の番号はちがう(記号 → 中の名前の番号)
INNER = {1: 1, 2: 6, 3: 7, 4: 2, 5: 3, 6: 4, 7: 5, 8: 8}


def parts(n):
    s = open('%s/C%d/index.html' % (SRC, n), encoding='utf-8').read()
    css = re.findall(r'<style>(.*?)</style>', s, re.S)
    # <script> だけを取り出す(共通の枠の <script src> と <script data-ef-app> は入れない。シェルが中身を入れる)
    js = re.findall(r'<script>(.*?)</script>', s, re.S)
    assert len(css) == 1, n
    assert not any('EDUIT_INFO' in j for j in js), n
    return css[0], js


def must_replace(text, old, new, count=1):
    assert text.count(old) == count, (old, text.count(old))
    return text.replace(old, new)


css_all, js_all = [], []
seen_cores = set()
for n in range(1, 9):
    css, js = parts(n)
    # 各アプリの html,body 指定はシェルが持つので外す(印刷用の指定は残す)
    hb = re.search(r'^html,body\{[^}]*\}\n', css, re.M)
    assert hb, ('C%d の <style> に html,body{...} の行がない' % n)
    css = must_replace(css, hb.group(0), '')
    k = INNER[n]
    if k in (3, 4):
        # 印刷時に他アプリの印刷範囲まで隠さないよう、表示中のアプリだけに効かせる
        css = must_replace(css, '  body *{visibility:hidden}', '  body.ea-on-C%d *{visibility:hidden}' % n)
        css = must_replace(css, '  .e%d-printarea,.e%d-printarea *{visibility:visible}' % (k, k),
                           '  body.ea-on-C%d .e%d-printarea,body.ea-on-C%d .e%d-printarea *{visibility:visible}' % (n, k, n, k))
    if n == 8:
        # 問題解決ノートの本体(見た目はすべて .mn- で始まるので、ほかのアプリには効かない)
        assert 'mondai-note/mondai-note.css' in open('%s/C8/index.html' % SRC, encoding='utf-8').read()
        css_all.append('/* ---------- C8 問題解決ノートの本体(shared/mondai-note/mondai-note.css) ---------- */\n' + MN_CSS)
        js_all.append('<script>/* ===== C8 問題解決ノートの本体: データ(shared/mondai-note/mondai-note-data.js) ===== */\n' + MN_DATA + '</script>')
        js_all.append('<script>/* ===== C8 問題解決ノートの本体(shared/mondai-note/mondai-note.js) ===== */\n' + MN_JS + '</script>')
    css_all.append('/* ---------- C%d ---------- */\n%s' % (n, css.strip()))
    for i, code in enumerate(js):
        is_last = i == len(js) - 1
        if not is_last:
            # 共有コア(回路コア・機構コア・C6データ)は1回だけ入れる
            if code in seen_cores:
                continue
            seen_cores.add(code)
        else:
            # 自動起動は使わない(シェルが mount する)。念のため id を見つけても起動しないようにする
            code = must_replace(code, "var auto = document.getElementById('e%d-app');" % k, 'var auto = null;')
            if k in (3, 4):
                # 見えていない間はアニメーション・シミュレーションを止める(タブレットの電池と、見ていない間に時間が進むのを防ぐ)
                code = must_replace(code, '  S.raf = requestAnimationFrame(frame);\n  var dt',
                                    '  S.raf = requestAnimationFrame(frame);\n  if (S.root.offsetParent === null) { S.last = 0; return; }\n  var dt')
        js_all.append('<script>/* ===== C%d %s ===== */\n%s</script>' % (n, 'app' if is_last else 'core', code))

apps_json = json.dumps([{k: a[k] for k in ('id', 'icon', 'name', 'short', 'color', 'sub', 'tags')} for a in H.APPS], ensure_ascii=False)
shell = open(os.path.join(HERE, 'shell.html'), encoding='utf-8').read()
html = (ef_inline(shell).replace('{{APP_CSS}}', '\n'.join(css_all))
        .replace('{{APP_JS}}', '\n'.join(js_all))
        .replace('{{APPS_JSON}}', apps_json)
        .replace('{{HELP_STUDENT}}', H.student_html())
        .replace('{{HELP_TEACHER}}', H.teacher_html(True)))
assert '{{' not in html
os.makedirs(OUT, exist_ok=True)
open(os.path.join(OUT, 'energy-apps.html'), 'w', encoding='utf-8').write(html)

# 説明ファイル(印刷して配れる単独のHTML)
doc = open(os.path.join(HERE, 'tsukaikata.tpl.html'), encoding='utf-8').read()
doc = ef_inline(doc).replace('{{HELP_STUDENT}}', H.student_html()).replace('{{HELP_TEACHER}}', H.teacher_html(False))
assert '{{' not in doc
os.makedirs(DOCS, exist_ok=True)
open(os.path.join(DOCS, 'tsukaikata.html'), 'w', encoding='utf-8').write(doc)

# 先生用ガイド(4分野で名前・章立て・見た目をそろえたもの。本文は tsukaikata.html の先生向けと同じ)
guide = open(os.path.join(HERE, 'sensei-guide.tpl.html'), encoding='utf-8').read()
guide = ef_inline(guide).replace('{{GUIDE_TOC}}', H.guide_toc()).replace('{{GUIDE_SECTIONS}}', H.guide_html())
assert '{{' not in guide
open(os.path.join(DOCS, '先生用ガイド.html'), 'w', encoding='utf-8').write(guide)

readme = open(os.path.join(HERE, 'README.txt'), encoding='utf-8').read().replace('{{VERSION}}', VERSION).replace('{{UPDATED}}', UPDATED)
assert '{{' not in readme

zp = os.path.join(OUT, 'energy-apps.zip')
if os.path.exists(zp):
    os.remove(zp)
# zip の中のフォルダ名・ファイル名(energy-apps/energy-apps.html)は、生徒・先生が使っている配布物の名前なので変えない
with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED) as z:
    z.write(os.path.join(OUT, 'energy-apps.html'), 'energy-apps/energy-apps.html')
    z.write(os.path.join(DOCS, 'tsukaikata.html'), 'energy-apps/tsukaikata.html')
    z.write(os.path.join(DOCS, '先生用ガイド.html'), 'energy-apps/先生用ガイド.html')
    # Windows のメモ帳で文字化けしないよう、先頭に BOM を付けて改行を CRLF にする
    z.writestr('energy-apps/README.txt', ('\ufeff' + readme).replace('\n', '\r\n').encode('utf-8'))
print('version', VERSION, 'html', len(html.encode()), 'zip', os.path.getsize(zp))
