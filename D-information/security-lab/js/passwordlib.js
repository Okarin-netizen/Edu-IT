// パスワード強度の推定（画面に依存しない純粋な関数）
// モデル: 組み合わせの数 = 文字種の数 ^ 長さ。すべて試し終わる時間 = 組み合わせの数 ÷ 1秒あたりの試行回数
// これは考え方を学ぶための単純なモデルで、実際の攻撃の速さや方法はさまざま。

export const CHAR_CLASSES = [
  { id: "lower", label: "英小文字", size: 26, test: /[a-z]/ },
  { id: "upper", label: "英大文字", size: 26, test: /[A-Z]/ },
  { id: "digit", label: "数字", size: 10, test: /[0-9]/ },
  { id: "symbol", label: "記号", size: 33, test: /[ !"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/ },
];
// ひらがな・漢字など（多くのサービスでは使えないが、入力されたときの目安）
export const OTHER_CLASS = { id: "other", label: "その他の文字", size: 100 };

export function analyze(input, commonSet) {
  // 全角の英数字・記号は半角にそろえてから数える（ＡＢＣ１２３ → ABC123）
  const raw = String(input ?? "");
  const pw = raw.normalize("NFKC");
  const chars = [...pw];
  const length = chars.length;
  const used = CHAR_CLASSES.filter((c) => chars.some((ch) => c.test.test(ch)));
  const hasOther = chars.some((ch) => !CHAR_CLASSES.some((c) => c.test.test(ch)));
  const classes = hasOther ? [...used, OTHER_CLASS] : used;
  const poolSize = classes.reduce((a, c) => a + c.size, 0);
  const log10Combos = length && poolSize ? length * Math.log10(poolSize) : 0;
  const weakness = findWeakness(pw, commonSet);
  return { length, classes, poolSize, log10Combos, weakness, hasOther, converted: pw !== raw };
}

// よくある「文字を記号や数字に置きかえる」書き方（P@ssw0rd など）。攻撃する側は、この置きかえも最初に試す。
export const LEET = { "@": ["a"], "4": ["a"], "0": ["o"], "1": ["i", "l"], "!": ["i", "l"], "|": ["l"], "3": ["e"], "$": ["s"], "5": ["s"], "7": ["t"], "+": ["t"], "8": ["b"], "9": ["g"] };
// 前後に足される「数字や記号」
const PAD_CH = /[0-9 !"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;

// 置きかえを元に戻した候補（1 → i か l のように2通りあるものは両方。多くなりすぎないよう上限あり）
export function unleet(s, limit = 32) {
  let out = [""];
  for (const ch of s) {
    const subs = LEET[ch] || [ch];
    const next = [];
    for (const v of out) for (const r of subs) if (next.length < limit) next.push(v + r);
    out = next;
  }
  return out;
}

// 前後の数字・記号を取り、置きかえを戻して、辞書の言葉が出てくるか調べる
function findDictionaryCore(s, has) {
  const chars = [...s];
  const n = chars.length;
  let lead = 0;
  while (lead < n && PAD_CH.test(chars[lead])) lead++;
  let tail = 0;
  while (tail < n && PAD_CH.test(chars[n - 1 - tail])) tail++;
  const hits = [];
  for (let i = 0; i <= Math.min(lead, 8); i++) {
    for (let j = n; j >= Math.max(i + 3, n - tail); j--) {
      if (j - i > 24) continue;
      const whole = i === 0 && j === n;
      const core = chars.slice(i, j).join("");
      if (!whole && has(core)) hits.push({ word: core, leet: false, whole });
      for (const v of unleet(core)) if (v !== core && has(v)) hits.push({ word: v, leet: true, whole });
    }
  }
  if (!hits.length) return null;
  // 置きかえなし → 英字だけの言葉 → 長い言葉 の順に選ぶ
  const score = (x) => (x.leet ? 0 : 1000) + (/^[a-z]+$/.test(x.word) ? 100 : 0) + x.word.length;
  return hits.sort((a, b) => score(b) - score(a))[0];
}

// 総当たりより先に見つかってしまう「弱いパターン」
export function findWeakness(input, commonSet) {
  if (!input) return null;
  const pw = String(input).normalize("NFKC");
  const lower = pw.toLowerCase();
  const has = (w) => Boolean(commonSet && commonSet.has(w));
  if (has(lower)) return { kind: "common", text: "よく使われるパスワードの一覧（辞書）に入っています" };
  const hit = findDictionaryCore(lower, has);
  if (hit && !hit.leet) return { kind: "common-variant", word: hit.word, text: `辞書の言葉「${hit.word}」に数字や記号を足しただけです` };
  if (hit && hit.whole) return { kind: "leet", word: hit.word, text: `辞書の言葉「${hit.word}」の文字を、記号や数字に置きかえただけです` };
  if (hit) return { kind: "leet-variant", word: hit.word, text: `辞書の言葉「${hit.word}」の文字を記号や数字に置きかえて、数字や記号を足しただけです` };
  if (/^(.)\1+$/u.test(pw)) return { kind: "repeat", text: "同じ文字のくり返しです" };
  if (isSequence(lower)) return { kind: "sequence", text: "キーボードや数字の並び順そのままです" };
  if (/^(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/.test(pw) || /^(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/.test(pw))
    return { kind: "date", text: "日付（誕生日など）の形です。知り合いに推測されやすい" };
  return null;
}

const SEQUENCES = ["abcdefghijklmnopqrstuvwxyz", "0123456789", "qwertyuiop", "asdfghjkl", "zxcvbnm", "1qaz2wsx3edc"];
function isSequence(s) {
  if (s.length < 4) return false;
  return SEQUENCES.some((seq) => seq.includes(s) || [...seq].reverse().join("").includes(s));
}

// 秒数 → 「約3日」「約12万年」などの日本語（とても大きな数も Infinity にならないよう、10の何乗かのまま計算する）
const LOG10_YEAR = Math.log10(86400 * 365);
export function formatDuration(log10Seconds) {
  if (!Number.isFinite(log10Seconds)) return "—";
  if (log10Seconds < -3) return "一瞬（0.001秒未満）";
  if (log10Seconds >= LOG10_YEAR) return `約${bigJaLog10(log10Seconds - LOG10_YEAR)}年`;
  const sec = 10 ** log10Seconds;
  if (sec < 1) return `約${trim(sec)}秒`;
  const units = [
    { s: 60, l: "秒" },
    { s: 3600, l: "分", d: 60 },
    { s: 86400, l: "時間", d: 3600 },
    { s: 86400 * 365, l: "日", d: 86400 },
  ];
  for (const u of units) if (sec < u.s) return `約${trim(sec / (u.d || 1))}${u.l}`;
  return `約${bigJa(sec / (86400 * 365))}年`;
}

function trim(x) {
  return x >= 10 ? Math.round(x).toString() : x.toPrecision(2).replace(/\.0+$/, "");
}

// 中学生が知っている単位は「京」まで。それより大きい数は「◯×10の◯乗」で表す（垓・𥝱・穣・澗などは使わない）
const BIG_UNITS = [["京", 16], ["兆", 12], ["億", 8], ["万", 4]];
export const POW_FROM = 20; // 10の20乗（1垓）から「×10の◯乗」で書く

// 大きな数を「万・億・兆・京」で表す。それより大きければ「◯×10の◯乗」
export function bigJa(x) {
  if (x < 1e4) return trim(x);
  return bigJaLog10(Math.log10(x));
}

// 「10の lg 乗」を「◯×10の◯乗」に分ける（9.96 → 10 のようなくり上がりも直す）
export function splitPow(lg) {
  let e = Math.floor(lg);
  let m = Number((10 ** (lg - e)).toPrecision(2));
  if (m >= 10) {
    m = 1;
    e += 1;
  }
  return { m, e };
}

// 「10の lg 乗」を「万・億・兆・京」か「◯×10の◯乗」で表す（300文字のパスワードのような、とても大きな数でも使える）
export function bigJaLog10(lg) {
  if (!Number.isFinite(lg)) return "—";
  if (lg < 4) return trim(10 ** lg);
  if (lg >= 72) return `10の${Math.floor(lg)}乗`;
  if (lg >= POW_FROM) {
    const { m, e } = splitPow(lg);
    return m === 1 ? `10の${e}乗` : `${m}×10の${e}乗`;
  }
  for (const [name, p] of BIG_UNITS) if (lg >= p) return `${trim(10 ** (lg - p))}${name}`;
  return trim(10 ** lg);
}

// 「10の◯乗」を使ったときの説明（使っていなければ空）
export function powNote(...lgs) {
  const shown = lgs.filter((lg) => Number.isFinite(lg) && lg >= POW_FROM);
  if (!shown.length) return "";
  const lg = Math.max(...shown);
  const e = lg >= 72 ? Math.floor(lg) : splitPow(lg).e;
  return `「10の${e}乗」は、1のあとに0が${e}個ならぶ数です。`;
}

// 宇宙の年齢（約138億年）とくらべる。それより短ければ空
export const LOG10_UNIVERSE_YEARS = Math.log10(1.38e10);
export function universeCompare(log10Seconds) {
  if (!Number.isFinite(log10Seconds)) return "";
  const r = log10Seconds - LOG10_YEAR - LOG10_UNIVERSE_YEARS;
  if (r < 0) return "";
  if (r < Math.log10(2)) return "宇宙の年齢（約138億年）と同じくらい";
  // 倍数は2けたにまるめる（2090億倍 → 2100億倍）
  const { m, e } = splitPow(r);
  return `宇宙の年齢（約138億年）の約${bigJaLog10(Math.log10(m) + e)}倍`;
}

// 年数を表したときに使った「10の何乗」（powNote に渡す用）
export function durationLog10(log10Seconds) {
  return log10Seconds >= LOG10_YEAR ? log10Seconds - LOG10_YEAR : -Infinity;
}

// 速さの日本語（1秒に 10^n 回）
export function rateLabel(log10Rate) {
  const n = log10Rate < 4 ? Math.round(10 ** log10Rate).toLocaleString("ja-JP") : bigJaLog10(log10Rate);
  return `1秒に${n}回`;
}

export function crackSeconds(log10Combos, log10Rate) {
  return log10Combos - log10Rate;
}

// 強さの目安（すべて試す時間で判定）
export function rating(log10Seconds, weakness) {
  if (weakness) return { level: "bad", label: "とても弱い" };
  const log10Years = log10Seconds - Math.log10(86400 * 365);
  if (log10Seconds < Math.log10(86400)) return { level: "bad", label: "弱い" };
  if (log10Years < 2) return { level: "warn", label: "もう少し" }; // 100年未満
  return { level: "good", label: "強い" };
}
