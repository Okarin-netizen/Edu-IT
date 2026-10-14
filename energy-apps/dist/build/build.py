# -*- coding: utf-8 -*-
"""E1〜E5 を1つのHTMLに統合し、使い方と一緒に配布用zipにする。元ファイルは読むだけ。"""
import json, os, re, sys, zipfile
sys.path.insert(0, os.path.dirname(__file__))
import help as H

# 元ファイルの場所。作業用コピーでビルドするときは EA_SRC=<フォルダ> を付けて実行する(出力は SRC/dist)
SRC = os.environ.get('EA_SRC', '/mnt/project-files/energy-apps')
OUT = os.path.join(SRC, 'dist')
HERE = os.path.dirname(os.path.abspath(__file__))


def parts(n):
    s = open('%s/E%d/index.html' % (SRC, n), encoding='utf-8').read()
    css = re.findall(r'<style>(.*?)</style>', s, re.S)
    js = re.findall(r'<script>(.*?)</script>', s, re.S)
    assert len(css) == 1, n
    return css[0], js


def must_replace(text, old, new, count=1):
    assert text.count(old) == count, (old, text.count(old))
    return text.replace(old, new)


css_all, js_all = [], []
seen_cores = set()
for n in range(1, 6):
    css, js = parts(n)
    # 各アプリの html,body 指定はシェルが持つので外す(印刷用の指定は残す)
    css = must_replace(css, re.search(r'^html,body\{[^}]*\}\n', css, re.M).group(0), '')
    if n in (3, 4):
        # 印刷時に他アプリの印刷範囲まで隠さないよう、表示中のアプリだけに効かせる
        css = must_replace(css, '  body *{visibility:hidden}', '  body.ea-on-E%d *{visibility:hidden}' % n)
        css = must_replace(css, '  .e%d-printarea,.e%d-printarea *{visibility:visible}' % (n, n),
                           '  body.ea-on-E%d .e%d-printarea,body.ea-on-E%d .e%d-printarea *{visibility:visible}' % (n, n, n, n))
    css_all.append('/* ---------- E%d ---------- */\n%s' % (n, css.strip()))
    for i, code in enumerate(js):
        is_last = i == len(js) - 1
        if not is_last:
            # 共有コア(回路コア・機構コア・E4データ)は1回だけ入れる
            if code in seen_cores:
                continue
            seen_cores.add(code)
        else:
            # 自動起動は使わない(シェルが mount する)。念のため id を見つけても起動しないようにする
            code = must_replace(code, "var auto = document.getElementById('e%d-app');" % n, 'var auto = null;')
            if n in (3, 4):
                # 見えていない間はアニメーション・シミュレーションを止める(タブレットの電池と、見ていない間に時間が進むのを防ぐ)
                code = must_replace(code, '  S.raf = requestAnimationFrame(frame);\n  var dt',
                                    '  S.raf = requestAnimationFrame(frame);\n  if (S.root.offsetParent === null) { S.last = 0; return; }\n  var dt')
        js_all.append('<script>/* ===== E%d %s ===== */\n%s</script>' % (n, 'app' if is_last else 'core', code))

apps_json = json.dumps([{k: a[k] for k in ('id', 'icon', 'name', 'short', 'color', 'sub', 'tags')} for a in H.APPS], ensure_ascii=False)
shell = open(os.path.join(HERE, 'shell.html'), encoding='utf-8').read()
html = (shell.replace('{{APP_CSS}}', '\n'.join(css_all))
        .replace('{{APP_JS}}', '\n'.join(js_all))
        .replace('{{APPS_JSON}}', apps_json)
        .replace('{{HELP_STUDENT}}', H.student_html())
        .replace('{{HELP_TEACHER}}', H.teacher_html(True)))
assert '{{' not in html
os.makedirs(OUT, exist_ok=True)
open(os.path.join(OUT, 'energy-apps.html'), 'w', encoding='utf-8').write(html)

# 説明ファイル(印刷して配れる単独のHTML)
doc = open(os.path.join(HERE, 'tsukaikata.tpl.html'), encoding='utf-8').read()
doc = doc.replace('{{HELP_STUDENT}}', H.student_html()).replace('{{HELP_TEACHER}}', H.teacher_html(False))
open(os.path.join(OUT, 'tsukaikata.html'), 'w', encoding='utf-8').write(doc)

readme = open(os.path.join(HERE, 'README.txt'), encoding='utf-8').read()

zp = os.path.join(OUT, 'energy-apps.zip')
if os.path.exists(zp):
    os.remove(zp)
with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED) as z:
    z.write(os.path.join(OUT, 'energy-apps.html'), 'energy-apps/energy-apps.html')
    z.write(os.path.join(OUT, 'tsukaikata.html'), 'energy-apps/tsukaikata.html')
    z.writestr('energy-apps/README.txt', ('﻿' + readme).replace('\n', '\r\n').encode('utf-8'))
print('html', len(html.encode()), 'zip', os.path.getsize(zp))
