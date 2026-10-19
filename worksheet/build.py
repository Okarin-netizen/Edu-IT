#!/usr/bin/env python3
"""自習ワークシート(生徒用)と、その答え(先生用)を作る。実行: python3 worksheet/build.py  → worksheet/dist/

1つの分野につき1ファイル(A_材料と加工_ワークシート.html など)で、中に教材ごとのワークシートが1枚ずつ入っている。
上のボタンで教材をえらび、タブレットで書きこむ(この端末に自動で保存)か、印刷して紙で使う。
中身のもとは各分野の eduit-info.js の jishu(自習ガイドと同じ ねらい・進め方・たしかめ問題)。
自習ガイドを直したら、これをもう一度実行する(クラスルーム配布/まとめる.py も実行する)。
"""
import html, json, pathlib, subprocess

here = pathlib.Path(__file__).resolve().parent
repo = here.parent
dist = here / "dist"
data = json.loads(subprocess.run(["node", str(here / "extract.cjs")], check=True, capture_output=True, text=True).stdout)

# 生徒に配るファイルの名前(クラスルーム配布/生徒に配る/ワークシート/)と、そこから見た自習用の統一版
FILES = {"G": "G_技術分野のガイダンス_ワークシート.html", "A": "A_材料と加工_ワークシート.html", "B": "B_生物育成_ワークシート.html", "C": "C_エネルギー変換_ワークシート.html", "D": "D_情報の技術_ワークシート.html"}
UNIFIED = {"G": "G_技術分野のガイダンス.html", "A": "A_材料と加工_統一版.html", "B": "B_生物育成_統一版.html", "C": "C_エネルギー変換_統一版.html", "D": "D_情報の技術_統一版.html"}
ANSWERS = "ワークシートの答え.html"
KANA = "アイウエオカキク"
# 生徒用サイト(site/build.py)は、この印を入口へもどるリンクに、教材へのリンクを公開用の名前に書きかえる
SITE_HOME = "<!--site-home-->"


def e(s):
    return html.escape(str(s), quote=True)


def read(p):
    return p.read_text(encoding="utf-8")


def is_submit(s):
    """記録を書き出して出すだけの手順(書く欄はいらない)"""
    return not s.get("reflect") and any(w in s["do"] for w in ("ファイル", "先生の言"))


def box(key, label, ph, rows=2):
    return (f'<div class="ws-box" contenteditable="true" role="textbox" aria-multiline="true" data-k="{key}" '
            f'aria-label="{e(label)}" data-ph="{e(ph)}" style="--rows:{rows}"></div>')


def step_li(i, s):
    if is_submit(s):
        tail = '<span class="ws-tag">提出</span>'
        body = ""
    elif s.get("reflect"):
        tail = '<span class="ws-tag ws-tag-r">まとめ</span>'
        body = box(f"s{i}", f"{s['where']} のまとめ", "画面に書いたまとめ・ふりかえりから、いちばん大事なことを写そう", 3)
    else:
        tail = ""
        body = box(f"s{i}", f"{s['where']} でわかったこと", "結果・わかったこと・気づいたこと", 2)
    return (f'<li class="ws-step"><label class="ws-chk"><input type="checkbox" data-k="c{i}"><span class="ws-chk-mark" aria-hidden="true"></span>'
            f'<span class="ws-sr">できた</span></label><div class="ws-step-main"><p class="ws-do"><span class="ws-where">{e(s["where"])}</span>{tail} '
            f'{e(s["do"])}</p>{body}</div></li>')


def sheet(d, a):
    c = a["code"]
    if d["domain"] == "G":  # ガイダンスは教材が1つだけで、メニュー(カード)がない
        how = f'タブレットで「{e(d["domainName"])}」を<b>自習モード</b>でひらき、上のタブを「はじめに」から順に進めます。'
    else:
        how = f'タブレットで「{e(d["domainName"])} 教材集」を<b>自習モード</b>でひらき、<b>{c} のカード</b>を押します。'
    steps = list(enumerate(a["steps"]))
    basic = [step_li(i, s) for i, s in steps if s.get("level") != "advanced"]
    adv = [step_li(i, s) for i, s in steps if s.get("level") == "advanced"]
    qs = []
    for qi, q in enumerate(a.get("check") or []):
        ch = "".join(f'<label class="ws-choice"><input type="radio" name="{c}-q{qi}" value="{ci}" data-k="q{qi}">'
                     f'<span class="ws-kana">{KANA[ci]}</span>{e(t)}</label>' for ci, t in enumerate(q["choices"]))
        qs.append(f'<li class="ws-q"><p>{e(q["q"])}</p><div class="ws-choices">{ch}</div></li>')
    rate = [("r0", "ねらいが分かった"), ("r1", "自習ガイドを見ながら、自分で進められた"), ("r2", "たしかめ問題の答えの理由が言える")]
    rows = "".join(f'<tr><th scope="row">{t}</th>' + "".join(
        f'<td><label><input type="radio" name="{c}-{k}" value="{v}" data-k="{k}"><span>{v}</span></label></td>' for v in "◎○△") + "</tr>"
        for k, t in rate)
    n = 1
    parts = [f'<h3><span class="ws-n">{n}</span>進め方(基本) <small>終わったら□に✓</small></h3><ol class="ws-steps">{"".join(basic)}</ol>']
    if adv:
        n += 1
        parts.append(f'<h3 class="ws-adv"><span class="ws-n">{n}</span>発展 <small>基本が終わって、時間があったら</small></h3><ol class="ws-steps">{"".join(adv)}</ol>')
    if qs:
        n += 1
        parts.append(f'<h3><span class="ws-n">{n}</span>たしかめ問題 <small>正しいものを1つえらぼう(紙なら記号に○)</small></h3><ol class="ws-qs">{"".join(qs)}</ol>')
    n += 1
    parts.append(f'''<h3><span class="ws-n">{n}</span>ふりかえり</h3>
<table class="ws-rate"><thead><tr><th scope="col">自己評価</th><th scope="col">◎ よくできた</th><th scope="col">○ できた</th><th scope="col">△ もう少し</th></tr></thead><tbody>{rows}</tbody></table>
<div class="ws-two">
<div><p class="ws-lbl">きょう分かったこと(ねらいについて、自分の言葉で)</p>{box("f0", "きょう分かったこと", "", 3)}</div>
<div><p class="ws-lbl">まだ分からないこと・先生に聞きたいこと</p>{box("f1", "まだ分からないこと・先生に聞きたいこと", "", 3)}</div>
</div>''')
    return f'''<section class="ws" id="{c}" data-code="{c}" aria-labelledby="{c}-h">
<header class="ws-head">
<h2 id="{c}-h"><span class="ws-code">{c}</span>{e(a["name"])}<span class="ws-kind">自習ワークシート</span></h2>
<div class="ws-who"><label>組<input type="text" data-w="kumi" inputmode="numeric" size="2"></label><label>番<input type="text" data-w="ban" inputmode="numeric" size="2"></label><label class="ws-name">名前<input type="text" data-w="name"></label><label>日付<input type="text" data-k="date" size="5"></label></div>
</header>
<p class="ws-goal"><b>ねらい</b>{e(a["goal"])}<span class="ws-time">目安 {e(a.get("time", ""))}</span></p>
<p class="ws-how">{how}右はしの「自習ガイド」でヒントを見たり、「この場所へ ▶」で移ったりしながら進めましょう。</p>
{"".join(parts)}
</section>'''


STYLE = r"""
  body { margin: 0; background: var(--ef-bg); color: var(--ef-text); font-family: var(--ef-font); line-height: 1.6; }
  .ws-bar { position: sticky; top: 0; z-index: 5; }
  .ws-pick { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 14px; background: var(--ef-surface-2); border-bottom: 1px solid var(--ef-line); }
  .ws-pick .ef-btn { min-width: 3.4em; padding: 0 12px; }
  .ws-pick .ef-btn[aria-selected="true"] { background: var(--ef-accent); border-color: var(--ef-accent); color: var(--ef-accent-ink); }
  .ws-pick-all { margin-left: auto; }
  main { max-width: 860px; margin: 0 auto; padding: 16px 16px 48px; }
  .ws-intro { margin: 0 0 14px; padding: 10px 16px; background: var(--ef-surface); border: 1px solid var(--ef-line); border-radius: var(--ef-radius); font-size: 15px; }
  .ws-intro p { margin: .2em 0; }
  .ws { display: none; background: #fff; border: 1px solid var(--ef-line); border-radius: var(--ef-radius); padding: 18px 22px 22px; box-shadow: var(--ef-shadow); }
  .ws.is-current { display: block; }
  .ws-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 6px 16px; border-bottom: 3px solid var(--ef-accent); padding-bottom: 8px; }
  .ws-head h2 { margin: 0; font-size: 21px; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; }
  .ws-code { display: inline-block; padding: 0 .45em; border-radius: 6px; background: var(--ef-accent); color: var(--ef-accent-ink); }
  .ws-kind { font-size: 14px; font-weight: 400; color: var(--ef-muted); }
  .ws-who { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 14px; }
  .ws-who label { display: inline-flex; align-items: baseline; gap: 4px; }
  .ws-who input { font: inherit; font-size: 16px; border: 0; border-bottom: 1.5px solid #555; background: transparent; padding: 2px 4px; width: 3em; }
  .ws-who .ws-name input { width: 9em; }
  .ws-goal { margin: 12px 0 6px; padding: 8px 12px; background: var(--ef-accent-soft); border-radius: var(--ef-radius-s); }
  .ws-goal b { margin-right: .6em; color: var(--ef-accent); }
  .ws-time { float: right; margin-left: 1em; font-size: 14px; color: var(--ef-muted); }
  .ws-how { margin: 6px 0 4px; font-size: 14px; color: var(--ef-muted); }
  .ws h3 { margin: 18px 0 6px; font-size: 17px; display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 8px; }
  .ws h3 small { font-size: 13px; font-weight: 400; color: var(--ef-muted); }
  .ws-n { display: inline-flex; justify-content: center; min-width: 1.6em; border-radius: 50%; background: var(--ef-text); color: #fff; font-size: 14px; line-height: 1.6em; }
  .ws-adv .ws-n { background: #5b3fa8; }
  .ws-steps, .ws-qs { margin: 0; padding: 0; list-style: none; }
  .ws-step { display: flex; gap: 10px; padding: 8px 0; border-top: 1px dashed var(--ef-line); }
  .ws-step:first-child { border-top: 0; }
  .ws-chk { flex: 0 0 auto; position: relative; width: 30px; height: 30px; margin-top: 1px; cursor: pointer; }
  .ws-chk input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
  .ws-chk-mark { position: absolute; inset: 2px; border: 2px solid #444; border-radius: 4px; background: #fff; }
  .ws-chk input:checked + .ws-chk-mark { background: var(--ef-accent); border-color: var(--ef-accent); }
  .ws-chk input:checked + .ws-chk-mark::after { content: "✓"; position: absolute; inset: 0; color: #fff; font-weight: 700; font-size: 19px; line-height: 24px; text-align: center; }
  .ws-chk input:focus-visible + .ws-chk-mark { outline: 3px solid var(--ef-focus); outline-offset: 1px; }
  .ws-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .ws-step-main { flex: 1 1 auto; min-width: 0; }
  .ws-do { margin: 0; }
  .ws-where { display: inline-block; margin-right: .5em; padding: 0 .5em; border: 1.5px solid var(--ef-accent); border-radius: 6px; color: var(--ef-accent); font-weight: 700; font-size: 14px; }
  .ws-tag { display: inline-block; margin-right: .4em; padding: 0 .45em; border-radius: 6px; background: #eceae4; font-size: 12px; font-weight: 700; vertical-align: 1px; }
  .ws-tag-r { background: #fde9c8; }
  .ws-box { --line: 1.9em; margin-top: 6px; min-height: calc(var(--line) * var(--rows, 2)); padding: 0 8px; line-height: var(--line);
    border: 1.5px solid #9a968c; border-radius: 6px; white-space: pre-wrap; overflow-wrap: anywhere; outline: none;
    background: #fff repeating-linear-gradient(to bottom, transparent 0, transparent calc(var(--line) - 1px), #e2dfd7 calc(var(--line) - 1px), #e2dfd7 var(--line)); background-attachment: local;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .ws-box:focus { border-color: var(--ef-accent); box-shadow: 0 0 0 3px var(--ef-accent-soft); }
  .ws-box:empty::before { content: attr(data-ph); color: #9a968c; font-size: 14px; }
  .ws-q { padding: 8px 0; border-top: 1px dashed var(--ef-line); counter-increment: q; }
  .ws-q:first-child { border-top: 0; }
  .ws-q > p { margin: 0 0 4px; }
  .ws-q > p::before { content: "問" counter(q) " "; font-weight: 700; }
  .ws-qs { counter-reset: q; }
  .ws-choices { display: flex; flex-wrap: wrap; gap: 6px 10px; }
  .ws-choice { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 4px 12px 4px 6px; border: 1.5px solid var(--ef-line); border-radius: 8px; cursor: pointer; }
  .ws-choice input, .ws-rate input { position: absolute; opacity: 0; width: 1px; height: 1px; }
  .ws-kana { display: inline-flex; justify-content: center; align-items: center; width: 1.7em; height: 1.7em; border: 1.5px solid #444; border-radius: 50%; font-weight: 700; flex: 0 0 auto; }
  .ws-choice:has(input:checked) { border-color: var(--ef-accent); background: var(--ef-accent-soft); }
  .ws-choice:has(input:checked) .ws-kana { background: var(--ef-accent); border-color: var(--ef-accent); color: #fff; }
  .ws-choice:has(input:focus-visible), .ws-rate label:has(input:focus-visible) { outline: 3px solid var(--ef-focus); }
  .ws-rate { width: 100%; border-collapse: collapse; font-size: 14px; }
  .ws-rate th, .ws-rate td { border: 1px solid var(--ef-line); padding: 4px 8px; }
  .ws-rate thead th { background: var(--ef-surface-2); font-weight: 600; }
  .ws-rate tbody th { text-align: left; font-weight: 400; }
  .ws-rate td { text-align: center; width: 15%; }
  .ws-rate label { display: inline-flex; justify-content: center; align-items: center; width: 40px; height: 36px; border-radius: 8px; cursor: pointer; font-size: 18px; color: #bbb; }
  .ws-rate label:has(input:checked) { background: var(--ef-accent); color: #fff; }
  .ws-two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; margin-top: 10px; }
  .ws-lbl { margin: 0; font-size: 14px; font-weight: 600; }
  .ws-saved { font-size: 13px; color: var(--ef-muted); }
  @media (max-width: 640px) {
    .ws-pick { flex-wrap: nowrap; overflow-x: auto; }
    .ws-pick-all { margin-left: 0; }
    main { padding: 10px 8px 40px; }
    .ws { padding: 12px 12px 16px; }
    .ws-head h2 { font-size: 18px; }
    .ws-two { grid-template-columns: 1fr; }
    .ws-time { float: none; display: block; margin: 0; }
    .ws-rate th, .ws-rate td { padding: 3px 4px; }
  }
  @page { size: A4 portrait; margin: 11mm 12mm; }
  @media print {
    body { background: #fff; font-size: 10.5pt; line-height: 1.45; }
    .ws-bar, .ws-intro, [data-ef-footer], .ef-footer { display: none !important; }
    main { max-width: none; padding: 0; }
    .ws { border: 0; box-shadow: none; padding: 0; border-radius: 0; }
    body.print-all .ws { display: block; break-after: page; }
    body.print-all .ws:last-of-type { break-after: auto; }
    .ws h3 { margin: 9px 0 3px; font-size: 12pt; break-after: avoid; }
    .ws-step, .ws-q, .ws-rate, .ws-two { break-inside: avoid; }
    .ws-step { padding: 4px 0; }
    .ws-box { --line: 7.5mm; }
    .ws-box:empty::before { content: none; }
    .ws-choice { min-height: 0; padding: 2px 8px 2px 4px; }
    .ws-rate label { height: 7mm; color: #888; }
    .ws-head, .ws-goal, .ws-code, .ws-n, .ws-chk-mark, .ws-rate label, .ws-choice, .ws-kana { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
"""

SCRIPT = r"""
(function () {
  var KEY = 'eduit.ws.v1.', WHO = 'eduit.ws.v1.who';
  function load(k) { try { return JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (e) { return {}; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
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
  // 教材をえらぶ(アドレスの #A2 などでも開ける)
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.ws-pick [data-code]'));
  function show(code, scroll) {
    var ws = document.getElementById(code) || sheets[0];
    sheets.forEach(function (s) { s.classList.toggle('is-current', s === ws); });
    tabs.forEach(function (t) { t.setAttribute('aria-selected', String(t.getAttribute('data-code') === ws.id)); });
    document.title = ws.id + ' ' + ws.querySelector('h2').textContent.replace(/^(?:[A-D]\d+|G)/, '').replace('自習ワークシート', '') + ' 自習ワークシート';
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
    if (!confirm(ws.id + ' のワークシートに書いたことと ✓ を消します。よいですか?(組・番・名前は残ります)')) return;
    try { localStorage.removeItem(KEY + ws.id); } catch (e) {}
    location.reload();
  });
})();
"""


def area_page(d):
    k = d["domain"]
    pick = "".join(f'<button type="button" class="ef-btn" role="tab" data-code="{a["code"]}" aria-controls="{a["code"]}" title="{e(a["name"])}">{a["code"]}</button>' for a in d["apps"])
    sheets = "\n".join(sheet(d, a) for a in d["apps"])
    return f'''<!doctype html>
<html lang="ja" data-ef-domain="{k}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(d["domainName"])} 自習ワークシート</title>
<!-- worksheet/build.py が各分野の eduit-info.js の jishu から作ったファイル。直接直さない -->
<style>
{read(repo / "shared/eduit-frame.css")}
</style>
<style>{STYLE}</style>
</head>
<body class="ef-page">
<div class="ws-bar">
<header class="ef-header">
{SITE_HOME}<h1 class="ef-title"><span class="ef-code">{k}</span> {e(d["domainName"])} 自習ワークシート</h1>
<div class="ef-tools">
<a class="ef-btn" id="ws-open" href="../自習用/{UNIFIED[k]}" target="_blank" rel="noopener">教材をひらく(自習モード)</a>
<button type="button" class="ef-btn" id="ws-print">印刷</button>
</div>
</header>
<nav class="ws-pick" role="tablist" aria-label="教材をえらぶ">{pick}</nav>
</div>
<main>
<div class="ws-intro">
<p><b>使い方</b> 上のボタンで、いま進める教材をえらびます。タブレットでは、□を押して✓を付け、わくの中に書きこめます(<b>この端末に自動で保存</b>され、次に開いても残っています)。紙で使うときは「印刷」を押します。</p>
<p>教材は「教材をひらく(自習モード)」から、ちがうタブで開きます。2つのタブを行き来しながら進めましょう。</p>
<p class="ws-saved">先生に出すときは、先生の指示どおりに「印刷」(PDFに保存)するか、紙に印刷して書いて出します。<button type="button" class="ef-btn" id="ws-print-all">全部の教材を印刷</button> <button type="button" class="ef-btn" id="ws-clear">この教材の書いたことを消す</button></p>
</div>
{sheets}
</main>
<script>{SCRIPT}</script>
</body>
</html>
'''


def answers_page():
    secs = []
    for d in data:
        items = []
        for a in d["apps"]:
            qs = "".join(f'<li><p class="q">{e(q["q"])}</p><p class="a"><b>{KANA[q["answer"]]}</b> {e(q["choices"][q["answer"]])}</p>'
                         f'<p class="x">{e(q.get("explain", ""))}</p></li>' for q in a.get("check") or [])
            items.append(f'<article><h3><span class="c">{a["code"]}</span>{e(a["name"])}</h3><ol>{qs}</ol></article>')
        secs.append(f'<section><h2>{d["domain"]} {e(d["domainName"])}<small>生徒のファイル: {FILES[d["domain"]]}</small></h2>{"".join(items)}</section>')
    return f'''<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>自習ワークシートの答え(先生用)</title>
<!-- worksheet/build.py が作ったファイル。直接直さない -->
<style>
{read(repo / "shared/eduit-frame.css")}
</style>
<style>
  body {{ margin: 0; background: var(--ef-bg); color: var(--ef-text); font-family: var(--ef-font); line-height: 1.6; }}
  main {{ max-width: 980px; margin: 0 auto; padding: 18px 16px 40px; }}
  .lead {{ background: var(--ef-surface); border: 1px solid var(--ef-line); border-radius: var(--ef-radius); padding: 10px 18px; }}
  h2 {{ margin: 26px 0 8px; font-size: 20px; border-bottom: 3px solid var(--ef-accent); display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 14px; }}
  h2 small {{ font-size: 13px; font-weight: 400; color: var(--ef-muted); }}
  article {{ background: var(--ef-surface); border: 1px solid var(--ef-line); border-radius: var(--ef-radius-s); padding: 8px 16px; margin: 8px 0; break-inside: avoid; }}
  h3 {{ margin: 0 0 4px; font-size: 16px; }}
  .c {{ display: inline-block; margin-right: .5em; padding: 0 .4em; border-radius: 6px; background: var(--ef-text); color: #fff; }}
  ol {{ margin: 0; padding-left: 1.6em; }}
  li p {{ margin: 0; }}
  .a b {{ display: inline-flex; justify-content: center; width: 1.6em; border-radius: 50%; background: #2e7d32; color: #fff; }}
  .x {{ color: var(--ef-muted); font-size: 14px; margin-bottom: 4px !important; }}
  @media print {{ body {{ background: #fff; font-size: 10pt; }} .lead {{ border: 0; padding: 0; }} }}
</style>
</head>
<body>
<header class="ef-header"><h1 class="ef-title">自習ワークシートの答え(先生用)</h1></header>
<main>
<div class="lead">
<p>生徒に配る/ワークシート/ の自習ワークシートの「たしかめ問題」の答えと解説です。問題は各教材の自習ガイドのたしかめ問題と同じなので、生徒は自習ガイドでも答え合わせができます(ワークシートには答えを出していません)。</p>
<p>ワークシートは、教材ごとに ねらい → 進め方(基本・発展) → たしかめ問題 → ふりかえり(◎○△の自己評価と記述)の順です。生徒はタブレットで書きこむ(その端末に保存)か、印刷して紙で使います。</p>
</div>
{"".join(secs)}
</main>
</body>
</html>
'''


dist.mkdir(exist_ok=True)
for d in data:
    (dist / FILES[d["domain"]]).write_text(area_page(d), encoding="utf-8")
(dist / ANSWERS).write_text(answers_page(), encoding="utf-8")
for p in sorted(dist.glob("*.html")):
    print(f"{p.relative_to(repo)}  ({p.stat().st_size // 1024} KB)")
