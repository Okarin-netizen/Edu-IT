#!/usr/bin/env python3
"""教材の見た目が「枠の決まり」に合っているかを調べる(見た目の設定をそろえる計画 4-5)。

色・文字・余白・線の値は shared/eduit-frame.css のいちばん上(設定)にだけ書き、
教材の CSS はその名前(--ef-…)と共通の部品を使う、というきまりに合わない所を出す。

出すもの(ファイル名と行番号つき):
  color     色の値(#fff・rgb() など)を直に書いている
            (図の色は、教材の CSS のいちばん上で --fig-… の名前を付けて書けばよい)
  radius    角丸(border-radius が 0 でない。丸い点・つまみの 50% は別)
  shadow    落ちる影(box-shadow・text-shadow・filter: drop-shadow)
            (ON の印の下線 box-shadow: inset 0 calc(-1 * var(--ef-mark)) 0 … は影ではないのでよい)
  font      font-family を書いている(--ef-font・--ef-mono を使う)
  important !important(display の !important は、隠す・印刷で出す切りかえなのでよい)
  oldvar    --ef-・--fig-・--app- 以外の名前の変数を使っている(--ink・--b1-ink など分野ごとの古い名前)
            (--app-… は、JS がはかった高さなど教材の中だけの寸法。色は入れない)
  fontpx    文字の大きさを px で書いている(rem・em なら文字の大きさのボタンで大きくなる)
            (図の中の字(SVG の text。同じ行に fill・stroke・text-anchor を書いている所)は、図の大きさに合わせるので px でよい)

調べる所: 各分野の .css と、.html の <style> と style="…"。
  shared/eduit-frame.css(設定そのもの)・dist・倉庫・テスト・node_modules は見ない。
  本物に似せた画面など、きまりの外にしたい所は、CSS のコメントで
  /* style-check: off */ 〜 /* style-check: on */ ではさむ(ファイル全部なら先頭に off だけ書く)。

使い方:
  python3 shared/style-check.py                  # すべて(1件ずつ)
  python3 shared/style-check.py C-energy         # 1つのフォルダだけ
  python3 shared/style-check.py --sum            # ファイルごと・種類ごとの数だけ
  python3 shared/style-check.py --only color,radius
  python3 shared/style-check.py --strict         # 1件でもあれば終了コード 1(作り直しのコマンドの最後に)
"""
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AREAS = ['G-guidance', 'T-textbook', 'A-materials', 'B-bio', 'C-energy', 'D-information',
         'shared', 'worksheet', 'site', 'teacher-tools']
SKIP_DIRS = {'dist', 'node_modules', 'tests', 'test', '倉庫', '_site', '.git'}
SKIP_FILES = {os.path.join('shared', 'eduit-frame.css')}
KINDS = ['color', 'radius', 'shadow', 'font', 'important', 'oldvar', 'fontpx']

COLOR = re.compile(r'#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(')
# 色の名前(white・red など)。transparent・currentColor・inherit はよい
NAMED = re.compile(r'(?<![-\w])(?:white|black|red|green|blue|yellow|orange|gray|grey|navy|purple|pink|brown)(?![-\w])', re.I)
VAR_DEF = re.compile(r'^\s*--(?:fig|ef)-[\w-]+\s*:')
VAR_USE = re.compile(r'var\(\s*--([\w-]+)')
DECL = re.compile(r'([-\w]+)\s*:\s*([^;{}]*)')
SVG_TEXT = re.compile(r'(?:^|[;{\s])(?:fill|stroke|text-anchor)\s*:')
OFF = re.compile(r'style-check:\s*off')
ON = re.compile(r'style-check:\s*on')


def problems(prop, value, line):
    """1つの宣言(prop: value)の、きまりに合わない所の種類を返す。"""
    out = []
    p = prop.lower()
    v = value.strip()
    if '!important' in v:
        if p != 'display':
            out.append('important')
        v = v.replace('!important', '').strip()
    if p.startswith('--'):
        # 変数の定義: --fig-… / --ef-… なら色を書いてよい
        if not VAR_DEF.match(line) and (COLOR.search(v) or NAMED.search(v)):
            out.append('color')
        return out
    if COLOR.search(v) or (p not in ('font-family', 'font', 'content', 'grid-template-areas') and NAMED.search(v)):
        out.append('color')
    if p.startswith('border') and 'radius' in p:
        if not re.fullmatch(r'(0(px)?\s*)+|50%|inherit|var\(--ef-radius\)', v):
            out.append('radius')
    if p in ('box-shadow', 'text-shadow') and v not in ('none', '0', 'var(--ef-shadow)') and not re.match(r'inset 0 calc\(-1 \* var\(--ef-mark\)\) 0 ', v):
        out.append('shadow')
    if p == 'filter' and 'drop-shadow' in v:
        out.append('shadow')
    if p == 'font-family' and not v.startswith('var(--ef-') and v not in ('inherit',):
        out.append('font')
    if p == 'font' and re.search(r'[a-z]\w*[,"\']|serif|sans', v, re.I) and 'var(--ef-' not in v and v != 'inherit':
        out.append('font')
    if p in ('font-size', 'font') and re.search(r'\d(\.\d+)?px', v) and not SVG_TEXT.search(line):
        out.append('fontpx')
    for name in VAR_USE.findall(v):
        if not name.startswith(('ef-', 'fig-', 'app-')):
            out.append('oldvar')
            break
    return out


def css_chunks(path, text):
    """(行番号, CSS の文) を返す。HTML なら <style> の中と style="…" だけ。"""
    if path.endswith('.css'):
        yield 1, text
        return
    for m in re.finditer(r'<style[^>]*>(.*?)</style>', text, re.S | re.I):
        yield text.count('\n', 0, m.start(1)) + 1, m.group(1)
    for m in re.finditer(r'\sstyle="([^"]*)"', text):
        yield text.count('\n', 0, m.start(1)) + 1, m.group(1)


def check_file(path):
    rel = os.path.relpath(path, ROOT)
    with open(path, encoding='utf-8', errors='replace') as f:
        text = f.read()
    found = []
    for start, css in css_chunks(path, text):
        # コメントをのぞき、off 〜 on の間をとばす(行の数は変えない)
        off = False
        lines = css.split('\n')
        for i, line in enumerate(lines):
            if OFF.search(line):
                off = True
            if ON.search(line):
                off = False
            if off:
                continue
            body = re.sub(r'/\*.*?\*/', '', line)
            for m in DECL.finditer(body):
                prop, value = m.group(1), m.group(2)
                if prop.startswith('-') and not prop.startswith('--'):
                    prop = re.sub(r'^-\w+-', '', prop)  # -webkit-… など
                for kind in problems(prop, value, body):
                    found.append((kind, start + i, body.strip()))
    return rel, found


def pad(s, n):
    """全角の字を2つ分と数えて、n 文字分のはばにそろえる(表を出すとき)。"""
    w = sum(2 if unicodedata.east_asian_width(ch) in 'WF' else 1 for ch in s)
    return s + ' ' * max(n - w, 1)


def files(targets):
    for t in targets:
        base = os.path.join(ROOT, t)
        if os.path.isfile(base):
            yield base
            continue
        for d, dirs, fs in os.walk(base):
            dirs[:] = sorted(x for x in dirs if x not in SKIP_DIRS)
            for f in sorted(fs):
                if not f.endswith(('.css', '.html')):
                    continue
                p = os.path.join(d, f)
                if os.path.relpath(p, ROOT) in SKIP_FILES:
                    continue
                yield p


def main(argv):
    flags = {a for a in argv if a.startswith('--')}
    only = None
    if '--only' in argv:
        i = argv.index('--only')
        only = set(argv[i + 1].split(','))
        argv = argv[:i] + argv[i + 2:]
    targets = [a for a in argv if not a.startswith('--')] or AREAS
    total = Counter()
    per_file = defaultdict(Counter)
    for p in files(targets):
        rel, found = check_file(p)
        for kind, line, src in found:
            if only and kind not in only:
                continue
            total[kind] += 1
            per_file[rel][kind] += 1
            if '--sum' not in flags:
                print(f'{rel}:{line}: [{kind}] {src[:120]}')
    if '--sum' in flags:
        print(pad('ファイル', 60) + ' '.join(f'{k:>9}' for k in KINDS))
        for rel in sorted(per_file):
            c = per_file[rel]
            print(pad(rel, 60) + ' '.join(f'{c[k]:>9}' for k in KINDS))
    print('合計 ' + '・'.join(f'{k} {total[k]}' for k in KINDS) + f'(全部で {sum(total.values())} 件)')
    return 1 if '--strict' in flags and sum(total.values()) else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
