#!/usr/bin/env python3
"""生徒の画面の説明が長すぎないかを調べる(教科書との見直し計画 6章のきまり)。

出すもの(教材ごとに):
  - 4文以上のかたまり(1つの文字列・1つの段落に、文が4つ以上ある)
  - 45字をこえる文

調べる文:
  - 各分野の eduit-info.js の levels(lead)と jishu(goal・steps の do と hint・check の q と explain)
  - 教材の HTML・JS の中の、日本語の文字列と、<p>・<li> などの文

使い方:
  python3 shared/text-check.py                 # すべての分野
  python3 shared/text-check.py A-materials     # 1つのフォルダだけ
  python3 shared/text-check.py --sum           # 教材ごとの数だけ
  python3 shared/text-check.py --len 50        # 50字をこえる文だけ
  python3 shared/text-check.py --raw           # かたまりを、ファイルの中の形のまま全部出す(直すとき用)

数え方:
  - ふりがなの {漢字|よみ} は漢字だけを数える。HTML のタグ・<rt> は数えない。
  - 文は「。」「!」「?」(全角も)で区切る。かっこの中の「。」では区切らない。
  - 先生用のファイル(docs/・先生用・teacher)・テスト・dist・倉庫 は見ない。
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AREAS = ['G-guidance', 'A-materials', 'B-bio', 'C-energy', 'D-information', 'T-textbook']
SKIP_DIRS = {'dist', 'docs', 'tests', 'test', 'node_modules', 'review', 'build', 'tools', 'icons', '倉庫', 'teacher-viewer', '_site'}
SKIP_FILE = re.compile(r'先生|teacher|test|\.min\.|ruby-words|ruby-dict|terms-data|sw\.js$|vite|jishu-ruby')
JP = re.compile(r'[ぁ-んァ-ヶ一-鿿]')
LONG = 45
MANY = 4


def plain(s):
    s = re.sub(r'\{([^{}|]+)\|[^{}]*\}', r'\1', s)          # {漢字|よみ}
    s = re.sub(r'<rt>.*?</rt>|<rp>.*?</rp>', '', s)
    s = re.sub(r'<[^>]+>', '', s)
    s = re.sub(r'\\n|\\u[0-9a-fA-F]{4}', '', s)
    s = re.sub(r'&[a-z]+;|&#\d+;', ' ', s)
    s = re.sub(r'\$\{[^}]*\}', '〇', s)
    return re.sub(r'\s+', ' ', s).strip()


def sentences(s):
    out, cur, depth = [], '', 0
    for ch in s:
        cur += ch
        if ch in '(「『【[(':
            depth += 1
        elif ch in ')」』】])' and depth:
            depth -= 1
        elif ch in '。!?！？' and depth == 0:
            out.append(cur.strip())
            cur = ''
    if cur.strip():
        out.append(cur.strip())
    return [x for x in out if JP.search(x)]


STR = re.compile(r"'((?:[^'\\\n]|\\.)*)'|\"((?:[^\"\\\n]|\\.)*)\"|`((?:[^`\\]|\\.)*)`")
BLOCK = re.compile(r'<(p|li|dd|h[1-6]|summary)\b[^>]*>(.*?)</\1>', re.S)
NESTED = re.compile(r'<(p|div|li|ul|ol|label|input|select|textarea|button|table|section|h[1-6])\b')
HIRA = re.compile(r'[ぁ-ん]')


def blank_history(src):
    """history: [ … ] を、かっこの対応で見つけて空白にする(行の数は変えない)"""
    i = src.find('history: [')
    while i >= 0:
        j, depth = src.index('[', i), 0
        for k in range(j, len(src)):
            if src[k] == '[':
                depth += 1
            elif src[k] == ']':
                depth -= 1
                if depth == 0:
                    break
        src = src[:i] + re.sub(r'[^\n]', ' ', src[i:k + 1]) + src[k + 1:]
        i = src.find('history: [', k)
    return src


def chunks(path):
    """(行, 文字列) を出す"""
    src = open(path, encoding='utf-8', errors='replace').read()
    seen = set()
    if os.path.basename(path) == 'eduit-info.js':
        # 先生向けの所(更新履歴 history・判定の理由 why・学習指導要領 curr)は見ない。行の数は変えない
        src = blank_history(src)
        src = re.sub(r"(why|curr): '(?:[^'\\\n]|\\.)*'", lambda m: ' ' * len(m.group(0)), src)
    if path.endswith('.html'):
        for m in BLOCK.finditer(src):
            if NESTED.search(m.group(2)):
                continue
            t = plain(m.group(2))
            if JP.search(t) and t not in seen:
                seen.add(t)
                yield src.count('\n', 0, m.start()) + 1, t, m.group(2)
    for m in STR.finditer(src):
        raw = m.group(1) or m.group(2) or m.group(3) or ''
        if not HIRA.search(raw) or "','" in raw:
            continue
        t = plain(raw)
        if t and t not in seen:
            seen.add(t)
            yield src.count('\n', 0, m.start()) + 1, t, raw


def files(top):
    for d, ds, fs in os.walk(top):
        ds[:] = sorted(x for x in ds if x not in SKIP_DIRS and not x.startswith('.'))
        for f in sorted(fs):
            if f.endswith(('.html', '.js', '.mjs', '.json')) and not SKIP_FILE.search(f):
                yield os.path.join(d, f)


def main():
    args = sys.argv[1:]
    only_sum = '--sum' in args
    show_raw = '--raw' in args  # 直すときに使う: 4文以上のかたまりを、ファイルの中の形(ふりがな・タグつき)のまま全部出す
    lim = LONG
    if '--len' in args:
        lim = int(args[args.index('--len') + 1])
    tops = [a for a in args if not a.startswith('--') and not a.isdigit()] or AREAS
    total_many = total_long = 0
    for top in tops:
        top = os.path.join(ROOT, top)
        for path in files(top):
            many, long = [], []
            for ln, t, raw in chunks(path):
                ss = sentences(t)
                if len(ss) >= MANY:
                    many.append((ln, len(ss), raw if show_raw else t))
                for x in ss:
                    if len(x) > lim:
                        long.append((ln, len(x), x))
            if not many and not long:
                continue
            total_many += len(many)
            total_long += len(long)
            rel = os.path.relpath(path, ROOT)
            print(f'## {rel}  ({MANY}文以上 {len(many)}・{lim}字こえ {len(long)})')
            if only_sum:
                continue
            for ln, n, t in many:
                print(f'  {ln}: [{n}文] {t if show_raw else t[:120] + ("…" if len(t) > 120 else "")}')
            for ln, n, x in long:
                print(f'  {ln}: ({n}字) {x}')
    print(f'\n合計: {MANY}文以上のかたまり {total_many}・{lim}字をこえる文 {total_long}')


if __name__ == '__main__':
    main()
