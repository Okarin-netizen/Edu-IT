// ひな形（サンプル作品）。作品タブの「ひな形から作る」で選べる。

export const SAMPLES = [
  {
    key: "counter",
    title: "ボタンでカウンター",
    desc: "ボタンを押すと数が増える。入力→処理→表示の、いちばん小さなしくみ（通信はまだない）。",
    tags: ["ボタン", "変数"],
    ui: [
      { type: "label", id: "count", text: "0回" },
      { type: "button", id: "plus", text: "押してね" },
      { type: "button", id: "reset", text: "0にもどす" },
    ],
    code: `// ボタンを押した回数を数える
let count = 0;
when ("plus") {
  count += 1;
  setText("count", count + "回");
}
when ("reset") {
  count = 0;
  setText("count", "0回");
}
`,
  },
  {
    key: "quiz",
    title: "3問クイズ",
    desc: "選ぶ問題と、入力する問題。正解の数を数えて、最後に結果を表示する（通信はない）。",
    tags: ["分岐", "変数", "入力"],
    ui: [],
    code: `// 3問クイズ：正解の数を数えて、最後に結果を表示する
let score = 0;
let a = choose("問題1: 日本でいちばん高い山は？", "富士山", "北岳", "奥穂高岳");
if (a == "富士山") {
  score += 1;
  show("問題1: 正解！");
} else {
  show("問題1: ざんねん。正解は富士山");
}
let b = ask("問題2: 1バイトは何ビット？（数字で答えよう）");
if (b == 8) {
  score += 1;
  show("問題2: 正解！");
} else {
  show("問題2: ざんねん。正解は 8 ビット");
}
let c = choose("問題3: パスワードとして安全なのはどれ？", "123456", "自分の誕生日", "長くて推測されにくい文字の並び");
if (c == "長くて推測されにくい文字の並び") {
  score += 1;
  show("問題3: 正解！");
} else {
  show("問題3: ざんねん。短い・推測しやすいパスワードは危険");
}
show("あなたの得点は " + score + " / 3 点");
if (score == 3) {
  show("全問正解！すばらしい！");
} else if (score >= 2) {
  show("あと少し！");
} else {
  show("もう一度チャレンジしよう");
}
`,
  },
  {
    key: "survey",
    title: "アンケート集計",
    desc: "答えをサーバーに保存し、みんなの回答を数えて表示する。サーバーと通信する、双方向性のあるコンテンツ。何人かで続けて答えてみよう。",
    tags: ["サーバー", "くり返し", "リスト"],
    ui: [],
    code: `// アンケート：答えをサーバーに保存して、みんなの結果を集計する
// 箱の名前は、ここだけ変えればOK（保存と数えるのに同じ箱を使う）
let box = "朝ごはん";
let options = ["毎日", "ときどき", "食べない"];
let ans = choose("朝ごはんを毎日食べていますか？", options);
server.save(box, ans);
show("回答ありがとう！ これまでのみんなの結果:");
let i = 0;
while (i < length(options)) {
  show(options[i] + ": " + server.count(box, options[i]) + "人");
  i += 1;
}
show("合計: " + server.count(box) + "人");
`,
  },
  {
    key: "shindan",
    title: "休み時間タイプ診断",
    desc: "答えによって点数を足し、点数でタイプを決める診断コンテンツ（通信はない）。",
    tags: ["分岐", "変数"],
    ui: [{ type: "label", id: "title", text: "休み時間タイプ診断（3問）" }],
    code: `// タイプ診断：答えによって点数を足して、タイプを決める
let active = 0;
let q1 = choose("休みの日は？", "外で遊ぶ", "家でのんびり");
if (q1 == "外で遊ぶ") {
  active += 1;
}
let q2 = choose("新しいことに挑戦するのは？", "わくわくする", "少し不安");
if (q2 == "わくわくする") {
  active += 1;
}
let q3 = choose("休み時間にしたいのは？", "体育館でボール", "図書室で読書");
if (q3 == "体育館でボール") {
  active += 1;
}
if (active >= 2) {
  show("あなたは「アクティブ型」！ 体を動かしてリフレッシュ");
} else {
  show("あなたは「じっくり型」！ 落ち着いて力をためよう");
}
`,
  },
  {
    key: "ranking",
    title: "計算チャレンジ（ランキング）",
    desc: "ニックネームを入れてスタート。5問の結果をサーバーに登録し、ランキングを表示する。サーバーと通信する、双方向性のあるコンテンツ。",
    tags: ["部品", "サーバー", "乱数"],
    ui: [
      { type: "label", id: "title", text: "計算チャレンジ（5問）" },
      { type: "input", id: "name", text: "ニックネーム（本名は入れない）" },
      { type: "button", id: "start", text: "スタート" },
      { type: "label", id: "result", text: "" },
    ],
    code: `// ニックネームを入れてスタートを押すと、かけ算が5問出る
when ("start") {
  let name = getText("name");
  if (name == "") {
    setText("result", "ニックネームを入れてね");
  } else {
    clear();
    let score = 0;
    repeat (5) {
      let x = random(2, 9);
      let y = random(2, 9);
      let ans = ask(x + " × " + y + " = ?");
      if (ans == x * y) {
        score += 1;
        show("○ 正解");
      } else {
        show("× 正解は " + x * y);
      }
    }
    server.addScore("計算ランキング", name, score);
    setText("result", name + "さんは " + score + " 点！");
    show("--- ランキング ---");
    let top = server.ranking("計算ランキング", 5);
    let i = 0;
    while (i < length(top)) {
      show(top[i]);
      i += 1;
    }
  }
}
`,
  },
  {
    key: "bug",
    title: "バグを直そう（デバッグ練習）",
    desc: "まちがいが2つあるプログラム。デバッグタブで1行ずつ実行して、変数の変化から原因を見つけよう（通信はない）。",
    tags: ["デバッグ"],
    ui: [],
    code: `// 1から5までの合計を表示したい。でも、まちがい（バグ）が2つある
// 「⏭ 1つずつ実行」を押してから「👣 1つ進む」を押し、変数 total と i の変化を見よう。正しい答えは 15（1+2+3+4+5）
let total = 0;
let i = 1;
while (i < 5) {
  total = total + i;
  i += 1;
}
show("1から5までの合計は " + totl);
`,
  },
];

// 前の版のメモのまま保存された「バグを直そう」も、手を加えていない見本とみなす（IS-12 でメモを変えた）
{
  const bug = SAMPLES.find((s) => s.key === "bug");
  bug.legacyCodes = [bug.code.replace(/^\/\/ 「⏭ 1つずつ実行」.*$/m, "// デバッグタブで「1つ進む」を押しながら、変数 total と i の変化を見よう")];
}

export const BLANK = {
  title: "新しい作品",
  ui: [],
  code: `// ここにプログラムを作ろう
show("こんにちは！");
`,
};

// 見本（空の作品をふくむ）を作ったまま、プログラムも部品も変えていない作品か（IS-09: 記録に「さわっただけの見本」を出さない）
const sameUi = (a = [], b = []) => a.length === b.length && a.every((p, i) => p.type === b[i].type && p.id === b[i].id && (p.text || "") === (b[i].text || ""));
export function isUntouchedSample(w) {
  return Boolean(w) && [...SAMPLES, BLANK].some((s) => (s.code === w.code || (s.legacyCodes || []).includes(w.code)) && sameUi(s.ui, w.ui));
}
