// モジュールの一覧と進み具合の計算
import { store } from "./store.js";
import { furikaeriOn } from "./ui.js";
import { imageModule } from "../modules/image.js";
import { soundModule } from "../modules/sound.js";
import { binaryModule } from "../modules/binary.js";
import { compressModule } from "../modules/compress.js";
import { drillModule } from "../modules/drill.js";

// 基本編（①〜④）→ 発展編（⑤ 圧縮のしくみ）の順。num は並びの番号、label は画面に出す丸数字
export const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];
export const CATALOG = [
  { num: 1, id: "image", title: "画像のデジタル化", desc: "画素の数（解像度）と色の段階（階調）を変えて、見た目とデータ量をくらべる。白黒→グレー→カラー", module: imageModule },
  { num: 2, id: "sound", title: "音のデジタル化", desc: "音の波を標本化・量子化して、聞きくらべる。はかる回数が少ないと音はどうなる？", module: soundModule },
  { num: 3, id: "binary", title: "2進数と文字コード", desc: "0と1だけで数や文字を表すしくみ。ビットカードで10進数⇔2進数のパズル", module: binaryModule },
  { num: 4, id: "drill", title: "データ量の計算ドリル", desc: "画像・音のデータ量を計算する練習（動画は発展）。何度でも新しい問題が出る。電卓を使ってもよい", module: drillModule },
  { num: 5, id: "compress", title: "圧縮のしくみ", desc: "ランレングス圧縮を手作業→自動でやってみて、圧縮率をくらべる", module: compressModule },
].map((c) => ({ ...c, label: CIRCLED[c.num - 1] }));

export function moduleProgress(entry) {
  // 振り返りを隠す設定のときは、ふりかえりのステップを数えない
  const steps = furikaeriOn() ? entry.module.steps : entry.module.steps.filter((s) => s.id !== "reflect");
  const done = steps.filter((s) => store.isStepDone(entry.id, s.id)).length;
  return { done, total: steps.length, complete: done === steps.length };
}
