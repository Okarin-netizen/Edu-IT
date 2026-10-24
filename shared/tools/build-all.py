#!/usr/bin/env python3
"""全分野の配布用ファイルを作り直す(共通の枠 shared/ を直したとき用)。

実行: python3 shared/tools/build-all.py

順番:
  1. B(node B-bio/build/rebuild.js)・C(python3 C-energy/build/build.py)
  2. D の各教材(npm run build と同じ tools/build-standalone.mjs)→ D の教材集(kyozai-shu/tools/build.mjs)
  3. クラスルーム配布/まとめる.py(G・A・T・先生用の道具・ワークシートもこの中で作り直す)
  4. 見た目の点検(shared/style-check.py)の件数を出す

1つの分野だけを直したときは、その分野の作り直しのコマンド(README.md の表)と まとめる.py だけでよい。
"""
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
D = ROOT / 'D-information'
D_LABS = ['virtual-cpu', 'digitization-lab', 'network-sim', 'security-lab', 'scam-lab', 'interactive-studio',
          'measure-control-sim', 'mars-rover', 'mondai-note', 'genai-lab', 'hash-lab']  # mars-rover は measure-control-sim の js を読むので後


def run(cmd, cwd=ROOT):
    print('▶', ' '.join(str(c) for c in cmd), f'({pathlib.Path(cwd).relative_to(ROOT) or "."})', flush=True)
    subprocess.run([str(c) for c in cmd], cwd=cwd, check=True, stdout=subprocess.DEVNULL)


run(['node', 'B-bio/build/rebuild.js'])
run([sys.executable, 'C-energy/build/build.py'])
for lab in D_LABS:
    run(['node', 'tools/build-standalone.mjs'], cwd=D / lab)
run(['node', 'tools/build.mjs'], cwd=D / 'kyozai-shu')
run([sys.executable, 'クラスルーム配布/まとめる.py'])
out = subprocess.run([sys.executable, 'shared/style-check.py', '--sum'], cwd=ROOT, capture_output=True, text=True).stdout
print('見た目の点検:', out.strip().splitlines()[-1])
