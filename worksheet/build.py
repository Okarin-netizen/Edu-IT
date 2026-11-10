#!/usr/bin/env python3
"""ワークシート(生徒用)と、その答え(先生用)を作る。実行: python3 worksheet/build.py  → worksheet/dist/

教科書の節ごとに1枚。1つの編(G・A・B・C・D と、統合的な問題解決・学習を終えての Z)につき1ファイルで、上のボタンで節をえらぶ。
タブレットで書きこむ(この端末に自動で保存)か、B5 に印刷して紙で使う。学習コースの節の画面の「まとめ」からも開ける(#節の id)。
1枚の中身は、学習コースの節の画面と同じ5手順: 教科書をひらく(ページ・キーワード・図)→ まず考えよう → やってみる → たしかめ → まとめ。
  節・ページ・キーワード・図: T-textbook/course-data.js   まず考えよう: shared/eduit-frame.js の LETS
  やってみる・たしかめ: 各分野の eduit-info.js の jishu(sec にその節の id が付いた手順と問題)
自習ガイドや節のデータを直したら、これをもう一度実行する(クラスルーム配布/まとめる.py も実行する)。
"""
import html, json, pathlib, re, subprocess

here = pathlib.Path(__file__).resolve().parent
repo = here.parent
dist = here / "dist"
proc = subprocess.run(["node", str(here / "extract.cjs")], capture_output=True, text=True, encoding="utf-8")
if proc.returncode != 0:
    # extract.cjs のエラー(jishu の記号がメニューにない など)を、そのまま見せて止める
    raise SystemExit(f"extract.cjs でエラーになりました:\n{proc.stderr.strip()}")
DATA = json.loads(proc.stdout)
DOMAINS, COURSE, CAPPS, LETS = DATA["domains"], DATA["course"], DATA["courseApps"], DATA["lets"]

# 生徒に配るファイルの名前(クラスルーム配布/生徒に配る/ワークシート/)。T-textbook/index.html の WS・site/build.py の WS と同じ
FILES = {"G": "G_技術分野のガイダンス_ワークシート.html", "A": "A_材料と加工_ワークシート.html", "B": "B_生物育成_ワークシート.html",
         "C": "C_エネルギー変換_ワークシート.html", "D": "D_情報の技術_ワークシート.html", "Z": "Z_学習を終えて_ワークシート.html"}
TITLE = {"G": "技術分野のガイダンス", "A": "1編 材料と加工の技術", "B": "2編 生物育成の技術", "C": "3編 エネルギー変換の技術",
         "D": "4編 情報の技術", "Z": "統合的な問題解決・学習を終えて"}
COURSE_FILE = "教科書の順に進む_学習コース.html"   # 生徒に配る/ にある。ワークシートは 生徒に配る/ワークシート/
ANSWERS = "ワークシートの答え.html"
KANA = "アイウエオカキク"
# 生徒用サイト(site/build.py)は、この印を入口へもどるリンクに、学習コースへのリンクを公開用の名前に書きかえる
SITE_HOME = "<!--site-home-->"
XFILE = {"1編": "A", "2編": "B", "3編": "C", "4編": "D"}   # 付録 発展編の章 → ファイル


def e(s):
    return html.escape(str(s), quote=True)


def read(p):
    return p.read_text(encoding="utf-8")


# ふりがな: 自習ガイドと同じ、各分野の eduit-info.js の jishu.ruby(shared/jishu-ruby.py で作る)。
# 分野の表には、その分野の文の中だけの読み(「次の→じの」など)があるので、文ごとにその文が来た分野の表を使う
RUBY = {d["domain"]: d.get("ruby") or {} for d in DOMAINS}
RX = {k: (re.compile("|".join(map(re.escape, sorted(t, key=len, reverse=True)))) if t else None) for k, t in RUBY.items()}
KJ = re.compile(r"[一-鿿々〆]")


def r(s, dom=None):
    """文に <ruby> を付けて HTML にする(言葉の中のかなのところには付けない)。dom はその文が来た分野(G・A〜D・M・F・Z)"""
    s = str(s)
    rx = RX.get(dom)
    if not rx:
        return e(s)
    table, out, last = RUBY[dom], [], 0
    for m in rx.finditer(s):
        out.append(e(s[last:m.start()]))
        k, rd = m.group(0), table[m.group(0)]
        parts = re.findall(r"[一-鿿々〆]+|[^一-鿿々〆]+", k)
        mm = re.fullmatch("".join("(.+?)" if KJ.match(p) else "(" + re.escape(p) + ")" for p in parts), rd)
        pairs = [(p, mm.group(i + 1) if KJ.match(p) else None) for i, p in enumerate(parts)] if mm else [(k, rd)]
        out.append("".join(f"<ruby>{e(p)}<rt>{e(x)}</rt></ruby>" if x else e(p) for p, x in pairs))
        last = m.end()
    out.append(e(s[last:]))
    return "".join(out)


def secs_of(v):
    return v if isinstance(v, list) else ([v] if v else [])


# 節の id → その節の手順・問題(どの分野の、どの教材のものか)
STEPS, CHECKS = {}, {}
for d in DOMAINS:
    for a in d["apps"]:
        for s in a.get("steps") or []:
            for sid in secs_of(s.get("sec")):
                STEPS.setdefault(sid, []).append((d["domain"], a, s))
        for q in a.get("check") or []:
            for sid in secs_of(q.get("sec")):
                CHECKS.setdefault(sid, []).append((d["domain"], a, q))


def box(key, label, ph, rows=2):
    return (f'<div class="ws-box" contenteditable="true" role="textbox" aria-multiline="true" data-k="{key}" '
            f'aria-label="{e(label)}" data-ph="{e(ph)}" style="--rows:{rows}"></div>')


def chk(k):
    return (f'<label class="ws-chk"><input type="checkbox" data-k="{k}"><span class="ws-chk-mark" aria-hidden="true"></span>'
            f'<span class="ws-sr">できた</span></label>')


def app_tag(a):
    lab = a.get("label") or a["code"]
    return f'<span class="ws-app">{e(lab)}</span>'


def sheet(sec, fkey, group):
    sid = sec["id"]
    pg = f'教科書 p.{e(sec["p"])}' if sec.get("p") else ""
    n = 0

    def h3(t, small=""):
        nonlocal n
        n += 1
        return f'<h3><span class="ws-n">{n}</span>{t}{" <small>" + small + "</small>" if small else ""}</h3>'

    parts = []
    # 1 教科書をひらく
    open_ = [f'<p class="ws-do">{pg}{"(" + e(sec["pnote"]) + ")" if sec.get("pnote") else ""} をひらこう。</p>'] if pg else []
    if sec.get("kw"):
        rows = "".join(f'<li class="ws-kw"><span class="ws-kw-w">{e(k)}</span>{box(f"k{i}", k + " の意味", "意味を書こう", 1)}</li>' for i, k in enumerate(sec["kw"]))
        open_.append(f'<p class="ws-lbl">キーワード: 教科書で見つけて、意味を書こう。</p><ol class="ws-kws">{rows}</ol>')
    if sec.get("fig"):
        open_.append(f'<p class="ws-lbl">教科書の {e(sec["fig"])} と、教材の画面をくらべよう。にているところ・ちがうところは?</p>{box("fig", "図とくらべて", "", 2)}')
    if open_:
        parts.append(h3("教科書をひらく") + "".join(open_))
    # 2 まず考えよう
    L = LETS.get(sid)
    if L:
        parts.append(h3("まず考えよう", "教材をひらく前に") + f'<p class="ws-do">{e(L["q"])}</p>{box("lets", "まず考えよう", L.get("hint", ""), 2)}')
    # 3 やってみる
    st = STEPS.get(sid, [])
    if st:
        lis = "".join(f'<li class="ws-step">{chk(f"c{i}")}<div class="ws-step-main"><p class="ws-do">{app_tag(a)}<span class="ws-where">{r(s.get("where", ""), dom)}</span> {r(s.get("do", ""), dom)}</p>'
                      f'{box(f"s{i}", (s.get("where") or "") + " でわかったこと", "結果・わかったこと・気づいたこと", 1)}</div></li>' for i, (dom, a, s) in enumerate(st))
        parts.append(h3("やってみる", "終わったら□に✓") + f'<ol class="ws-steps">{lis}</ol>')
    else:
        apps = "・".join(e(g[0] if not CAPPS.get(g[0], {}).get("tag") else CAPPS[g[0]]["tag"]) + " " + e(CAPPS.get(g[0], {}).get("name", "")) + (f"({e(g[1])})" if len(g) > 1 and g[1] else "") for g in sec.get("go", []))
        parts.append(h3("やってみる") + f'<p class="ws-do">{apps} を使おう。</p>{box("s0", "やってみてわかったこと", "結果・わかったこと・気づいたこと", 3)}')
    # 4 たしかめ
    qs = CHECKS.get(sid, [])
    if qs:
        li = []
        for qi, (dom, a, q) in enumerate(qs):
            ch = "".join(f'<label class="ws-choice"><input type="radio" name="{sid}-q{qi}" value="{ci}" data-k="q{qi}">'
                         f'<span class="ws-kana">{KANA[ci]}</span><span>{r(t, dom)}</span></label>' for ci, t in enumerate(q["choices"]))
            li.append(f'<li class="ws-q"><p>{r(q["q"], dom)}</p><div class="ws-choices">{ch}</div></li>')
        parts.append(h3("たしかめ", "正しいものを1つえらぼう(紙なら記号に○)") + f'<ol class="ws-qs">{"".join(li)}</ol>')
    # 5 まとめ
    rate = [("r0", "ねらいが分かった"), ("r1", "教科書と教材を見くらべながら進められた"), ("r2", "たしかめの答えの理由が言える")]
    rows = "".join(f'<tr><th scope="row">{t}</th>' + "".join(
        f'<td><label><input type="radio" name="{sid}-{k}" value="{v}" data-k="{k}"><span>{v}</span></label></td>' for v in "◎○△") + "</tr>"
        for k, t in rate)
    kwh = f'キーワード({"・".join(sec["kw"][:3])} など)を1つ使って書こう' if sec.get("kw") else "ねらいの言葉を使って書こう"
    parts.append(h3("まとめ") + f'''<p class="ws-lbl">この節で分かったことを、自分の言葉で書こう。</p>{box("f0", "この節で分かったこと", kwh, 3)}
<table class="ws-rate"><thead><tr><th scope="col">自己評価</th><th scope="col">◎ よくできた</th><th scope="col">○ できた</th><th scope="col">△ もう少し</th></tr></thead><tbody>{rows}</tbody></table>
<p class="ws-lbl">まだ分からないこと・先生に聞きたいこと</p>{box("f1", "まだ分からないこと・先生に聞きたいこと", "", 2)}''')
    long = " ws-long" if len(st) >= 6 else ""
    return f'''<section class="ws{long}" id="{sid}" data-code="{sid}" data-title="{e(sec["ref"])} {e(sec["name"])}" aria-labelledby="{sid}-h">
<header class="ws-head">
<h2 id="{sid}-h"><span class="ws-code">{e(sec["ref"])}</span>{e(sec["name"])}<span class="ws-kind">{e(group)}{" " + pg if pg else ""}</span></h2>
<div class="ws-who"><label>組<input type="text" data-w="kumi" inputmode="numeric" size="2"></label><label>番<input type="text" data-w="ban" inputmode="numeric" size="2"></label><label class="ws-name">名前<input type="text" data-w="name"></label><label>日付<input type="text" data-k="date" size="5"></label></div>
</header>
<p class="ws-goal"><b>ねらい</b>{e(sec.get("aim", ""))}</p>
{"".join(parts)}
</section>'''


def file_secs():
    """ファイルの記号 → [(組の名前, ボタンの字, 節)]。学習のまとめ(ws: false の教材だけの節)は入れない"""
    out = {k: [] for k in FILES}
    for part in COURSE:
        for c in part["chapters"]:
            for i, s in enumerate(c["secs"]):
                if all(CAPPS.get(g[0], {}).get("ws") is False for g in s.get("go", [])):
                    continue
                if part["key"] == "X":
                    k, grp, lab = XFILE[c["ch"]], "発展", str(sum(1 for x in out[XFILE[c["ch"]]] if x[0] == "発展") + 1)
                elif part["key"] in ("I", "Z"):
                    k, grp, lab = "Z", part["title"], str(i + 1)
                else:
                    k, grp, lab = part["key"], c["ch"] or "", str(i + 1)
                out[k].append((grp, lab, s))
    return out

STYLE = r"""
  body { margin: 0; background: var(--ef-bg); color: var(--ef-text); font-family: var(--ef-font); line-height: 1.6; }
  .ws-bar { position: sticky; top: 0; z-index: 5; }
  .ws-pick { position: relative; display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 14px; background: var(--ef-surface); border-bottom: var(--ef-bw) solid var(--ef-ink); }
  .ws-pick .ef-btn { min-width: 2.6em; padding: 0 10px; }
  .ws-grp { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
  .ws-grp + .ws-grp { margin-left: 10px; }
  .ws-grp-l { font-size: 13px; color: var(--ef-muted); margin-right: 2px; }
  .ws-pick .ef-btn[aria-selected="true"] { font-weight: 700; box-shadow: inset 0 calc(-1 * var(--ef-mark)) 0 var(--ef-accent); }
  main { max-width: 860px; margin: 0 auto; padding: 16px 16px 48px; }
  .ws-intro { margin: 0 0 14px; padding: 10px 16px; background: var(--ef-surface); border: var(--ef-bw) solid var(--ef-line); border-radius: 0; font-size: 15px; }
  .ws-intro p { margin: .2em 0; }
  .ws { display: none; background: var(--ef-surface); border: var(--ef-bw) solid var(--ef-line); border-radius: 0; padding: 18px 22px 22px; box-shadow: none; }
  .ws.is-current { display: block; }
  .ws-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 6px 16px; border-bottom: var(--ef-bw-strong) solid var(--ef-ink); padding-bottom: 8px; }
  .ws-head h2 { margin: 0; font-size: 21px; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; }
  .ws-code { display: inline-block; padding: 0 .45em; border-radius: 0; background: var(--ef-accent); color: var(--ef-accent-ink); }
  .ws-kind { font-size: 14px; font-weight: 400; color: var(--ef-muted); }
  .ws-who { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 14px; }
  .ws-who label { display: inline-flex; align-items: baseline; gap: 4px; }
  .ws-who input { font: inherit; font-size: 16px; border: 0; border-bottom: var(--ef-bw) solid var(--ef-ink); background: transparent; padding: 2px 4px; width: 3em; }
  .ws-who .ws-name input { width: 9em; }
  .ws-goal { margin: 12px 0 6px; padding: 8px 12px; background: var(--ef-surface); border-left: var(--ef-mark) solid var(--ef-accent); border-radius: 0; }
  .ws-goal b { margin-right: .6em; }
  .ws-app { display: inline-block; margin-right: .4em; padding: 0 .4em; background: var(--ef-ink); color: var(--ef-on-ink); font-size: 12px; font-weight: 700; vertical-align: 1px; }
  .ws-kws { margin: 4px 0 0; padding: 0; list-style: none; }
  .ws-kw { display: grid; grid-template-columns: minmax(6em, max-content) 1fr; gap: 8px; align-items: end; padding: 3px 0; }
  .ws-kw .ws-box { margin-top: 0; }
  .ws-kw-w { font-weight: 700; }
  .ws h3 { margin: 18px 0 6px; font-size: 17px; display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 8px; }
  .ws h3 small { font-size: 13px; font-weight: 400; color: var(--ef-muted); }
  .ws-n { display: inline-flex; justify-content: center; min-width: 1.6em; border-radius: 50%; background: var(--ef-ink); color: var(--ef-on-ink); font-size: 14px; line-height: 1.6em; }
  .ws-adv .ws-n { background: var(--ef-advanced); }
  .ws-steps, .ws-qs { margin: 0; padding: 0; list-style: none; }
  .ws-step { display: flex; gap: 10px; padding: 8px 0; border-top: 1px dashed var(--ef-line); }
  .ws-step:first-child { border-top: 0; }
  .ws-chk { flex: 0 0 auto; position: relative; width: 30px; height: 30px; margin-top: 1px; cursor: pointer; }
  .ws-chk input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
  .ws-chk-mark { position: absolute; inset: 2px; border: var(--ef-bw-strong) solid var(--ef-ink); border-radius: 0; background: var(--ef-surface); }
  .ws-chk input:checked + .ws-chk-mark { background: var(--ef-accent); border-color: var(--ef-accent); }
  .ws-chk input:checked + .ws-chk-mark::after { content: "✓"; position: absolute; inset: 0; color: var(--ef-accent-ink); font-weight: 700; font-size: 19px; line-height: 24px; text-align: center; }
  .ws-chk input:focus-visible + .ws-chk-mark { outline: 3px solid var(--ef-focus); outline-offset: 1px; }
  .ws-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .ws-step-main { flex: 1 1 auto; min-width: 0; }
  .ws-do { margin: 0; }
  .ws-where { display: inline-block; margin-right: .5em; padding: 0 .5em; border: var(--ef-bw) solid var(--ef-accent); border-radius: 0; color: var(--ef-accent); font-weight: 700; font-size: 14px; }
  .ws-tag { display: inline-block; margin-right: .4em; padding: 0 .45em; border-radius: 0; background: var(--ef-surface-2); border: var(--ef-bw) solid var(--ef-line); font-size: 12px; font-weight: 700; vertical-align: 1px; }
  .ws-tag-r { background: var(--ef-warn-soft); border-color: var(--ef-warn); }
  .ws-box { --line: 1.9em; margin-top: 6px; min-height: calc(var(--line) * var(--rows, 2)); padding: 0 8px; line-height: var(--line);
    border: var(--ef-bw) solid var(--ef-ink); border-radius: 0; white-space: pre-wrap; overflow-wrap: anywhere; outline: none;
    background: var(--ef-surface) repeating-linear-gradient(to bottom, transparent 0, transparent calc(var(--line) - 1px), var(--ef-line) calc(var(--line) - 1px), var(--ef-line) var(--line)); background-attachment: local;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .ws-box:focus { outline: 3px solid var(--ef-focus); outline-offset: 1px; }
  .ws-box:empty::before { content: attr(data-ph); color: var(--ef-muted); font-size: 14px; }
  .ws-q { padding: 8px 0; border-top: 1px dashed var(--ef-line); counter-increment: q; }
  .ws-q:first-child { border-top: 0; }
  .ws-q > p { margin: 0 0 4px; }
  .ws-q > p::before { content: "問" counter(q) " "; font-weight: 700; }
  .ws-qs { counter-reset: q; }
  .ws-choices { display: flex; flex-wrap: wrap; gap: 6px 10px; }
  .ws-choice { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 4px 12px 4px 6px; border: var(--ef-bw) solid var(--ef-line); border-radius: 0; cursor: pointer; }
  .ws-choice input, .ws-rate input { position: absolute; opacity: 0; width: 1px; height: 1px; }
  .ws-kana { display: inline-flex; justify-content: center; align-items: center; width: 1.7em; height: 1.7em; border: var(--ef-bw) solid var(--ef-ink); border-radius: 50%; font-weight: 700; flex: 0 0 auto; }
  .ws-choice:has(input:checked) { border-color: var(--ef-ink); font-weight: 700; box-shadow: inset 0 calc(-1 * var(--ef-mark)) 0 var(--ef-accent); }
  .ws-choice:has(input:checked) .ws-kana { background: var(--ef-ink); border-color: var(--ef-ink); color: var(--ef-on-ink); }
  .ws-choice:has(input:focus-visible), .ws-rate label:has(input:focus-visible) { outline: 3px solid var(--ef-focus); }
  .ws-rate { width: 100%; border-collapse: collapse; font-size: 14px; }
  .ws-rate th, .ws-rate td { border: 1px solid var(--ef-line); padding: 4px 8px; }
  .ws-rate thead th { background: var(--ef-surface-2); font-weight: 600; }
  .ws-rate tbody th { text-align: left; font-weight: 400; }
  .ws-rate td { text-align: center; width: 15%; }
  .ws-rate label { display: inline-flex; justify-content: center; align-items: center; width: 40px; height: 36px; border-radius: 0; cursor: pointer; font-size: 18px; color: var(--ef-line); }
  .ws-rate label:has(input:checked) { background: var(--ef-ink); color: var(--ef-on-ink); }
  .ws-two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; margin-top: 10px; }
  .ws-lbl { margin: 0; font-size: 14px; font-weight: 600; }
  .ws-saved { font-size: 13px; color: var(--ef-muted); }
  .ws rt { font-size: .55em; font-weight: 400; }
  .ws-noruby .ws rt { display: none; }
  @media (max-width: 640px) {
    .ws-pick { flex-wrap: nowrap; overflow-x: auto; }
    .ws-grp { flex-wrap: nowrap; flex: none; }
    .ws-kw { grid-template-columns: 1fr; gap: 2px; }
    main { padding: 10px 8px 40px; }
    .ws { padding: 12px 12px 16px; }
    .ws-head h2 { font-size: 18px; }
    .ws-two { grid-template-columns: 1fr; }
    .ws-rate th, .ws-rate td { padding: 3px 4px; }
  }
  @page { size: 182mm 257mm; margin: 8mm 9mm; }  /* B5(JIS)たて */
  @media print {
    html, body { background: var(--ef-bg); }
    body { font-size: 10pt; line-height: 1.4; }
    .ws rt { font-size: .5em; }
    .ws-goal { margin: 8px 0 4px; padding: 5px 10px; }
    .ws-bar, .ws-intro, [data-ef-footer], .ef-footer { display: none !important; }
    main { max-width: none; padding: 0; }
    .ws { border: 0; box-shadow: none; padding: 0; border-radius: 0; }
    body.print-all .ws { display: block; break-after: page; }
    body.print-all .ws:last-of-type { break-after: auto; }
    .ws h3 { margin: 9px 0 3px; font-size: 12pt; break-after: avoid; }
    .ws-step, .ws-q, .ws-rate, .ws-two { break-inside: avoid; }
    .ws-step { padding: 4px 0; }
    .ws-box { --line: 7mm; margin-top: 3px; }
    .ws-long .ws-box { --line: 5.5mm; }
    .ws-long .ws-choice { padding: 0 6px 0 3px; }
    .ws-long .ws-rate label { height: 4.5mm; }
    .ws-long .ws-step { padding: 2px 0; }
    .ws-long .ws-q { padding: 3px 0; }
    .ws-box:empty::before { content: none; }
    .ws-choice { min-height: 0; padding: 2px 8px 2px 4px; }
    .ws-rate label { height: 5.5mm; color: var(--ef-muted); }
    .ws-rate th, .ws-rate td { padding: 1px 6px; }
    .ws-two .ws-box, .ws-tag-r ~ .ws-box, .ws-step-main .ws-box[style*="--rows:3"] { --rows: 2 !important; }
    .ws h3 { margin: 6px 0 2px; }
    .ws-head, .ws-goal, .ws-code, .ws-n, .ws-chk-mark, .ws-rate label, .ws-choice, .ws-kana { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
"""

SCRIPT = r"""
(function () {
  var KEY = 'eduit.ws.v2.', WHO = 'eduit.ws.v1.who';
  function load(k) {  // こわれた値(オブジェクトでないもの)は空にする
    try { var v = JSON.parse(localStorage.getItem(k) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch (e) { return {}; }
  }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  // ふりがな(はじめは付いている。この端末で覚える)
  var RB = 'eduit.ws.ruby', rb = document.getElementById('ws-ruby');
  function rubyOn() { try { return localStorage.getItem(RB) !== 'off'; } catch (e) { return true; } }
  function rubyShow() { var on = rubyOn(); document.body.classList.toggle('ws-noruby', !on); rb.setAttribute('aria-pressed', String(on)); }
  rb.addEventListener('click', function () { try { localStorage.setItem(RB, rubyOn() ? 'off' : 'on'); } catch (e) {} rubyShow(); });
  rubyShow();
  var sheets = Array.prototype.slice.call(document.querySelectorAll('.ws'));
  var who = load(WHO);
  sheets.forEach(function (ws) {
    var code = ws.getAttribute('data-code'), st = load(KEY + code);
    function put() { save(KEY + code, st); }
    ws.querySelectorAll('[data-k]').forEach(function (el) {
      var k = el.getAttribute('data-k');
      if (el.type === 'checkbox') {
        el.checked = !!st[k];
        el.addEventListener('change', function () { st[k] = el.checked; put(); });
      } else if (el.type === 'radio') {
        el.checked = st[k] === el.value;
        el.addEventListener('change', function () { if (el.checked) { st[k] = el.value; put(); } });
      } else if (el.tagName === 'INPUT') {
        el.value = st[k] || '';
        el.addEventListener('input', function () { st[k] = el.value; put(); });
      } else {
        el.textContent = st[k] || '';
        el.addEventListener('input', function () {
          st[k] = el.innerText.replace(/\n$/, '');
          if (!st[k]) el.innerHTML = '';  // 空にしたら、うすい字の案内をまた出す
          put();
        });
        el.addEventListener('paste', function (ev) {  // 文字だけをはりつける
          ev.preventDefault();
          var t = (ev.clipboardData || window.clipboardData).getData('text');
          document.execCommand('insertText', false, t);
        });
      }
    });
    // 組・番・名前は、どのワークシートでも同じ(どこかで入れると全部に入る)
    ws.querySelectorAll('[data-w]').forEach(function (el) {
      var k = el.getAttribute('data-w');
      el.value = who[k] || '';
      el.addEventListener('input', function () {
        who[k] = el.value; save(WHO, who);
        document.querySelectorAll('[data-w="' + k + '"]').forEach(function (o) { if (o !== el) o.value = el.value; });
      });
    });
  });
  // 節をえらぶ(アドレスの #a12 などでも開ける)
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.ws-pick [data-code]'));
  function show(code, scroll) {
    // ワークシート(.ws)の中からさがす(#ws-print など、ほかの要素の id がアドレスにあっても取りちがえない)
    var ws = sheets.filter(function (s) { return s.id === code; })[0] || sheets[0];
    sheets.forEach(function (s) { s.classList.toggle('is-current', s === ws); });
    tabs.forEach(function (t) { var on = t.getAttribute('data-code') === ws.id; t.setAttribute('aria-selected', String(on));
      if (on) { var nav = t.closest('.ws-pick'); if (nav.scrollWidth > nav.clientWidth) nav.scrollLeft = Math.max(0, t.offsetLeft - nav.clientWidth / 2); } });
    document.title = ws.getAttribute('data-title') + ' ワークシート';
    var op = document.getElementById('ws-open'); op.href = op.getAttribute('data-base') + '#s=' + ws.id;
    // Claude のプレビューなど about:srcdoc で開くとアドレスを書きかえられないので、失敗しても止めない
    if (location.hash.slice(1) !== ws.id) { try { history.replaceState(null, '', '#' + ws.id); } catch (e) {} }
    if (scroll) window.scrollTo(0, 0);
  }
  tabs.forEach(function (t) { t.addEventListener('click', function () { show(t.getAttribute('data-code'), true); }); });
  window.addEventListener('hashchange', function () { show(location.hash.slice(1)); });
  show(location.hash.slice(1));
  document.getElementById('ws-print').addEventListener('click', function () { document.body.classList.remove('print-all'); window.print(); });
  document.getElementById('ws-print-all').addEventListener('click', function () { document.body.classList.add('print-all'); window.print(); });
  window.addEventListener('afterprint', function () { document.body.classList.remove('print-all'); });
  document.getElementById('ws-clear').addEventListener('click', function () {
    var ws = document.querySelector('.ws.is-current');
    if (!confirm(ws.getAttribute('data-title') + ' のワークシートに書いたことと ✓ を消します。よいですか?(組・番・名前は残ります)')) return;
    try { localStorage.removeItem(KEY + ws.id); } catch (e) {}
    location.reload();
  });
})();
"""


def area_page(k, items):
    groups, pick = [], []
    for grp, lab, s in items:
        if not groups or groups[-1][0] != grp:
            groups.append((grp, []))
        groups[-1][1].append(f'<button type="button" class="ef-btn" role="tab" data-code="{s["id"]}" aria-controls="{s["id"]}" title="{e(s["ref"])} {e(s["name"])}">{e(lab)}</button>')
    for grp, bs in groups:
        pick.append(f'<div class="ws-grp">{"<span class=" + chr(34) + "ws-grp-l" + chr(34) + ">" + e(grp) + "</span>" if grp else ""}{"".join(bs)}</div>')
    sheets = "\n".join(sheet(s, k, grp) for grp, lab, s in items)
    return f'''<!doctype html>
<html lang="ja" data-ef-domain="{k}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(TITLE[k])} ワークシート</title>
<!-- worksheet/build.py が T-textbook/course-data.js と各分野の eduit-info.js の jishu から作ったファイル。直接直さない -->
<style>
{read(repo / "shared/eduit-frame.css")}
</style>
<style>{STYLE}</style>
</head>
<body class="ef-page">
<div class="ws-bar">
<header class="ef-header">
{SITE_HOME}<h1 class="ef-title"><span class="ef-code">{k}</span> {e(TITLE[k])} ワークシート</h1>
<div class="ef-tools">
<button type="button" class="ef-btn ef-toggle" id="ws-ruby" aria-pressed="true">ふりがな</button>
<a class="ef-btn" id="ws-open" href="../{COURSE_FILE}" data-base="../{COURSE_FILE}" target="_blank" rel="noopener">この節をひらく</a>
<button type="button" class="ef-btn" id="ws-print">印刷</button>
</div>
</header>
<nav class="ws-pick" role="tablist" aria-label="教科書の節をえらぶ">{"".join(pick)}</nav>
</div>
<main>
<div class="ws-intro">
<p><b>使い方</b> 上の番号で、教科書の節をえらびます(1枚が1つの節)。□を押すと✓が付き、わくの中に書きこめます。書いたことは<b>この端末に自動で保存</b>されます。紙で使うときは「印刷」を押します(用紙は <b>B5 たて</b>)。</p>
<p>「この節をひらく」を押すと、学習コースのこの節の画面がちがうタブで開きます。教科書・教材・ワークシートを行き来して進めましょう。</p>
<p class="ws-saved">先生に出すときは、先生の指示を聞きます。<button type="button" class="ef-btn" id="ws-print-all">全部の節を印刷</button> <button type="button" class="ef-btn" id="ws-clear">この節の書いたことを消す</button></p>
</div>
{sheets}
</main>
<script>{SCRIPT}</script>
</body>
</html>
'''


def answers_page(by_file):
    secs = []
    for k, items in by_file.items():
        arts = []
        for grp, lab, s in items:
            qs = CHECKS.get(s["id"], [])
            if not qs:
                continue
            li = "".join(f'<li><p class="q">{e(q["q"])}</p><p class="a"><b>{KANA[q["answer"]]}</b> {e(q["choices"][q["answer"]])}</p>'
                         f'<p class="x">{e(q.get("explain", ""))}</p></li>' for dom, a, q in qs)
            arts.append(f'<article><h3><span class="c">{e(s["ref"])}</span>{e(s["name"])}</h3><ol>{li}</ol></article>')
        secs.append(f'<section><h2>{k} {e(TITLE[k])}<small>生徒のファイル: {FILES[k]}</small></h2>{"".join(arts)}</section>')
    return f'''<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ワークシートの答え(先生用)</title>
<!-- worksheet/build.py が作ったファイル。直接直さない -->
<style>
{read(repo / "shared/eduit-frame.css")}
</style>
<style>
  body {{ margin: 0; background: var(--ef-bg); color: var(--ef-text); font-family: var(--ef-font); line-height: 1.6; }}
  main {{ max-width: 980px; margin: 0 auto; padding: 18px 16px 40px; }}
  .lead {{ background: var(--ef-surface); border: var(--ef-bw) solid var(--ef-line); border-radius: 0; padding: 10px 18px; }}
  h2 {{ margin: 26px 0 8px; font-size: 20px; border-bottom: var(--ef-bw-strong) solid var(--ef-ink); display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 14px; }}
  h2 small {{ font-size: 13px; font-weight: 400; color: var(--ef-muted); }}
  article {{ background: var(--ef-surface); border: var(--ef-bw) solid var(--ef-line); border-radius: 0; padding: 8px 16px; margin: 8px 0; break-inside: avoid; }}
  h3 {{ margin: 0 0 4px; font-size: 16px; }}
  .c {{ display: inline-block; margin-right: .5em; padding: 0 .4em; border-radius: 0; background: var(--ef-ink); color: var(--ef-on-ink); }}
  ol {{ margin: 0; padding-left: 1.6em; }}
  li p {{ margin: 0; }}
  .a b {{ display: inline-flex; justify-content: center; width: 1.6em; border-radius: 50%; background: var(--ef-ok); color: var(--ef-on-ink); }}
  .x {{ color: var(--ef-muted); font-size: 14px; margin-bottom: 4px; }}
  @media print {{ body {{ background: var(--ef-bg); font-size: 10pt; }} .lead {{ border: 0; padding: 0; }} }}
</style>
</head>
<body>
<header class="ef-header"><h1 class="ef-title">ワークシートの答え(先生用)</h1></header>
<main>
<div class="lead">
<p>生徒に配る/ワークシート/ のワークシートの「たしかめ」の答えと解説です。教科書の節ごとに1枚で、問題は学習コースの節の画面の「たしかめ」と同じです(ワークシートには答えを出していません)。</p>
<p>1枚は、教科書をひらく(ページ・キーワードの意味・図とくらべる)→ まず考えよう → やってみる → たしかめ → まとめ(分かったことと ◎○△ の自己評価)の順です。生徒はタブレットで書きこむ(その端末に保存)か、B5 に印刷して紙で使います。</p>
</div>
{"".join(secs)}
</main>
</body>
</html>
'''


by_file = file_secs()
dist.mkdir(exist_ok=True)
for old in dist.glob("*.html"):
    old.unlink()
for k, items in by_file.items():
    (dist / FILES[k]).write_text(area_page(k, items), encoding="utf-8")
(dist / ANSWERS).write_text(answers_page(by_file), encoding="utf-8")
for p in sorted(dist.glob("*.html")):
    print(f"{p.relative_to(repo)}  ({p.stat().st_size // 1024} KB)")
