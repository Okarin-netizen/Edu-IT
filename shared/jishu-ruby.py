#!/usr/bin/env python3
"""自習ガイドのふりがなを作る。実行: python3 shared/jishu-ruby.py   (確かめるだけ: --check)

自習ガイド(shared/eduit-frame.js)に出る文(各分野の eduit-info.js の jishu と、eduit-frame.js の決まった文)を
形態素解析(Sudachi)で読み、言葉と読みの表を、各 eduit-info.js のいちばん下に EDUIT_INFO.jishu.ruby として書きこむ。
自習ガイドは、この表で長い言葉から順にふりがなを付ける(ガイドの「ふりがな」ボタンで消せる)。

- jishu の文を直したら、これを実行しなおす(書きこむところは「自動で作る」の行から下。手で直さない)。
- Sudachi の読みがちがうときは、下の OVERRIDES に「言葉: 読み」を足して実行しなおす。
- 使う前に1回だけ: python3 -m pip install sudachipy sudachidict_core
"""
import json, pathlib, re, subprocess, sys
from collections import Counter

try:
    from sudachipy import dictionary, tokenizer
except ImportError:
    raise SystemExit("Sudachi がありません: python3 -m pip install sudachipy sudachidict_core")

repo = pathlib.Path(__file__).resolve().parent.parent
FILES = ["G-guidance/eduit-info.js", "A-materials/eduit-info.js", "B-bio/eduit-info.js", "C-energy/eduit-info.js",
         "D-information/eduit-info.js", "T-textbook/M-mimawari/eduit-info.js", "T-textbook/F-korekara/eduit-info.js",
         "T-textbook/Z-owari/eduit-info.js"]
MARK = "/* ---- 自習ガイドのふりがな(自動で作る: python3 shared/jishu-ruby.py。この行から下は手で直さない) ---- */"

# Sudachi の読みがこの教材に合わないもの(言葉: 読み)。送りがなで読みが変わる字は、送りがなまで入れる
OVERRIDES = {
    "節": "せつ", "実": "み", "種": "たね", "表": "ひょう", "入力": "にゅうりょく", "出力": "しゅつりょく",
}
# Sudachi のほうがまちがえる文(この言葉が入る文は、表の読みのままでよい)
ACCEPT = ["風と平行", "従動節", "お金", "日間", "7日すすめる", "1日すすめる"]
KANJI = re.compile(r"[一-鿿々〆]")
JP = re.compile(r"[ぁ-んァ-ヶー一-鿿々〆0-9０-９a-zA-Z]+")


def hira(s):
    return "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in s)


def strings_of(path):
    """eduit-info.js の jishu の文を全部取り出す(node で読む)"""
    js = r"""
const fs = require('fs'), vm = require('vm');
const ctx = { window: {}, document: { documentElement: { setAttribute() {} }, addEventListener() {}, querySelector() { return null; } } };
ctx.self = ctx.window; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(process.argv[1], 'utf8'), ctx);
const info = ctx.window.EDUIT_INFO || {}, J = info.jishu || {}, out = [];
const add = (s) => { if (typeof s === 'string') out.push(s); };
add(J.lead);
for (const a of Object.values(J.apps || {})) {
  add(a.goal); add(a.time);
  (a.steps || []).forEach((s) => { add(s.where); add(s.do); add(s.hint); });
  (a.check || []).forEach((c) => { add(c.q); (c.choices || []).forEach(add); add(c.explain); });
}
for (const a of Object.values(info.apps || {})) add(a && a.name);
add(info.app && info.app.name); add(info.name);
process.stdout.write(JSON.stringify(out));
"""
    r = subprocess.run(["node", "-e", js, str(path)], capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


def frame_strings():
    """eduit-frame.js の自習ガイドの部分に書いてある決まった文"""
    src = (repo / "shared/eduit-frame.js").read_text(encoding="utf-8")
    a, b = src.index("// ---- 自習ガイド"), src.index("function jishuMenuBox")
    return re.findall(r"'([^'\n]*[一-鿿][^'\n]*)'", src[a:b])


tok = dictionary.Dictionary().create()
MODE = tokenizer.Tokenizer.SplitMode.C


def segments(texts):
    segs = set()
    for t in texts:
        for m in JP.finditer(t):
            if KANJI.search(m.group(0)):
                segs.add(m.group(0))
    return sorted(segs)


def tokens(seg):
    """[(言葉, 読み)]。読みは Sudachi。「何」は、あとに を・が・に・も・か が続くときは「なに」にする"""
    out = []
    for m in tok.tokenize(seg, MODE):
        sf = m.surface()
        out.append([sf, hira(m.reading_form()) if KANJI.search(sf) else sf])
    for i, (sf, rd) in enumerate(out):
        if sf in OVERRIDES:
            out[i][1] = OVERRIDES[sf]
        if sf == "何" and i + 1 < len(out) and out[i + 1][0][:1] in "をがにもか":
            out[i][1] = "なに"
    return out


def reading(seg):
    return "".join(rd for sf, rd in tokens(seg))


def apply(table, seg):
    if not table:
        return seg
    rx = re.compile("|".join(map(re.escape, sorted(table, key=len, reverse=True))))
    return rx.sub(lambda m: table[m.group(0)], seg)


def ok(table, s):
    return hira(apply(table, s)) == hira(reading(s)) or any(a in s for a in ACCEPT)


def build(texts):
    segs = segments(texts)
    votes = {}
    for s in segs:
        for sf, rd in tokens(s):
            if KANJI.search(sf):
                votes.setdefault(sf, Counter())[rd] += 1
    table = {k: c.most_common(1)[0][0] for k, c in votes.items()}
    # 表で読んだ読みと、文ごとに読んだ読みがちがうところは、前(なければ次)の言葉とつなげた長い言葉を足す
    for _ in range(6):
        bad = 0
        for s in segs:
            if ok(table, s):
                continue
            bad += 1
            toks = tokens(s)
            for i, (sf, rd) in enumerate(toks):
                if not KANJI.search(sf) or table.get(sf) == rd:
                    continue
                # 前の言葉に漢字があれば前と、なければ次とつなげる(「の数」のような、かなで始まる言葉を作らない)
                j = i - 1 if i > 0 and KANJI.search(toks[i - 1][0]) else i + 1
                if j >= len(toks):
                    j = i - 1
                if j < 0:
                    continue
                a, b = sorted((i, j))
                table[toks[a][0] + toks[b][0]] = toks[a][1] + toks[b][1]
        if not bad:
            break
    # それでも合わない文は、文をまるごと言葉にする(ガイドでは、かなのところを分けてふりがなを付ける)
    for s in segs:
        if not ok(table, s):
            table[s] = reading(s)
    left = [(s, hira(apply(table, s)), reading(s)) for s in segs if not ok(table, s)]
    return dict(sorted(table.items())), left, len(segs)


def write(path, table):
    src = path.read_text(encoding="utf-8")
    if MARK in src:
        src = src[:src.index(MARK)].rstrip() + "\n"
    body = ",\n".join("  " + json.dumps(k, ensure_ascii=False) + ": " + json.dumps(v, ensure_ascii=False) for k, v in table.items())
    src += "\n" + MARK + "\nwindow.EDUIT_INFO.jishu.ruby = {\n" + body + "\n};\n"
    path.write_text(src, encoding="utf-8")


check = "--check" in sys.argv
fixed = frame_strings()
for f in FILES:
    p = repo / f
    table, left, n = build(strings_of(p) + fixed)
    print(f"{f}: 言葉 {len(table)}・文 {n}・Sudachi と読みがちがう文 {len(left)}")
    for s, mine, theirs in left:
        print(f"    {s} | {mine} | {theirs}")
    if not check:
        write(p, table)
