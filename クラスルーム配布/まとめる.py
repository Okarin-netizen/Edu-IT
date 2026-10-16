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
# 材料と加工の使い方は common/base.css や共通の枠(shared/)を読むので、1ファイル版と同じしかたで中に入れる
spec = importlib.util.spec_from_file_location("build_single", repo / "A-materials/build/build-single.py")
build_single = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build_single)
# 第三角法 立体メーカー(M7)だけを配りたいとき用(中身は教材アプリの M7 と同じ。メニューへ戻るボタンは出さない)
m7 = build_single.inline("m7-solid-maker/index.html")
m7 = m7.replace("</head>", "<style>.ef-back { display: none !important; }</style>\n</head>", 1)
(single / "A_第三角法_立体メーカー(単体).html").write_text(m7, encoding="utf-8")
guide = build_single.inline("docs/使い方_先生用.html")
guide = guide.replace('href="../index.html"', 'href="../生徒に配る/' + STUDENT["A"] + '"')
(teacher / "A_材料と加工_使い方(先生用).html").write_text(guide, encoding="utf-8")
copy(repo / "B-bio/dist/先生用ガイド.html", teacher / "B_生物育成_先生用ガイド.html")
copy(repo / "C-energy/docs/tsukaikata.html", teacher / "C_エネルギー変換_使い方(生徒向け・先生向け).html")


def with_frame(src, dst, name):
    """手引きに共通の枠(作成者・安全と個人情報・ライセンス・更新履歴のフッター)を中に入れてコピーする"""
    def esc(code):
        return code.replace("</script", "<\\/script")
    frame = "\n".join([
        "<style>\n" + (repo / "shared/eduit-frame.css").read_text(encoding="utf-8") + "\n</style>",
        "<script>\n" + esc((info / "eduit-info.js").read_text(encoding="utf-8")) + "\n</script>",
        "<script>EDUIT_INFO.app = { name: " + json.dumps(name, ensure_ascii=False) + " };</script>",
        "<script>\n" + esc((repo / "shared/eduit-frame.js").read_text(encoding="utf-8")) + "\n</script>",
    ])
    html = src.read_text(encoding="utf-8")
    if "</head>" not in html:
        raise SystemExit(f"{src}: </head> がありません")
    dst.write_text(html.replace("</head>", frame + "\n</head>", 1), encoding="utf-8")


# 4分野共通: 生徒が書き出した振り返りの JSON をまとめて一覧にする
subprocess.run([sys.executable, str(repo / "teacher-tools/furikaeri-ichiran/build.py")], check=True)
copy(repo / "teacher-tools/furikaeri-ichiran/dist/振り返り一覧.html", teacher / "全分野_振り返り一覧(先生用).html")
# 4分野共通: 基本編と発展編の分け方(学習指導要領の項目と理由つき)
subprocess.run([sys.executable, str(repo / "teacher-tools/kihon-hatten/build.py")], check=True)
copy(repo / "teacher-tools/kihon-hatten/dist/基本編と発展編.html", teacher / "全分野_基本編と発展編(先生用).html")

with_frame(info / "docs/先生用の手引き.html", teacher / "D_情報の技術_先生用の手引き.html",
           "情報の技術 体験教材集 先生用の手引き")
with_frame(info / "docs/情報セキュリティ体験ラボ_先生用の手引き.html", teacher / "D_情報セキュリティ体験ラボ_先生用の手引き.html",
           "情報セキュリティ体験ラボ 先生用の手引き")

for d in (student, teacher):
    for p in sorted(d.rglob("*.html")):
        print(f"{p.relative_to(here)}  ({p.stat().st_size // 1024} KB)")
