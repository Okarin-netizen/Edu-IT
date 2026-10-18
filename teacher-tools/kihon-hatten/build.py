#!/usr/bin/env python3
"""基本編と発展編の分け方(先生用)を、インターネットなしで読める1ファイルにする。
実行: python3 teacher-tools/kihon-hatten/build.py  → dist/基本編と発展編.html

分け方のもとは各分野の eduit-info.js の levels(メニューの「基本編」「発展編」のタブと同じもの)。
分け方を直すときは eduit-info.js を直し、その分野の dist を作り直してから、これをもう一度実行する。
"""
import html, json, pathlib, subprocess

here = pathlib.Path(__file__).resolve().parent
repo = here.parent.parent
out = here / "dist" / "基本編と発展編.html"
data = json.loads(subprocess.run(["node", str(here / "extract.cjs")], check=True, capture_output=True, text=True).stdout)

# 配布用フォルダ(クラスルーム配布/生徒に配る/)の統一版のファイル名
FILES = {"A": "A_材料と加工_統一版.html", "B": "B_生物育成_統一版.html", "C": "C_エネルギー変換_統一版.html", "D": "D_情報の技術_統一版.html"}


def read(p):
    return p.read_text(encoding="utf-8")


def script(code):
    return "<script>\n" + code.replace("</script", "<\\/script") + "\n</script>"


def e(s):
    return html.escape(str(s), quote=False)


def tb(d, id):
    """教科書の編・章・節(各分野の eduit-info.js の textbook)"""
    T = d.get("textbook") or {}
    t = (T.get("items") or {}).get(id)
    if not t:
        return ""
    return t.get("ref", "")


sections = []
for d in data:
    rows = []
    for key, label in (("basic", "基本編"), ("advanced", "発展編")):
        items = d["levels"][key]["items"]
        for i, it in enumerate(items):
            head = f'<th rowspan="{len(items)}" class="lv lv-{key}">{label}</th>' if i == 0 else ""
            rows.append(f'<tr class="{key}">{head}<td class="app">{e(d["names"][it["id"]])}</td>'
                        f'<td class="tb">{e(tb(d, it["id"]))}</td><td>{e("・".join(it.get("parts", [])))}</td><td class="curr">{e(it.get("curr", ""))}</td><td>{e(it.get("why", ""))}</td></tr>')
    sections.append(f'''<section class="dom">
<h2>{e(d["domain"])} {e(d["domainName"])}<span class="file">配るファイル: {e(FILES[d["domain"]])}(第{e(d["version"])}版)</span></h2>
<table>
<thead><tr><th>編</th><th>教材</th><th>教科書</th><th>使うところ(生徒の画面のタブ・ページ)</th><th>学習指導要領</th><th>分けた理由</th></tr></thead>
<tbody>
{chr(10).join(rows)}
</tbody>
</table>
</section>''')

page = f'''<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>基本編と発展編の分け方(先生用)</title>
<style>
{read(repo / "shared/eduit-frame.css")}
</style>
{script(read(here.parent / "eduit-info.js"))}
<script>EDUIT_INFO.app = {{ name: '基本編と発展編の分け方(先生用)' }};</script>
{script(read(repo / "shared/eduit-frame.js"))}
<style>
  body {{ margin: 0; background: var(--ef-bg); color: var(--ef-text); font-family: var(--ef-font); line-height: 1.6; }}
  main {{ max-width: 1180px; margin: 0 auto; padding: 20px 16px 40px; }}
  h1 {{ font-size: 24px; margin: 0 0 8px; }}
  .lead {{ background: var(--ef-surface); border: 1px solid var(--ef-line); border-radius: var(--ef-radius); padding: 12px 18px; }}
  .lead li {{ margin: .2em 0; }}
  .dom {{ margin-top: 26px; }}
  .dom h2 {{ font-size: 20px; margin: 0 0 8px; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 16px; }}
  .dom h2 .file {{ font-size: 14px; font-weight: 400; color: var(--ef-muted); }}
  table {{ width: 100%; border-collapse: collapse; background: var(--ef-surface); font-size: 14px; }}
  th, td {{ border: 1px solid var(--ef-line); padding: 6px 8px; vertical-align: top; text-align: left; }}
  thead th {{ background: var(--ef-surface-2); white-space: nowrap; }}
  th.lv {{ text-align: center; white-space: nowrap; width: 4.5em; color: #fff; }}
  th.lv-basic {{ background: #2f6f3e; }}
  th.lv-advanced {{ background: #5b3fa8; }}
  td.app {{ font-weight: 700; white-space: nowrap; }}
  td.curr {{ white-space: nowrap; }}
  td.tb {{ white-space: nowrap; }}
  tr.advanced td {{ background: #f6f3fc; }}
  @media print {{ body {{ background: #fff; }} main {{ max-width: none; padding: 0; }} .dom {{ break-inside: avoid-page; }} table {{ font-size: 11px; }} }}
</style>
</head>
<body>
<main>
<h1>基本編と発展編の分け方(先生用)</h1>
<div class="lead">
<p>4つの分野の統一版(1分野につき1つのファイル)では、メニューが「基本編」「発展編」のタブに分かれています。分け方は次の考え方によります。</p>
<ul>
<li><b>基本編</b>: 中学校学習指導要領(平成29年告示)技術・家庭 技術分野の各内容の項目にあり、検定教科書(東京書籍・開隆堂・教育図書)で本文として扱われる内容。全員が学ぶ。</li>
<li><b>発展編</b>: 教科書で「発展」「コラム」として扱われる内容や、数値での設計・計算、しくみの中まで調べる内容、新しい技術(3D CAD・3Dプリンタ・生成AI のしくみ など)。基本編を終えた生徒や、選択の課題に使う。</li>
<li>1つの教材の中に基本と発展の両方があるときは、両方の編にカードが出ます。カードの「使うところ」に、その編で使うタブ・ページの名前が出ます(生徒のカードには学習指導要領の記号は出しません)。</li>
<li>どちらの編から開いても、教材の中身・記録の保存場所・書き出すファイルは同じです。振り返り一覧(先生用)でそのまま読めます。</li>
<li>「教科書」の列は、学校で使っている教科書の編・章・節です(本文と照らし合わせて決めました)。メニューのカードは、この章ごとに見出しで区切られ、カードにも同じ編・章・節が出ます。もとは各分野の <code>eduit-info.js</code> の <code>textbook</code> です。</li>
<li>基本編・発展編の分け方は、学習指導要領の項目と教科書の一般的な扱いから判断した目安です。使っている教科書や授業の計画に合わせて変えるときは、各分野の <code>eduit-info.js</code> の <code>levels</code> を直して作り直します。</li>
</ul>
</div>
{chr(10).join(sections)}
</main>
<div data-ef-footer></div>
</body>
</html>
'''
out.parent.mkdir(exist_ok=True)
out.write_text(page, encoding="utf-8")
print(f"{out.relative_to(repo)}  ({out.stat().st_size // 1024} KB)")
