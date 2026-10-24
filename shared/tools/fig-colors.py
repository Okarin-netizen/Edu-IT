#!/usr/bin/env python3
"""図の色を --fig-… の名前にまとめる(見た目の設定をそろえる計画 4-3)。

教材の CSS の中で、図(SVG・canvas の絵)の色を直に書いている所(fill: #e35d3c など)を、
CSS のいちばん上の :root に --fig-… の名前を付けて書き、使う所は var(--fig-…) にする。
名前は、セレクタの最後のクラス名からつける(.f-cap の fill → --fig-cap、stroke → --fig-cap-line)。

使い方:
  python3 shared/tools/fig-colors.py A-materials/a6-tool-safety/style.css --from 87
    --from 行番号 … その行から下だけを書きかえる(画面の部品の色は、図ではないので共通の --ef-… に手で直す)
    --dry        … 書きかえずに、付ける名前の一覧だけを出す
同じ名前で色がちがうときは -2・-3 を付ける。同じ名前・同じ色は1つにまとめる。
"""
import re
import sys

COLOR = re.compile(r'#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?)\([^)]*\)|(?<![-\w])(?:white|black)(?![-\w])')
PROP_SUFFIX = {'fill': '', 'stroke': '-line', 'background': '', 'background-color': '', 'color': '-text', 'border-color': '-line'}


def name_for(selector, prop):
    classes = re.findall(r'\.([\w-]+)', selector.split(',')[0])
    base = classes[-1] if classes else re.sub(r'\W+', '-', selector.strip()).strip('-') or 'x'
    base = re.sub(r'^(f|k|fig|[a-z]\d+)-', '', base)  # 教材の頭の字(b1- など)は名前に入れない
    return 'fig-' + base + PROP_SUFFIX.get(prop, '-' + prop)


def main(argv):
    path = argv[0]
    start = int(argv[argv.index('--from') + 1]) if '--from' in argv else 1
    dry = '--dry' in argv
    lines = open(path, encoding='utf-8').read().split('\n')
    defs = {}      # name -> color
    order = []
    for i in range(start - 1, len(lines)):
        line = lines[i]
        if re.match(r'^\s*--', line) or '/*' in line and '*/' not in line:
            continue
        m = re.match(r'^(\s*)([^{}]*?)\{(.*)\}(\s*(?:/\*.*\*/)?\s*)$', line)
        if not m:
            continue
        indent, sel, body, tail = m.groups()

        def fix_decl(dm):
            prop, value = dm.group(1), dm.group(2)
            if prop.startswith('--') or not COLOR.search(value):
                return dm.group(0)
            base = name_for(sel, prop)
            n = 0

            def repl(cm):
                nonlocal n
                color = cm.group(0)
                name = base + ('' if n == 0 else '-' + str(n + 1))
                k = 2
                while name in defs and defs[name] != color:
                    name = base + '-' + str(k); k += 1
                if name not in defs:
                    defs[name] = color; order.append(name)
                n += 1
                return 'var(--' + name + ')'
            return prop + ':' + COLOR.sub(repl, value)
        new_body = re.sub(r'([-\w]+)\s*:([^;{}]*)', fix_decl, body)
        lines[i] = indent + sel + '{' + new_body + '}' + tail
    if not order:
        print('図の色の直書きはありません')
        return 0
    block = ['  --%s: %s;' % (n, defs[n]) for n in order]
    if dry:
        print('\n'.join(block))
        return 0
    # いちばん上の :root { … } の最後に足す(なければ最初のコメントのあとに作る)
    text = '\n'.join(lines)
    m = re.search(r':root\s*\{[^}]*\}', text)
    if m and text.index(m.group(0)) < 400 + text.find(':root'):
        inner = m.group(0)
        text = text.replace(inner, inner[:-1].rstrip() + '\n  /* 図の色(shared/tools/fig-colors.py でまとめた) */\n' + '\n'.join(block) + '\n}', 1)
    else:
        text = ':root {\n  /* 図の色(shared/tools/fig-colors.py でまとめた) */\n' + '\n'.join(block) + '\n}\n' + text
    open(path, 'w', encoding='utf-8').write(text)
    print(path + ': ' + str(len(order)) + ' 色に名前を付けた')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
