#!/usr/bin/env python3
"""クラスルーム配布用のフォルダを作り直す。実行: python3 クラスルーム配布/まとめる.py

各分野の完成ファイル(dist/・docs/)を「生徒に配る/」と「先生用/」に分けてコピーする。
生徒に配るのは、1つの分野につき1つの「統一版」(メニューが「基本編」「発展編」のタブに分かれている)。
1つの教材だけを配りたいときのファイルは「生徒に配る/1つずつ配るとき/」に入れる。
教材を直したときは、各分野のビルドをしてから、これをもう一度実行する。
"""
import importlib.util, json, pathlib, re, shutil, subprocess, sys

sys.dont_write_bytecode = True  # build-single.py を読んでも __pycache__ を作らない

here = pathlib.Path(__file__).resolve().parent
repo = here.parent
info = repo / "D-information"
student = here / "生徒に配る"
single = student / "1つずつ配るとき"
teacher = here / "先生用"

for d in (student, teacher):
    if d.exists():
        shutil.rmtree(d)
    d.mkdir()


def copy(src, dst):
    if not src.is_file():
        raise SystemExit(f"{src.relative_to(repo)} がありません。先にその分野のビルドをしてから、もう一度実行してください")
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dst)


HEAD_LIMIT = 2000  # <head> はファイルの先頭のほうにあるはず(これより後ろなら、ちがう <head> を見つけている)


def add_after_head(src, dst, tag):
    """src の <head> のすぐあとに tag(設定を決める <script>)を入れて dst に書く"""
    html = src.read_text(encoding="utf-8")
    m = re.search(r"<head[^>]*>", html)
    if not m or m.start() > HEAD_LIMIT or "window.EduitFrame" not in html:
        raise SystemExit(f"{src}: 設定を入れた版を作れません(<head> か共通の枠が見つからない)")
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(html[:m.end()] + tag + html[m.end():], encoding="utf-8")


# ---- 生徒に配る(1分野につき1ファイルの統一版。どれもメニューが「基本編」「発展編」に分かれている) ----
STUDENT = {
    "G": "G_技術分野のガイダンス.html",  # 4分野の前に1回使うガイダンス(分野に入らないので記号は G)
    "A": "A_材料と加工_統一版.html",
    "B": "B_生物育成_統一版.html",
    "C": "C_エネルギー変換_統一版.html",
    "D": "D_情報の技術_統一版.html",
    # 教科書の順に進む学習コース(入口)と、コースのために作った3つの教材(T-textbook/。分野に入らないので記号は M・F・Z)
    "T": "教科書の順に進む_学習コース.html",
    "M": "M_身の回りの技術さがし.html",
    "F": "F_これからの技術ラボ.html",
    "Z": "Z_学習を終えて.html",
}
subprocess.run([sys.executable, str(repo / "G-guidance/build.py")], check=True)  # → G-guidance/dist/
copy(repo / "G-guidance/dist/技術分野のガイダンス.html", student / STUDENT["G"])
subprocess.run([sys.executable, str(repo / "A-materials/build/build-single.py")], check=True)  # → A-materials/dist/
copy(repo / "A-materials/dist/材料と加工_教材アプリ.html", student / STUDENT["A"])
copy(repo / "B-bio/dist/生物育成教材集.html", student / STUDENT["B"])
copy(repo / "C-energy/dist/energy-apps.html", student / STUDENT["C"])
copy(info / "dist/情報の技術_体験教材集.html", student / STUDENT["D"])  # 9つの教材(生成AI・ネット詐欺・ハッシュ化のラボも入っている)
subprocess.run([sys.executable, str(repo / "T-textbook/build.py")], check=True)  # → T-textbook/dist/
for k in ("T", "M", "F", "Z"):
    copy(repo / "T-textbook/dist" / STUDENT[k], student / STUDENT[k])
# 情報の技術で1つの教材だけを配りたいとき用(中身は統一版と同じ)
data = json.loads((info / "kyozai-shu/data/materials.json").read_text(encoding="utf-8"))
for m in data["materials"]:
    copy(info / m["source"], single / f"{m['code']}_{m['title']}.html")

# ---- 先生用 ----
# 先生用のファイルの名前は「分野_名前.html」にそろえる。分野ごとの先生用ガイドは、どれも同じ章立て・同じ見た目
# (shared/eduit-guide.css)で、名前は「X_分野名_先生用ガイド.html」。4分野共通の道具は「全分野_名前.html」。
TEACHER = {
    "G": "G_技術分野のガイダンス_先生用ガイド.html",
    "T": "T_教科書の順に進む学習コース_先生用ガイド.html",  # コースと M・F・Z をまとめた1つのガイド
    "A": "A_材料と加工_先生用ガイド.html",
    "B": "B_生物育成_先生用ガイド.html",
    "C": "C_エネルギー変換_先生用ガイド.html",
    "D": "D_情報の技術_先生用ガイド.html",
    "D4": "D4_情報セキュリティ体験ラボ_先生用ガイド.html",
    "kihon": "全分野_基本編と発展編.html",
    "furikaeri": "全分野_振り返り一覧.html",
}


def inline_page(src):
    """先生用ガイドが読む CSS・JS(<link rel="stylesheet">・<script src>)を中に入れて、1ファイルで開けるようにする"""
    html = src.read_text(encoding="utf-8")
    base = src.parent

    def css(m):
        return "<style>\n" + (base / m.group(1)).read_text(encoding="utf-8").replace("</style", "<\\/style") + "\n</style>"

    def js(m):
        return "<script>\n" + (base / m.group(1)).read_text(encoding="utf-8").replace("</script", "<\\/script") + "\n</script>"

    want = len(re.findall(r'<link rel="stylesheet"|<script src=', html))
    html, n1 = re.subn(r'<link rel="stylesheet" href="([^"]+)">', css, html)
    html, n2 = re.subn(r'<script src="([^"]+)"></script>', js, html)
    if n1 + n2 != want:
        raise SystemExit(f"{src}: 中に入れられなかったファイルがあります")
    if "eg-sec" not in html or "window.EduitFrame" not in html:
        raise SystemExit(f"{src}: 先生用ガイドの共通の形(shared/eduit-guide.css・eduit-frame.js)になっていません")
    return html


def guide(src, key, built=False):
    """先生用ガイドを先生用フォルダに入れる。先生用フォルダでは、どのガイドも上のバーは題名だけ(「◀ メニュー」は出さない)
    built: 分野のビルドで CSS・JS がもう中に入っているファイル(B・C)"""
    html = src.read_text(encoding="utf-8") if built else inline_page(src)
    if "eg-sec" not in html:
        raise SystemExit(f"{src}: 先生用ガイドの共通の形になっていません")
    head, sep, body = html.partition("<body")
    body = re.sub(r'(<header class="ef-header">)\s*<a class="ef-btn ef-back"[^>]*>.*?</a>', r"\1", body, count=1)
    html = head + sep + body
    (teacher / TEACHER[key]).write_text(html, encoding="utf-8")


# 材料と加工の1ファイル版の部品(build-single.py)を使う
spec = importlib.util.spec_from_file_location("build_single", repo / "A-materials/build/build-single.py")
build_single = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build_single)
# 第三角法 立体メーカー(A7)だけを配りたいとき用(中身は統一版の A7 と同じ。メニューへ戻るボタンは出さない)
a7 = build_single.inline("a7-solid-maker/index.html")
a7 = a7.replace("</head>", "<style>.ef-back { display: none !important; }</style>\n</head>", 1)
(single / "A7_第三角法_立体メーカー.html").write_text(a7, encoding="utf-8")

# 分野ごとの先生用ガイド(G はガイダンス)
guide(repo / "G-guidance/dist/先生用ガイド.html", "G", built=True)
guide(repo / "T-textbook/dist/先生用ガイド.html", "T", built=True)
guide(repo / "A-materials/docs/先生用ガイド.html", "A")
guide(repo / "B-bio/dist/先生用ガイド.html", "B", built=True)
guide(repo / "C-energy/docs/先生用ガイド.html", "C", built=True)
guide(info / "docs/先生用ガイド.html", "D")
guide(info / "docs/情報セキュリティ体験ラボ_先生用ガイド.html", "D4")

# 4分野共通: 生徒が書き出した振り返りの JSON をまとめて一覧にする
subprocess.run([sys.executable, str(repo / "teacher-tools/furikaeri-ichiran/build.py")], check=True)
copy(repo / "teacher-tools/furikaeri-ichiran/dist/振り返り一覧.html", teacher / TEACHER["furikaeri"])
# 4分野共通: 基本編と発展編の分け方(学習指導要領の項目と理由つき)
subprocess.run([sys.executable, str(repo / "teacher-tools/kihon-hatten/build.py")], check=True)
copy(repo / "teacher-tools/kihon-hatten/dist/基本編と発展編.html", teacher / TEACHER["kihon"])

# ---- 振り返りなし(生徒に配るものと同じ中身で、振り返りのタブ・欄・印を出さない版) ----
# 振り返りを Google フォームなど別の方法で集めるときに配る。<head> のすぐあとに window.EDUIT_FURIKAERI = 'off' を入れるだけ
# (shared/eduit-frame.js がこれを見て <html data-ef-furikaeri="off"> にする。iframe の中の教材も親の設定を引きつぐ)
nofk = student / "振り返りなし"
FK_TAG = "<script>window.EDUIT_FURIKAERI = 'off';</script>"
for p in sorted(student.rglob("*.html")):
    if nofk in p.parents:
        continue
    add_after_head(p, nofk / p.relative_to(student), FK_TAG)

# ---- 自習用(生徒に配るものと同じ中身で、自習モードを入れた版) ----
# 先生の説明なしで進めるときに配る。<head> のすぐあとに window.EDUIT_JISHU = 'on' を入れるだけ
# (shared/eduit-frame.js がこれを見て、各教材の右はしに「自習ガイド」(ねらい・進め方・ヒント・たしかめ問題)を出す。中身は各分野の eduit-info.js の jishu)
jishu = student / "自習用"
JS_TAG = "<script>window.EDUIT_JISHU = 'on';</script>"
for p in sorted(student.rglob("*.html")):
    if nofk in p.parents or jishu in p.parents:
        continue
    add_after_head(p, jishu / p.relative_to(student), JS_TAG)

# ---- 自習ワークシート(教材ごとに1枚。タブレットで書きこむか印刷して使う)と、その答え(先生用) ----
# 中身は自習ガイドと同じ eduit-info.js の jishu。振り返りなし・自習用の版は作らない(上の2つのあとで入れる)
subprocess.run([sys.executable, str(repo / "worksheet/build.py")], check=True)
ws_src = repo / "worksheet/dist"
for k in ("G_技術分野のガイダンス", "A_材料と加工", "B_生物育成", "C_エネルギー変換", "D_情報の技術", "M_身の回りの技術さがし", "F_これからの技術ラボ", "Z_学習を終えて"):
    copy(ws_src / f"{k}_ワークシート.html", student / "ワークシート" / f"{k}_ワークシート.html")
# 教科書順コースのワークシートへのリンクは「ワークシート/…」。1つ下のフォルダ(自習用・振り返りなし)の版では「../ワークシート/…」にする
WS_LINK = "var BASE = '', WS_BASE = 'ワークシート/';"
for sub in (nofk, jishu):
    p = sub / STUDENT["T"]
    html = p.read_text(encoding="utf-8")
    if WS_LINK not in html:
        raise SystemExit(f"{p}: ワークシートへのリンクの置き場所が見つかりません(T-textbook/build.py を直してください)")
    p.write_text(html.replace(WS_LINK, "var BASE = '', WS_BASE = '../ワークシート/';"), encoding="utf-8")
copy(ws_src / "ワークシートの答え.html", teacher / "全分野_ワークシートの答え.html")

for d in (student, teacher):
    for p in sorted(d.rglob("*.html")):
        print(f"{p.relative_to(here)}  ({p.stat().st_size // 1024} KB)")

# ---- 見た目の点検(shared/style-check.py --strict) ----
# 教材の CSS が「枠の決まり」(色・線・字は shared/eduit-frame.css の --ef-…)に合っているか。1件でもあれば止める
# 直し方は shared/README.md の「見た目の点検と撮影」
chk = subprocess.run([sys.executable, str(repo / "shared/style-check.py"), "--strict"], capture_output=True, text=True)
if chk.returncode:
    print(chk.stdout, file=sys.stderr)
    raise SystemExit("見た目の点検で、決まりに合わない所がありました(上の一覧)。直してから、もう一度実行してください")
print("見た目の点検: 0 件")
