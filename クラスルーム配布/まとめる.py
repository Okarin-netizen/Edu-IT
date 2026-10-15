#!/usr/bin/env python3
"""クラスルーム配布用のフォルダを作り直す。実行: python3 クラスルーム配布/まとめる.py

各分野の完成ファイル(dist/・release/・docs/)を「生徒に配る/」と「先生用/」に分けてコピーする。
教材を直したときは、各分野のビルドをしてから、これをもう一度実行する。
"""
import json, pathlib, re, shutil, subprocess, sys

here = pathlib.Path(__file__).resolve().parent
repo = here.parent
info = repo / "information-apps"
student = here / "生徒に配る"
teacher = here / "先生用"

for d in (student, teacher):
    if d.exists():
        shutil.rmtree(d)
    d.mkdir()


def copy(src, dst):
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dst)


# ---- 生徒に配る(1分野につき1ファイル) ----
subprocess.run([sys.executable, str(repo / "materials-apps/build-single.py"),
                str(student / "A_材料と加工_教材アプリ.html")], check=True)
copy(repo / "bio-apps/dist/生物育成教材集.html", student / "B_生物育成_教材集.html")
copy(repo / "energy-apps/dist/energy-apps.html", student / "C_エネルギー変換_学習アプリ.html")
copy(info / "kyozai-shu/release/情報の技術_体験教材集.html", student / "D_情報の技術_体験教材集.html")
# 情報の技術で1つの教材だけを配りたいとき用(中身は教材集と同じ)
data = json.loads((info / "kyozai-shu/data/materials.json").read_text(encoding="utf-8"))
for i, m in enumerate(data["materials"], 1):
    copy(info / m["source"], student / "D_情報の技術_1つずつ配るとき" / f"D{i}_{m['title']}.html")

# ---- 先生用 ----
# 材料と加工の使い方は common/base.css を読むので、中に入れて1つで開けるようにする
guide = (repo / "materials-apps/使い方_先生用.html").read_text(encoding="utf-8")
css = (repo / "materials-apps/common/base.css").read_text(encoding="utf-8")
guide = re.sub(r'<link[^>]*href="common/base\.css"[^>]*>', lambda _: f"<style>\n{css}\n</style>", guide)
guide = guide.replace('href="index.html"', 'href="../生徒に配る/A_材料と加工_教材アプリ.html"')
(teacher / "A_材料と加工_使い方(先生用).html").write_text(guide, encoding="utf-8")
copy(repo / "bio-apps/dist/先生用ガイド.html", teacher / "B_生物育成_先生用ガイド.html")
copy(repo / "energy-apps/dist/tsukaikata.html", teacher / "C_エネルギー変換_使い方(生徒向け・先生向け).html")
copy(info / "kyozai-shu/docs/先生用の手引き.html", teacher / "D_情報の技術_先生用の手引き.html")
copy(info / "security-lab/docs/先生用の手引き.html", teacher / "D_情報セキュリティ体験ラボ_先生用の手引き.html")

for d in (student, teacher):
    for p in sorted(d.rglob("*.html")):
        print(f"{p.relative_to(here)}  ({p.stat().st_size // 1024} KB)")
