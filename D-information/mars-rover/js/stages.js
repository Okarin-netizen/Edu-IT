// ステージ（フィールド・ケース・はじめのプログラム・ヒント・模範プログラム）
// プログラムは計測・制御シミュレータ（D7）と同じテキストの形で書く（走行 = 前進 など）。
import { mazeWalls, smoothLine } from "./world.js";

// ---- フィールドを作る ----
function straightField() {
  return {
    W: 400, H: 160, limit: 40,
    start: { x: 50, y: 80, a: 0 },
    obstacles: [{ type: "rock", x: 330, y: 30, r: 16 }, { type: "rock", x: 140, y: 140, r: 12 }],
    targets: [{ mode: "stop", x: 250, y: 80, r: 20, label: "調査地点" }],
    targetWord: "調査地点",
  };
}

function rockField(rx) {
  return {
    W: 520, H: 260, limit: 60,
    start: { x: 50, y: 130, a: 0 },
    obstacles: [{ type: "rock", x: rx, y: 130, r: 28 }, { type: "rock", x: 130, y: 30, r: 14 }, { type: "crater", x: 380, y: 230, r: 22 }],
    targets: [{ mode: "near", obstacle: 0, near: 40, label: "岩" }],
    targetWord: "岩",
    goal: { x: 450, y: 0, w: 70, h: 260, label: "旗のエリア" },
  };
}

function mazeField(path, start, samples, goalCell, limit = 200) {
  const cols = 6;
  const rows = 4;
  const [gc, gr] = goalCell;
  return {
    W: cols * 100, H: rows * 100, limit,
    start,
    obstacles: mazeWalls(cols, rows, path),
    targets: samples.map(([c, r], i) => ({ mode: "pass", x: c * 100 + 50, y: r * 100 + 50, r: 30, label: `サンプル${i + 1}` })),
    targetWord: "サンプル",
    goal: { x: gc * 100 + 5, y: gr * 100 + 5, w: 90, h: 90, label: "基地" },
    path,
  };
}

const MAZE_A = [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [2, 1], [1, 1], [1, 2], [1, 3], [2, 3], [3, 3], [4, 3], [4, 2], [5, 2], [5, 1], [5, 0]];
const MAZE_B = [[0, 3], [0, 2], [0, 1], [0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [3, 2], [4, 2], [4, 1], [4, 0], [5, 0], [5, 1], [5, 2], [5, 3], [4, 3], [3, 3]];

// 線の上の、はじめから f（0〜1）の割合の点
function pointOnLine(pts, f) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  let want = total * f;
  for (let i = 1; i < pts.length; i++) {
    const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (want <= L) return [pts[i - 1][0] + ((pts[i][0] - pts[i - 1][0]) * want) / L, pts[i - 1][1] + ((pts[i][1] - pts[i - 1][1]) * want) / L];
    want -= L;
  }
  return pts.at(-1);
}

function lineField(points, rocks, sampleAt, limit = 120) {
  const line = smoothLine(points, 10);
  const end = line.at(-1);
  const start = line[0];
  const a = (Math.atan2(line[1][1] - start[1], line[1][0] - start[0]) * 180) / Math.PI;
  return {
    W: 600, H: 360, limit,
    start: { x: start[0], y: start[1], a },
    obstacles: rocks.map(([x, y, r, type]) => ({ type: type || "rock", x, y, r })),
    lines: [line],
    targets: sampleAt.map((f, i) => {
      const [x, y] = pointOnLine(line, f);
      return { mode: "pass", x, y, r: 26, label: `サンプル${i + 1}` };
    }),
    targetWord: "サンプル",
    goal: { x: end[0] - 30, y: end[1] - 30, w: 60, h: 60, label: "線の終わりの基地" },
  };
}

const LINE_A = [[40, 180], [150, 180], [230, 110], [330, 105], [400, 200], [490, 250], [560, 250]];
const LINE_B = [[40, 300], [150, 300], [210, 200], [300, 130], [380, 210], [450, 290], [530, 220], [560, 90]];

function plainField() {
  return {
    W: 700, H: 450, limit: 150,
    start: { x: 60, y: 225, a: 0 },
    obstacles: [
      { type: "rock", x: 200, y: 220, r: 30 }, { type: "crater", x: 330, y: 90, r: 45 }, { type: "rock", x: 360, y: 330, r: 34 },
      { type: "rock", x: 500, y: 200, r: 26 }, { type: "crater", x: 600, y: 360, r: 40 }, { type: "rock", x: 560, y: 70, r: 22 },
      { type: "rock", x: 120, y: 380, r: 20 }, { type: "rock", x: 260, y: 400, r: 16 },
    ],
    targets: [[300, 220], [440, 110], [620, 220], [470, 380]].map(([x, y], i) => ({ mode: "pass", x, y, r: 30, label: `サンプル${i + 1}` })),
    targetWord: "サンプル",
    goal: { x: 15, y: 175, w: 90, h: 100, label: "基地", afterTargets: true },
  };
}

// ---- ステージ ----
// design: はじめの設計 / allow: えらべるセンサ（dist: 場所の id、color: 色センサの数）/ model: 模範（設計とプログラム）
export const STAGES = [
  {
    id: "straight",
    num: 1,
    level: "basic",
    icon: "🚩",
    title: "まっすぐ走って止まる",
    goal: "前進して、調査地点（青い円）の中で止まる。",
    story: "火星探査ロボットのはじめての試運転です。基地から前に 200cm 進んだところに、調査地点があります。ロボットを前進させて、調査地点の中で止めましょう。止まると調査（1秒）ができます。",
    learn: "順次（命令を上から順に実行する）。モーターの速さと時間で、進む距離が決まります。",
    time: "15分",
    allow: { dist: ["front"], color: [0] },
    design: { dist: ["front"], color: 0, speed: "normal" },
    starter: "# 前進して、調査地点の中で止めよう\n走行 = 前進\n2 秒待つ\n走行 = 止まる",
    hints: [
      "「2 秒待つ」のあいだ、ロボットは前進を続けます。ふつうの速さは 1秒に 20cm です。",
      "調査地点までは 200cm。何秒前進すればよいか、計算してみよう。",
      "モーターの速さを変えると、同じ時間でも進む距離が変わります。",
    ],
    model: { design: { dist: ["front"], color: 0, speed: "normal" }, program: "走行 = 前進\n10 秒待つ\n走行 = 止まる" },
    cases: [{ id: "a", name: "平らな道", field: straightField() }],
    checks: ["調査地点の中で止まって、調査する", "崖や岩にぶつからない"],
  },
  {
    id: "rock",
    num: 2,
    level: "basic",
    icon: "🪨",
    title: "岩の前で止まる・よける",
    goal: "距離センサで岩を見つけて、手前で止まって調べ、よけて旗のエリアまで進む。",
    story: "火星の地面には、大きな岩があります。岩がどこにあるかは、行ってみないとわかりません。距離センサ（超音波）で、岩までの距離をはかります。岩の手前（40cm 以内）で止まって調べましょう。調べたら、岩をよけて先の旗のエリアまで進みます。",
    learn: "分岐（もし〜なら／でなければ）と反復（ずっと）。センサの値で動きを変えます。",
    time: "25分",
    allow: { dist: ["front", "frontLeft", "frontRight"], color: [0] },
    design: { dist: ["front"], color: 0, speed: "normal" },
    starter: "# 岩の手前で止まる。調べたら、よけて旗まで進もう\nずっと\n  もし 前の距離 < 10 なら\n    走行 = 止まる\n  でなければ\n    走行 = 前進\n  おわり\nおわり",
    hints: [
      "まず、岩にぶつからずに、岩の手前で止まれるか確かめよう。岩の位置はケースごとにちがいます。",
      "止まったあと、そのままでは先へ進めません。「右に回る」→「前進」→「左に回る」の順で、岩の横をぬけよう。",
      "ふつうの速さなら、「右に回る」と「1 秒待つ」で 90°回ります。",
      "横へ何cm ずれれば、岩にぶつからずに進めるかな？（岩の大きさは直径 約56cm）",
    ],
    model: {
      design: { dist: ["front"], color: 0, speed: "normal" },
      program: "ずっと\n  もし 前の距離 < 30 なら\n    走行 = 止まる\n    2 秒待つ\n    走行 = 右に回る\n    1 秒待つ\n    走行 = 前進\n    3 秒待つ\n    走行 = 左に回る\n    1 秒待つ\n  でなければ\n    走行 = 前進\n  おわり\nおわり",
    },
    cases: [
      { id: "far", name: "岩が遠い", field: rockField(300) },
      { id: "mid", name: "岩がまん中", field: rockField(230) },
      { id: "near", name: "岩が近い", field: rockField(160) },
    ],
    checks: ["岩の手前（40cm 以内）で止まって、岩を調べる", "岩をよけて、旗のエリアに着く", "崖や岩にぶつからない"],
  },
  {
    id: "maze",
    num: 3,
    level: "basic",
    icon: "🏜️",
    title: "迷路のような谷を探査する",
    goal: "左右の距離センサも使って、曲がりくねった谷を進み、サンプルを集めて基地に着く。",
    story: "岩壁にかこまれた、曲がりくねった谷を探査します。地図はありません（谷の形はケースごとにちがいます）。前の岩壁が近づいたら、左と右のどちらが開いているかをセンサで調べます。開いている方へ曲がりましょう。",
    learn: "条件の組み合わせ（もしの中にもし）。どのセンサをどこに付けるかを考える（解決策の構想）。",
    time: "35分",
    allow: { dist: ["front", "frontLeft", "frontRight", "left", "right"], color: [0] },
    design: { dist: ["front"], color: 0, speed: "normal" },
    starter: "# 前の岩壁が近づいたら、開いている方へ曲がろう\nずっと\n  もし 前の距離 < 35 なら\n    走行 = 止まる\n    # ここに、右か左へ曲がる命令を入れよう\n  でなければ\n    走行 = 前進\n  おわり\nおわり",
    hints: [
      "左右のどちらが開いているかを知るには、どこにセンサを付ければよいかな？「ロボットの設計」で付けよう。",
      "「右の距離 > 左の距離」なら、右の方が開いています。",
      "曲がるときは「右に回る」と「1 秒待つ」で 90°（ふつうの速さのとき）。",
      "速さを変えたら、回る時間も変えないと、ちょうど 90°になりません。",
    ],
    model: {
      design: { dist: ["front", "left", "right"], color: 0, speed: "normal" },
      program: "ずっと\n  もし 前の距離 < 35 なら\n    走行 = 止まる\n    もし 右の距離 > 左の距離 なら\n      走行 = 右に回る\n    でなければ\n      走行 = 左に回る\n    おわり\n    1 秒待つ\n  でなければ\n    走行 = 前進\n  おわり\nおわり",
    },
    cases: [
      { id: "a", name: "谷A", field: mazeField(MAZE_A, { x: 50, y: 50, a: 0 }, [[2, 1], [2, 3]], [5, 0]) },
      { id: "b", name: "谷B", field: mazeField(MAZE_B, { x: 50, y: 350, a: -90 }, [[2, 1], [5, 1]], [3, 3]) },
    ],
    checks: ["サンプルをすべて集める", "基地に着く", "岩壁にぶつからない（200秒以内）"],
  },
  {
    id: "line",
    num: 4,
    level: "advanced",
    icon: "〰️",
    title: "色センサで線をたどる",
    goal: "下向きの色センサで目印の線を見つけ、線の上を進んで基地に着く。",
    story: "人が入れない細い道を進むロボットを作ります。目印の線がたよりです（教科書の「もっと問題解決」）。線の両側には岩があるので、線からはずれるとぶつかります。色センサは、線の上なら「線」（1）、そうでなければ「地面」（0）になります。",
    learn: "2つのセンサの組み合わせで、細かく向きを直し続ける制御。",
    time: "25分（発展）",
    allow: { dist: ["front", "frontLeft", "frontRight", "left", "right"], color: [0, 1, 2] },
    design: { dist: ["front"], color: 2, speed: "normal" },
    starter: "# 左の色センサが線にのったら、左へ向きを直そう\nずっと\n  もし 左の色 == 線 なら\n    走行 = 左に回る\n  でなければ\n    走行 = 前進\n  おわり\nおわり",
    hints: [
      "2つの色センサは、線をはさむように付いています。まっすぐ線の上を進んでいるときは、どちらも「地面」です。",
      "右の色センサが線にのったら、線は右にずれています。右へ向きを直そう。",
      "「もし」の「でなければ」の中に、もう1つ「もし」を入れられます。",
    ],
    model: {
      design: { dist: ["front"], color: 2, speed: "normal" },
      program: "ずっと\n  もし 左の色 == 線 なら\n    走行 = 左に回る\n  でなければ\n    もし 右の色 == 線 なら\n      走行 = 右に回る\n    でなければ\n      走行 = 前進\n    おわり\n  おわり\nおわり",
    },
    cases: [
      { id: "a", name: "ゆるやかな線", field: lineField(LINE_A, [[230, 200, 30], [420, 110, 26], [130, 95, 22], [330, 300, 30, "crater"], [520, 330, 18]], [0.4, 0.75]) },
      { id: "b", name: "曲がりの多い線", field: lineField(LINE_B, [[120, 230, 26], [300, 230, 28], [420, 120, 24, "crater"], [470, 200, 18], [250, 320, 22]], [0.35, 0.7]) },
    ],
    checks: ["線の上のサンプルをすべて集める", "線の終わりの基地に着く", "岩にぶつからない（120秒以内）"],
  },
  {
    id: "free",
    num: 5,
    level: "advanced",
    icon: "🏆",
    title: "自由なコースで記録に挑戦",
    goal: "コースをえらび、ロボットの設計とプログラムをくふうする。点数・時間・電池の残りの記録に挑戦する。",
    story: "いよいよ本番の探査です。サンプルを集めて基地に帰りましょう。速く走ると時間は短くなりますが、電池を多く使います。センサを増やすと安全に走れますが、費用と電池が増えます。どんなロボットにするかは、あなたしだいです。",
    learn: "機能・費用・安全性・環境への配慮（電池）のバランスを考えて、最適な解決策をえらぶ。",
    time: "30分（発展）",
    free: true,
    allow: { dist: ["front", "frontLeft", "frontRight", "left", "right"], color: [0, 1, 2] },
    design: { dist: ["front", "frontLeft", "frontRight"], color: 0, speed: "normal" },
    starter: "# 岩をよけながら、サンプルをさがそう（くふうして、点数を上げよう）\nずっと\n  もし 前の距離 < 40 または 左前の距離 < 30 または 右前の距離 < 30 なら\n    もし 左前の距離 > 右前の距離 なら\n      走行 = 左に回る\n    でなければ\n      走行 = 右に回る\n    おわり\n    0.5 秒待つ\n  でなければ\n    走行 = 前進\n  おわり\nおわり",
    hints: [
      "点数 = サンプル1つ 100点（全部集めて基地に帰ると +100点）。全部集めて基地に帰れたら、電池の残り（%）と残り時間（秒）も点数に足されます。ぶつかると −50点。",
      "まずは安全に、1つずつサンプルを集められるか試そう。",
      "左前・右前のセンサの値をくらべると、どちらへよければよいかがわかります。",
    ],
    model: {
      design: { dist: ["front", "frontLeft", "frontRight"], color: 0, speed: "normal" },
      program: "ずっと\n  もし 前の距離 < 40 または 左前の距離 < 30 または 右前の距離 < 30 なら\n    もし 左前の距離 > 右前の距離 なら\n      走行 = 左に回る\n    でなければ\n      走行 = 右に回る\n    おわり\n    0.5 秒待つ\n  でなければ\n    走行 = 前進\n  おわり\nおわり",
    },
    cases: [
      { id: "plain", name: "コースA クレーターの平原", field: plainField() },
      { id: "valley", name: "コースB 長い谷", field: { ...mazeField(MAZE_A, { x: 50, y: 50, a: 0 }, [[2, 0], [1, 2], [4, 3], [5, 1]], [5, 0], 150) } },
      { id: "line", name: "コースC 線の道", field: lineField(LINE_B, [[120, 230, 26], [300, 230, 28], [420, 120, 24, "crater"], [470, 200, 18], [250, 320, 22]], [0.2, 0.45, 0.7, 0.9], 120) },
    ],
    checks: ["サンプルを集める（多いほど点数が高い）", "全部集めて基地に帰る", "ぶつからない・電池を残す・速く"],
  },
];

for (const s of STAGES) s.label = "①②③④⑤"[s.num - 1];

export function stageById(id) {
  return STAGES.find((s) => s.id === id);
}
