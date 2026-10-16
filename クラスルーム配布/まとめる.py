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
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dst)


# ---- 生徒に配る(1分野につき1ファイルの統一版。どれもメニューが「基本編」「発展編」に分かれている) ----
STUDENT = {
    "A": "A_材料と加工_統一版.html",
    "B": "B_生物育成_統一版.html",
    "C": "C_エネルギー変換_統一版.html",
    "D": "D_情報の技術_統一版.html",
}
subprocess.run([sys.executable, str(repo / "A-materials/build/build-single.py")], check=True)  # → A-materials/dist/
copy(repo / "A-materials/dist/材料と加工_教材アプリ.html", student / STUDENT["A"])
copy(repo / "B-bio/dist/生物育成教材集.html", student / STUDENT["B"])
copy(repo / "C-energy/dist/energy-apps.html", student / STUDENT["C"])
copy(info / "dist/情報の技術_体験教材集.html", student / STUDENT["D"])  # 9つの教材(生成AI・ネット詐欺・ハッシュ化のラボも入っている)
# 情報の技術で1つの教材だけを配りたいとき用(中身は統一版と同じ)
data = json.loads((info / "kyozai-shu/data/materials.json").read_text(encoding="utf-8"))
for i, m in enumerate(data["materials"], 1):
    copy(info / m["source"], single / f"D{i}_{m['title']}.html")

# ---- 先生用 ----
# 先生用のファイルの名前は「分野_名前.html」にそろえる。分野ごとの先生用ガイドは、どれも同じ章立て・同じ見た目
# (shared/eduit-guide.css)で、名前は「X_分野名_先生用ガイド.html」。4分野共通の道具は「全分野_名前.html」。
TEACHER = {
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
# 第三角法 立体メーカー(M7)だけを配りたいとき用(中身は教材アプリの M7 と同じ。メニューへ戻るボタンは出さない)
m7 = build_single.inline("m7-solid-maker/index.html")
m7 = m7.replace("</head>", "<style>.ef-back { display: none !important; }</style>\n</head>", 1)
(single / "A_第三角法_立体メーカー(単体).html").write_text(m7, encoding="utf-8")

# 分野ごとの先生用ガイド
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

for d in (student, teacher):
    for p in sorted(d.rglob("*.html")):
        print(f"{p.relative_to(here)}  ({p.stat().st_size // 1024} KB)")
