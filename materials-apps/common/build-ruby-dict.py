#!/usr/bin/env python3
"""ruby-dict.js(ふりがな辞書)を作る。

  python3 build-ruby-dict.py          ruby-dict-src.txt(手で書いた辞書)+ ruby-dict-auto.txt から作る
  python3 build-ruby-dict.py --scan   materials-apps 内の html/js の文章を読み、辞書にない語の読みを
                                      pykakasi で推定して ruby-dict-auto.txt に足してから作る
                                      (pip install pykakasi が必要。推定なので ruby-dict-auto.txt を見直すこと)
手で書いた辞書(src)が優先される。読みを直すときは src に書く。
"""
import json, os, re, sys
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(here)
KANJI = re.compile(r'[㐀-鿿々]')

def load(name):
    d = {}
    p = os.path.join(here, name)
    if not os.path.exists(p):
        return d
    for line in open(p, encoding='utf-8'):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        parts = line.split()
        if len(parts) != 2:
            raise SystemExit(name + ' の形式エラー: ' + line)
        if KANJI.search(parts[0]):
            d[parts[0]] = parts[1]
    return d

def scan(known):
    import pykakasi
    kks = pykakasi.kakasi()
    found = {}
    for dp, dn, fn in os.walk(root):
        for f in fn:
            if not f.endswith(('.html', '.js')) or f.startswith('ruby-dict') or f.endswith('.test.js'):
                continue
            text = open(os.path.join(dp, f), encoding='utf-8', errors='ignore').read()
            text = re.sub(r'/\*.*?\*/', ' ', text, flags=re.S)
            text = re.sub(r'(?m)^\s*//.*$', ' ', text)
            text = re.sub(r'<!--.*?-->', ' ', text, flags=re.S)
            for run in re.findall(r'[぀-ヿ㐀-鿿々ー]+', text):
                if not KANJI.search(run):
                    continue
                for seg in kks.convert(run):
                    w, r = seg['orig'], seg['hira']
                    if KANJI.search(w) and w not in known and w != r and re.fullmatch(r'[぀-ゟー]+', r):
                        found.setdefault(w, r)
    return found

src = load('ruby-dict-src.txt')
auto = load('ruby-dict-auto.txt')
if '--scan' in sys.argv:
    new = scan(set(src) | set(auto))
    if new:
        with open(os.path.join(here, 'ruby-dict-auto.txt'), 'a', encoding='utf-8') as fp:
            if not auto:
                fp.write('# 自動推定した読み(pykakasi)。まちがいは ruby-dict-src.txt に正しい読みを書くと上書きされる。\n')
            for w in sorted(new):
                fp.write(w + ' ' + new[w] + '\n')
        auto.update(new)
    print('scan: +', len(new))
d = dict(auto)
d.update(src)
out = ('/* 自動生成: ruby-dict-src.txt を編集して build-ruby-dict.py を実行してください */\n'
       'window.RUBY_DICT = ' + json.dumps(d, ensure_ascii=False, indent=0, sort_keys=True) + ';\n'
       'if (window.G && window.G.ruby) window.G.ruby.add(window.RUBY_DICT);\n')
open(os.path.join(here, 'ruby-dict.js'), 'w', encoding='utf-8').write(out)
print(len(d), 'words')
