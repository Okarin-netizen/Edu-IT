// デジタル化と情報量の計算（画面に依存しない純粋な関数。tests/unit.test.mjs でテストする）
// 1バイト = 8ビット、1KB = 1024バイト、1MB = 1024KB として計算する（教科書の多くと同じ）

export const log2 = (n) => Math.log2(n);
const fmtInt = (n) => n.toLocaleString("ja-JP");

// ---------- データ量 ----------
// 画像（ビット）= 横の画素数 × 縦の画素数 × 1画素あたりのビット数
export function imageBits(width, height, bitsPerPixel) {
  return width * height * bitsPerPixel;
}
// 音（ビット）= 標本化周波数 × 量子化ビット数 × 秒数 × チャンネル数
export function audioBits(sampleRate, bitDepth, seconds, channels = 1) {
  return sampleRate * bitDepth * seconds * channels;
}
// 動画（ビット）= 1枚の画像のデータ量 × 1秒あたりの枚数 × 秒数（音と圧縮は考えない）
export function videoBits(width, height, bitsPerPixel, fps, seconds) {
  return imageBits(width, height, bitsPerPixel) * fps * seconds;
}

export const UNITS = [
  { id: "bit", label: "ビット", bits: 1 },
  { id: "B", label: "バイト", bits: 8 },
  { id: "KB", label: "KB", bits: 8 * 1024 },
  { id: "MB", label: "MB", bits: 8 * 1024 ** 2 },
  { id: "GB", label: "GB", bits: 8 * 1024 ** 3 },
];
export const unitOf = (id) => UNITS.find((u) => u.id === id);

// 数を見やすく丸める（整数ならそのまま、そうでなければ有効数字を残す）
export function niceNumber(x) {
  if (Number.isInteger(x)) return fmtInt(x);
  if (x >= 100) return fmtInt(Math.round(x));
  if (x >= 10) return x.toFixed(1).replace(/\.0$/, "");
  if (x >= 0.01) return x.toFixed(2).replace(/\.?0+$/, "");
  return x.toPrecision(2);
}

// 画面に出す数が、ちょうどの値でないときだけ「約」を付ける（1.5KB のように割り切れる小数には付けない）
export const approxMark = (v) => (Number(niceNumber(v).replace(/,/g, "")) === v ? "" : "約");

// ビット数を指定の単位で表す（割り切れなければ「約」を付ける）
export function inUnit(bits, unitId) {
  const v = bits / unitOf(unitId).bits;
  return `${approxMark(v)}${niceNumber(v)}${unitOf(unitId).label}`;
}

// ちょうどよい単位を選んで表す
export function formatBits(bits) {
  if (bits < 8 * 10) return `${fmtInt(bits)}ビット`;
  const bytes = bits / 8;
  if (bytes < 1024) return inUnit(bits, "B");
  if (bytes < 1024 ** 2) return inUnit(bits, "KB");
  if (bytes < 1024 ** 3) return inUnit(bits, "MB");
  return inUnit(bits, "GB");
}

// ビット → バイト → KB → MB → GB と順に割る式（答えの単位まで出す）（画面の「計算のしかた」用）
export function unitSteps(bits) {
  const show = (v, unit) => `${approxMark(v)}${niceNumber(v)} ${unit}`;
  const lines = [`${fmtInt(bits)} ビット`];
  let v = bits / 8;
  lines.push(`÷ 8 ＝ ${show(v, "バイト")}`);
  if (v >= 1024) {
    v /= 1024;
    lines.push(`÷ 1024 ＝ ${show(v, "KB")}`);
  }
  if (v >= 1024) {
    v /= 1024;
    lines.push(`÷ 1024 ＝ ${show(v, "MB")}`);
  }
  if (v >= 1024) {
    v /= 1024;
    lines.push(`÷ 1024 ＝ ${show(v, "GB")}`);
  }
  return lines;
}

// ---------- 量子化と色 ----------
// 0〜1 の値を levels 段階に量子化する（段階の中でいちばん近い値にする）
export function quantize(value, levels) {
  if (levels <= 1) return 0;
  const v = Math.min(1, Math.max(0, value));
  return Math.round(v * (levels - 1)) / (levels - 1);
}

// 色の表し方（白黒 → グレー → カラー）。bits は1画素あたりのビット数
export const COLOR_MODES = [
  { id: "bw", kind: "bw", bits: 1, label: "白黒（2色）" },
  { id: "g2", kind: "gray", bits: 2, label: "グレー 4段階" },
  { id: "g4", kind: "gray", bits: 4, label: "グレー 16段階" },
  { id: "g8", kind: "gray", bits: 8, label: "グレー 256段階" },
  { id: "c3", kind: "color", bits: 3, label: "カラー 8色" },
  { id: "c6", kind: "color", bits: 6, label: "カラー 64色" },
  { id: "c12", kind: "color", bits: 12, label: "カラー 4,096色" },
  { id: "c24", kind: "color", bits: 24, label: "フルカラー 約1677万色" },
];
export const colorCount = (mode) => 2 ** mode.bits;

// 0〜255 の RGB を、色の表し方 mode にあわせて変換する
export function applyColorMode(r, g, b, mode) {
  if (mode.kind === "color") {
    const levels = 2 ** (mode.bits / 3);
    const q = (v) => Math.round(quantize(v / 255, levels) * 255);
    return [q(r), q(g), q(b)];
  }
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255; // 明るさ
  const v = mode.kind === "bw" ? (lum >= 0.5 ? 255 : 0) : Math.round(quantize(lum, 2 ** mode.bits) * 255);
  return [v, v, v];
}

// ---------- 2進数と文字コード ----------
export function toBinary(n, width = 0) {
  if (!Number.isInteger(n) || n < 0) throw new Error("0以上の整数にしてください");
  return n.toString(2).padStart(width, "0");
}
export function fromBinary(str) {
  const s = String(str).replace(/\s+/g, "");
  if (!/^[01]+$/.test(s)) return NaN;
  return parseInt(s, 2);
}
// 2進数を10進数にする式（例: 1×8 + 0×4 + 1×2 + 1×1 ＝ 11）
export function binaryExplain(str) {
  const s = String(str).replace(/\s+/g, "");
  const terms = [...s].map((d, i) => `${d}×${2 ** (s.length - 1 - i)}`);
  return `${terms.join(" + ")} ＝ ${fromBinary(s)}`;
}
// 文字を UTF-8 のバイト列にする（英数字は1バイト、ひらがな・漢字はふつう3バイト）
export function utf8Bytes(text) {
  return [...new TextEncoder().encode(text)];
}
// ビットカードのお題: やさしい順（1けた → 2けた → 100以上 → 200以上）に1つずつ選ぶ
export const CARD_TARGET_TIERS = [[5, 9], [13, 20, 25, 37], [50, 77, 100], [129, 200, 255]];
export function pickCardTargets(rand = Math.random) {
  return CARD_TARGET_TIERS.map((tier) => tier[Math.floor(rand() * tier.length)]);
}
// カードの点: 8個までは●を並べ、16以上は「●×16」のように数で書く
export const cardDots = (v) => (v <= 8 ? "●".repeat(v) : `●×${v}`);

// 画像ステップ1: お題とちがう行（0から数える）と、その返事
export function wrongRows(targetRows, nowRows) {
  return targetRows.map((row, r) => (row === nowRows[r] ? -1 : r)).filter((r) => r >= 0);
}
export function wrongRowsMessage(rows) {
  if (!rows.length) return "";
  const names = rows.map((r) => `${r + 1}行目`);
  const which = rows.length <= 3 ? names.join("と") : `${rows.length}つの行（${names.slice(0, 3).join("、")} など）`;
  return `${which}がちがいます。お題と今の絵の0と1を、1行ずつ見くらべよう。`;
}

export const bitsNeeded = (count) => (count <= 1 ? 0 : Math.ceil(Math.log2(count)));
// 文字コードの表の1行分。番号（10進数）は UTF-8 の1バイトずつの値なので、
// 番号を2進数にしたものが、そのまま「0と1」の列になる（あ → 227, 129, 130）
export function charCodeRow(ch) {
  const numbers = utf8Bytes(ch);
  return { ch, numbers, bits: numbers.map((b) => toBinary(b, 8)), bytes: numbers.length };
}

// ---------- 答えの入力をそろえる（全角→半角など） ----------
// 日本語入力のまま打った全角の数字・英字・記号も、半角にそろえてから判定する
export const normalizeInput = (v) => String(v ?? "").normalize("NFKC").trim();
export const INPUT_MESSAGES = {
  empty: "答えを入れてから押そう",
  number: "半角の数字で入れよう",
  binary: "0と1だけで入れよう",
  word: "半角の英字で入れよう",
  list: "半角の数字を「,」で区切って入れよう",
};
// 数の答え: { ok: true, value } または { ok: false, message }
// 空白・3けたごとの「,」・最後の単位（units にあるもの）は取りのぞく
export function parseNumberAnswer(v, units = []) {
  let s = normalizeInput(v).replace(/\s+/g, "");
  if (!s) return { ok: false, message: INPUT_MESSAGES.empty };
  for (const u of [...units].sort((a, b) => b.length - a.length)) {
    if (s.toUpperCase().endsWith(u.toUpperCase())) {
      s = s.slice(0, -u.length);
      break;
    }
  }
  s = s.replace(/,(?=\d{3}(\D|$))/g, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return { ok: false, message: INPUT_MESSAGES.number };
  return { ok: true, value: Number(s) };
}
// 2進数の答え（0と1の並び）: { ok: true, value: "1011" } または { ok: false, message }
export function parseBinaryAnswer(v) {
  const s = normalizeInput(v).replace(/\s+/g, "");
  if (!s) return { ok: false, message: INPUT_MESSAGES.empty };
  if (!/^[01]+$/.test(s)) return { ok: false, message: INPUT_MESSAGES.binary };
  return { ok: true, value: s };
}
// 英字の答え（大文字にそろえる）: { ok: true, value: "PC" } または { ok: false, message }
export function parseWordAnswer(v) {
  const s = normalizeInput(v).replace(/\s+/g, "").toUpperCase();
  if (!s) return { ok: false, message: INPUT_MESSAGES.empty };
  if (!/^[A-Z]+$/.test(s)) return { ok: false, message: INPUT_MESSAGES.word };
  return { ok: true, value: s };
}
// 数の並びの答え（例: "3,4,9"・「3、4、9」・「3個 4個 9個」）: { ok: true, values } または { ok: false, message }
export function parseCountList(v, unit = "個") {
  const s = normalizeInput(v);
  if (!s) return { ok: false, message: INPUT_MESSAGES.empty };
  const parts = s.split(/[\s,、・]+/).filter(Boolean).map((t) => (unit && t.endsWith(unit) ? t.slice(0, -unit.length) : t));
  if (!parts.length) return { ok: false, message: INPUT_MESSAGES.empty };
  if (!parts.every((t) => /^\d+$/.test(t))) return { ok: false, message: INPUT_MESSAGES.list };
  return { ok: true, values: parts.map(Number) };
}

// ---------- 圧縮（ランレングス） ----------
// [0,0,0,1,1] → [[0,3],[1,2]]
export function rle(values) {
  const runs = [];
  for (const v of values) {
    const last = runs[runs.length - 1];
    if (last && last[0] === v) last[1]++;
    else runs.push([v, 1]);
  }
  return runs;
}
export function unrle(runs) {
  return runs.flatMap(([v, n]) => new Array(n).fill(v));
}
// 白黒の1行を「白から始めて、交互に続く個数」で表す（ファクスと同じ考え方）
// "00011110" → [3,4,1]、"11000" → [0,2,3]
export function rleCounts(row) {
  const cells = [...row];
  const runs = rle(cells);
  const counts = runs.map(([, n]) => n);
  if (cells.length && cells[0] === "1") counts.unshift(0);
  return counts;
}
export function unrleCounts(counts) {
  return counts.map((n, i) => (i % 2 ? "1" : "0").repeat(n)).join("");
}
// 白黒の絵（"0101..." の行の配列）を、各行「個数の並び」にしたときのビット数。個数1つを countBits ビットで表す
// countBits は行の長さを表せる大きさにする（16画素の行なら 0〜16 を表す5ビット）
export function rleImageBits(rows, countBits = 5) {
  let total = 0;
  for (const row of rows) {
    if (row.length > 2 ** countBits - 1) throw new Error("countBits が足りません");
    total += rleCounts(row).length * countBits;
  }
  return total;
}
// 文字列のランレングス圧縮: "AAAABBC" → "A4B2C1"
export function rleText(text) {
  return rle([...text]).map(([c, n]) => `${c}${n}`).join("");
}
export function unrleText(code) {
  let out = "";
  for (const m of code.matchAll(/(\D)(\d+)/g)) out += m[1].repeat(Number(m[2]));
  return out;
}

// ---------- 容量計算ドリル ----------
// rand: 0以上1未満を返す関数（テストでは決まった値を返すものを渡す）
const pick = (arr, rand) => arr[Math.floor(rand() * arr.length)];

export const DRILL_KINDS = [
  { id: "unit", label: "ビットとバイト" },
  { id: "levels", label: "ビット数と表せる数" },
  { id: "image", label: "画像" },
  { id: "audio", label: "音" },
  { id: "video", label: "動画（発展）", advanced: true },
];
// 「いろいろ」で出す種類（動画は数が大きいので発展あつかい。「動画」を選んだときだけ出す）
export const MIX_KINDS = DRILL_KINDS.filter((d) => !d.advanced);

// ドリルの最高点は、問題の種類ごとに残す（score.bests = { mix: {correct,total,at}, image: … }）
export const DRILL_KIND_ORDER = [{ id: "mix", label: "いろいろ" }, ...DRILL_KINDS];
export function updateDrillBests(bests = {}, kind, correct, total, at = "") {
  const prev = bests[kind];
  if (prev && prev.correct >= correct) return bests;
  return { ...bests, [kind]: { correct, total, at } };
}
// 画面と書き出し用の文。short なら「いろいろ 8/10・画像 10/10」
export function drillBestText(score = {}, short = false) {
  const one = (b) => (short ? `${b.correct}/${b.total}` : `${b.correct} / ${b.total}問`);
  const bests = score.bests || {};
  const parts = DRILL_KIND_ORDER.filter((k) => bests[k.id]).map((k) => `${k.label} ${one(bests[k.id])}`);
  if (parts.length) return parts.join(short ? "・" : "、");
  // 前の版の記録（種類が残っていない）
  return score.best ? `${one(score.best)}（種類の記録なし）` : "";
}

export function makeDrill(kind, rand = Math.random) {
  if (kind === "mix") kind = pick(MIX_KINDS, rand).id;
  const make = { unit: drillUnit, levels: drillLevels, image: drillImage, audio: drillAudio, video: drillVideo }[kind];
  return { kind, ...make(rand) };
}

// 正解と「よくあるまちがい」（数）の中から3つで、4つの選択肢を作る。正解が大きさの順で何番目になるかが
// かたよらないように（いつも「いちばん小さい」などにならないように）、
// 正解より小さいまちがいをいくつ入れるか（0〜3個）を先に決めてから選ぶ。
// fmt: 数 → 選択肢の文字。ok(v): 選択肢に使ってよいまちがいか
export function balancedChoices(rand, correct, wrongs, fmt, { ok = () => true, approx = null } = {}) {
  const cs = fmt(correct);
  const seen = new Set([cs]);
  const lo = [];
  const hi = [];
  for (const w of wrongs) {
    if (!(w > 0) || w === correct || !ok(w)) continue;
    const s = fmt(w);
    if (seen.has(s)) continue;
    seen.add(s);
    (w < correct ? lo : hi).push(s);
  }
  // 「約」が付くかどうかで正解がわからないように、正解と同じ書き方のものを先に使う
  const take = (arr, k) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    if (approx) {
      const same = (t) => approx(t) === approx(cs);
      a.sort((x, y) => Number(same(y)) - Number(same(x)));
    }
    return a.slice(0, k);
  };
  const feasible = [0, 1, 2, 3].filter((r) => lo.length >= r && hi.length >= 3 - r);
  // まちがいが3つに足りないときは、あるものを全部使う
  const nLo = feasible.length ? pick(feasible, rand) : lo.length;
  const nHi = Math.min(hi.length, 3 - nLo);
  return { choices: [cs, ...take(lo, nLo), ...take(hi, nHi)], answer: 0 };
}

// 決まった問題（ステップの確かめ）用: まちがいの選択肢を「正解より小さいもの」「大きいもの」から2つ選ぶ。
// 正解がいつも真ん中にならないように、小さい方を2つ・1つ・0個のどれにするかを毎回ランダムに決める
export function pickAround(lows, highs, rand = Math.random) {
  const nLow = Math.min(lows.length, Math.floor(rand() * 3));
  const sh = (a) => {
    const b = [...a];
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  };
  return [...sh(lows).slice(0, nLow), ...sh(highs).slice(0, 2 - nLow)];
}

function drillUnit(rand) {
  const t = Math.floor(rand() * 3);
  if (t === 0) {
    // 8の倍数のバイト数にして、「8で2回わった」などの小さいまちがいも整数にする
    const bytes = pick([8, 16, 24, 32, 40, 48, 64, 128], rand);
    const bits = bytes * 8;
    return {
      question: `${fmtInt(bits)}ビットは何バイト？`,
      // 小さいまちがい: ÷64・÷32・÷16 / 大きいまちがい: わらない・×8・×10・÷2
      ...balancedChoices(rand, bytes, [bytes / 8, bytes / 4, bytes / 2, bits, bits * 8, bytes * 10, bits / 2], (v) => `${fmtInt(v)}バイト`),
      explain: `8ビット ＝ 1バイトなので、${fmtInt(bits)} ÷ 8 ＝ ${bytes}バイト。`,
    };
  }
  if (t === 1) {
    const mb = pick([2, 3, 4, 5, 10], rand);
    return {
      question: `${mb}MBは何KB？`,
      // 小さいまちがい: ×1000・×100・×10・×8 / 大きいまちがい: ×1024×8・×1024×1024・×1000×1000
      ...balancedChoices(rand, mb * 1024, [mb * 1000, mb * 100, mb * 10, mb * 8, mb * 1024 * 8, mb * 1024 * 1024, mb * 1000 * 1000], (v) => `${fmtInt(v)}KB`),
      explain: `1MB ＝ 1024KBなので、${mb} × 1024 ＝ ${fmtInt(mb * 1024)}KB。`,
    };
  }
  const kb = pick([1, 2, 4, 8], rand);
  return {
    question: `${kb}KBは何ビット？`,
    // 小さいまちがい: ×8をわすれる・×1024をわすれる・×1000 / 大きいまちがい: ×1024×1024・×8を2回・×1024×1024×8
    ...balancedChoices(rand, kb * 1024 * 8, [kb * 1024, kb * 8, kb * 1000, kb * 8000, kb * 1024 * 1024, kb * 1024 * 64, kb * 1024 * 1024 * 8], (v) => `${fmtInt(v)}ビット`),
    explain: `${kb}KB ＝ ${kb} × 1024 ＝ ${fmtInt(kb * 1024)}バイト。1バイト ＝ 8ビットなので × 8 で ${fmtInt(kb * 1024 * 8)}ビット。`,
  };
}

// 2⁴ のような上付きの数字（中学の数学と同じ書き方）
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
export const pow2Text = (n) => `2${[...String(n)].map((d) => SUP[d]).join("")}`;

function drillLevels(rand) {
  const n = pick([2, 3, 4, 5, 6, 7, 8, 10, 16], rand);
  if (rand() < 0.5) {
    return {
      question: `${n}ビットで表せるのは何通り？`,
      // 2 × n・n × n・1けたずれ（2ⁿ⁻¹, 2ⁿ⁺¹ …）・数え方のずれ（2ⁿ − 1, 2ⁿ ＋ 1）
      ...balancedChoices(rand, 2 ** n, [n * 2, n * n, n, 2 ** (n - 1), 2 ** (n - 2), 2 ** n - 1, 2 ** n + 1, 2 ** (n + 1), 2 ** (n + 2)], (v) => `${fmtInt(v)}通り`),
      explain: `1ビット増えるごとに2倍。2を${n}回かけて ${pow2Text(n)} ＝ ${fmtInt(2 ** n)}通り。`,
    };
  }
  const count = pick([2, 4, 16, 64, 100, 200, 256, 1000], rand);
  const b = bitsNeeded(count);
  return {
    question: `${fmtInt(count)}通りを区別するには、少なくとも何ビット必要？`,
    // 「0ビット」は選択肢にも解き方にも出さない
    ...balancedChoices(rand, b, [b - 1, b - 2, b - 3, b + 1, b + 2, b + 3, Math.ceil(count / 8)], (v) => `${v}ビット`, { ok: (v) => v >= 1 }),
    explain: b > 1 ? `${b - 1}ビットでは ${fmtInt(2 ** (b - 1))}通りまで、${b}ビットなら ${fmtInt(2 ** b)}通りまで表せるので、${b}ビット。` : `1ビットで 0 と 1 の 2通りを表せるので、1ビット。`,
  };
}

// 単位をそろえて選択肢にする。unit はちょうどよいもの
// 正解の大きさの順位がかたよらないように選ぶ（balancedChoices）。0.1 より小さくなるものは使わない
function amountChoices(rand, bits, unit, mistakes) {
  return balancedChoices(rand, bits, mistakes, (v) => inUnit(v, unit), {
    ok: (v) => v / unitOf(unit).bits >= 0.1,
    approx: (t) => t.startsWith("約"),
  });
}
function bestUnit(bits) {
  const bytes = bits / 8;
  return bytes < 1024 ? "B" : bytes < 1024 ** 2 ? "KB" : bytes < 1024 ** 3 ? "MB" : "GB";
}

function drillImage(rand) {
  const [w, hgt] = pick([[16, 16], [32, 32], [64, 64], [128, 128], [256, 256], [640, 480], [800, 600], [1024, 768], [1920, 1080]], rand);
  const mode = pick([COLOR_MODES[0], COLOR_MODES[3], COLOR_MODES[7]], rand);
  const bits = imageBits(w, hgt, mode.bits);
  const unit = bestUnit(bits);
  return {
    question: `横${fmtInt(w)} × 縦${fmtInt(hgt)}画素、1画素${mode.bits}ビット（${mode.label}）の画像。圧縮しないときのデータ量は？`,
    ...amountChoices(rand, bits, unit, [bits * 8, bits / 8, bits * 1024, bits / 1024, mode.bits === 24 ? bits / 3 : bits * 3, mode.bits > 1 ? bits / mode.bits : bits * 24, bits * 2, bits / 2, bits * 4, bits / 4]),
    explain: [`${fmtInt(w)} × ${fmtInt(hgt)} × ${mode.bits} ＝ ${fmtInt(bits)}ビット`, ...unitSteps(bits).slice(1)].join("　"),
  };
}

function drillAudio(rand) {
  const rate = pick([8000, 16000, 22050, 44100, 48000], rand);
  const depth = pick([8, 16], rand);
  const sec = pick([1, 10, 30, 60], rand);
  const ch = pick([1, 2], rand);
  const bits = audioBits(rate, depth, sec, ch);
  const unit = bestUnit(bits);
  return {
    question: `標本化周波数 ${fmtInt(rate)}Hz、量子化ビット数 ${depth}ビット、${ch === 2 ? "ステレオ（2チャンネル）" : "モノラル（1チャンネル）"}で ${sec}秒 録音。データ量は？`,
    ...amountChoices(rand, bits, unit, [bits * 8, bits / 8, bits * 1024, bits / 1024, ch === 2 ? bits / 2 : bits * 2, depth === 16 ? bits / 2 : bits * 2, bits / sec, bits * 60, bits * 10, bits / 10]),
    explain: [`${fmtInt(rate)} × ${depth} × ${sec} × ${ch} ＝ ${fmtInt(bits)}ビット`, ...unitSteps(bits).slice(1)].join("　"),
  };
}

function drillVideo(rand) {
  const [w, hgt] = pick([[320, 240], [640, 480], [1280, 720], [1920, 1080]], rand);
  const fps = pick([10, 15, 30, 60], rand);
  const sec = pick([1, 10, 60], rand);
  const bits = videoBits(w, hgt, 24, fps, sec);
  const unit = bestUnit(bits);
  return {
    question: `横${fmtInt(w)} × 縦${fmtInt(hgt)}画素・フルカラー（24ビット）の動画。1秒に${fps}枚 切りかえて、${sec}秒。圧縮しない（音なし）ときのデータ量は？`,
    ...amountChoices(rand, bits, unit, [bits / fps, bits / sec, bits / 3, bits / 8, bits / 1024, bits / 10, bits * 8, bits * 1024, bits * 10, bits * fps, bits * 2]),
    explain: [`${fmtInt(w)} × ${fmtInt(hgt)} × 24 × ${fps} × ${sec} ＝ ${fmtInt(bits)}ビット`, ...unitSteps(bits).slice(1)].join("　"),
  };
}
