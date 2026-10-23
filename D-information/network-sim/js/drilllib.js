// IPアドレス・ネットワークの基礎ドリルの問題を作る（画面に依存しない。テストあり）
import { isValidIPv4, sameNetwork, toBinary8, hostCount } from "./netlib.js";

const ri = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
function uniq(rng, make, n, avoid = new Set()) {
  const out = [];
  const seen = new Set(avoid);
  let guard = 0;
  while (out.length < n && guard++ < 500) {
    const v = make();
    if (!seen.has(String(v))) {
      seen.add(String(v));
      out.push(v);
    }
  }
  return out;
}
// 正解をランダムな位置に入れる
function place(rng, correct, wrongs) {
  const choices = [...wrongs];
  const answer = ri(rng, 0, choices.length);
  choices.splice(answer, 0, correct);
  return { choices: choices.map(String), answer };
}

// 2進数の重み（128・64・…・1）のうち、n を作るもの。例：68 → [64, 4]
export function weightParts(n) {
  return [128, 64, 32, 16, 8, 4, 2, 1].filter((w) => n & w);
}
// ---- 2進数の問題の「よくあるまちがい」 ----
// 1ビットだけ変えたまちがいばかりだと、選択肢の各けたの多数決で正解がわかってしまう。
// そこで、実際によくあるまちがい（けたの順を逆に書く・1ずれ・重みを1つずらす・2けたまちがえる・
// 1を1つとなりに書く・0と1を逆にする）から選ぶ。
const rev8 = (n) => parseInt([...toBinary8(n)].reverse().join(""), 2);
const popcount = (n) => [...toBinary8(n)].filter((b) => b === "1").length;
const hamming = (a, b) => popcount(a ^ b);
function flipTwo(rng, n) {
  const i = ri(rng, 0, 7);
  let j = ri(rng, 0, 6);
  if (j >= i) j++;
  return n ^ (1 << i) ^ (1 << j);
}
function moveOneBit(rng, n) {
  const opts = [];
  for (let i = 0; i < 8; i++) for (const j of [i - 1, i + 1]) if (j >= 0 && j < 8 && n & (1 << i) && !(n & (1 << j))) opts.push(n ^ (1 << i) ^ (1 << j));
  return opts.length ? pick(rng, opts) : -1;
}
function binaryMistakePool(rng, n) {
  const pool = [rev8(n), n + 1, n - 1, (n << 1) & 255, n >> 1, flipTwo(rng, n), flipTwo(rng, n), flipTwo(rng, n), moveOneBit(rng, n), moveOneBit(rng, n), 255 - n];
  return [...new Set(pool.filter((v) => v >= 1 && v <= 255 && v !== n))];
}
function sample3(rng, arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, 3);
}
// 正解が「みんなのまん中」（各けたの多数決・ほかとのちがいがいちばん少ないもの・10進数で真ん中の数）になっているか
function isCenter(choices) {
  let major = 0;
  for (let b = 0; b < 8; b++) if (choices.filter((v) => v & (1 << b)).length * 2 > choices.length) major |= 1 << b;
  const d = choices.map((v) => hamming(v, major));
  const sum = choices.map((v) => choices.reduce((a, u) => a + hamming(u, v), 0));
  const gap = choices.map((v) => choices.reduce((a, u) => a + Math.abs(u - v), 0));
  return d[0] === Math.min(...d) || sum[0] === Math.min(...sum) || gap[0] === Math.min(...gap);
}
// まちがい3つ。正解がまん中になる組を少し減らして、多数決で当たる割合を4択の偶然（約25%）くらいにする
export function binaryWrongs(rng, n) {
  const pool = binaryMistakePool(rng, n);
  let w = sample3(rng, pool);
  if (rng() < 0.6) return w;
  for (let k = 0; k < 30 && isCenter([n, ...w]); k++) w = sample3(rng, pool);
  return w;
}

const MASKS = { 24: "255.255.255.0", 25: "255.255.255.128", 28: "255.255.255.240" };
function hostsQuestion(rng, p) {
  const ok = hostCount(p);
  const wrongs = [2 ** (32 - p), 2 ** (32 - p) - 1, p].filter((x) => x !== ok);
  const all = 2 ** (32 - p);
  return {
    kind: "hosts",
    prefix: p,
    question: `サブネットマスク ${MASKS[p]}（/${p}）のネットワークがあります。IPアドレスを割り当てられる機器は、最大で何台？`,
    ...place(rng, ok, wrongs),
    explain:
      p === 24
        ? "/24 のときは、最後の1つの数（ホスト部・8ビット）で機器を見分けます。256とおりのうち、0（ネットワークの番号）と255（全員あて）は使えないので、254台です。"
        : `/${p} は「前から${p}ビットがネットワーク部」という意味です。ホスト部は ${32 - p} ビットなので 2の${32 - p}乗 = ${all} とおり。いちばん小さい番号と大きい番号は使えないので、${ok}台です。`,
  };
}

// /24 のネットワークの例（家や学校で使う番号）
function net24(rng) {
  return pick(rng, [() => `192.168.${ri(rng, 0, 20)}`, () => `10.${ri(rng, 0, 255)}.${ri(rng, 0, 255)}`, () => `172.${ri(rng, 16, 31)}.${ri(rng, 0, 255)}`])();
}
const HOST_VARIANTS = [
  // 1. 機器の最大台数 → 254
  (rng) => hostsQuestion(rng, 24),
  // 2. ホスト部の番号は何とおり → 256
  (rng) => ({
    question: "サブネットマスク 255.255.255.0（/24）のとき、最後の1つの数がホスト部です。0 から数えて、全部で何とおりの番号を表せる？（使えない番号もふくめる）",
    ...place(rng, 256, [254, 255, 8]),
    explain: "ホスト部は8ビットなので、2の8乗 = 256とおり（0〜255）です。そのうち2つ（0と255）は、機器に使えません。だから、機器に割り当てられるのは254台です。",
  }),
  // 3. ホスト部のビット数 → 8ビット
  (rng) => ({
    question: "サブネットマスク 255.255.255.0（/24）のとき、ホスト部は何ビット？（ホスト部は、機器を見分ける部分）",
    ...place(rng, "8ビット", ["24ビット", "32ビット", "16ビット"]),
    explain: "IPv4アドレスは全部で32ビット。/24 は「前から24ビットがネットワーク部」です。だから、残りの 32 − 24 = 8ビット（最後の1つの数）がホスト部です。",
  }),
  // 4. 全員あての番号 → x.x.x.255
  (rng) => {
    const n = net24(rng);
    return {
      question: `ネットワーク ${n}.0/24 で、全員あての番号はどれ？（機器には使えない番号）`,
      ...place(rng, `${n}.255`, [`${n}.1`, `${n}.254`, `${n}.100`]),
      explain: `/24 では最後の1つの数（ホスト部）で機器を見分けます。${n}.255（全員あて）と ${n}.0（ネットワークの番号）は、機器に使えません。`,
    };
  },
  // 5. ネットワークそのものを表す番号 → x.x.x.0
  (rng) => {
    const n = net24(rng);
    const host = `${n}.${ri(rng, 2, 253)}`;
    return {
      question: `サブネットマスクは 255.255.255.0（/24）です。IPアドレスが ${host} の機器があります。この機器のネットワークそのものを表す番号はどれ？`,
      // 「後ろ2つを0にする」まちがい（3つ目がもともと0のときは、かわりに 254）
      ...place(rng, `${n}.0`, [`${n}.255`, `${n}.1`, n.endsWith(".0") ? `${n}.254` : `${n.split(".").slice(0, 2).join(".")}.0.0`]),
      explain: `/24 では前の3つの数（${n}）がネットワーク部です。ホスト部を0にした ${n}.0 が、ネットワークそのものを表す番号です。いちばん大きい ${n}.255 は、全員あての番号です。`,
    };
  },
];

const GEN = {
  validIp(rng) {
    // 正解の始まり（10.／172.16〜31.／192.168.）は毎回変え、まちがいも同じ始まりにする（始まりだけで選べないように）
    const head = pick(rng, [() => `10.${ri(rng, 0, 255)}`, () => `172.${ri(rng, 16, 31)}`, () => "192.168"])();
    const ok = `${head}.${ri(rng, 0, 255)}.${ri(rng, 1, 254)}`;
    const bads = [
      () => `${head}.${ri(rng, 0, 255)}.${ri(rng, 256, 300)}`,
      () => `${head}.${ri(rng, 256, 999)}.${ri(rng, 1, 254)}`,
      () => `${head}.${ri(rng, 0, 255)}`,
      () => `${head}.${ri(rng, 0, 255)}.${ri(rng, 1, 254)}.${ri(rng, 1, 9)}`,
      () => `${head.replace(".", ",")},${ri(rng, 0, 255)},${ri(rng, 1, 254)}`,
    ];
    const wrongs = uniq(rng, () => pick(rng, bads)(), 3, new Set([ok])).filter((x) => !isValidIPv4(x));
    return { kind: "validIp", question: "正しいIPアドレス（IPv4）の書き方になっているのはどれ？", ...place(rng, ok, wrongs), explain: "IPv4アドレスは、0〜255の数を4つ、点（.）で区切って書きます。次のものはまちがいです。256以上の数があるもの、数が3つ・5つのもの、点のかわりにコンマ（,）を使ったもの。" };
  },
  sameNet(rng) {
    const c = ri(rng, 0, 9);
    const base = `192.168.${c}.${ri(rng, 2, 99)}`;
    const ok = `192.168.${c}.${ri(rng, 100, 250)}`;
    const wrongs = uniq(rng, () => `192.168.${pick(rng, [c + 1, c + 2, c + 10, c + 20])}.${ri(rng, 2, 250)}`, 3, new Set([ok])).filter((x) => !sameNetwork(x, base, 24));
    return {
      kind: "sameNet",
      question: `サブネットマスクは 255.255.255.0（/24）です。${base} と同じネットワークにあるのはどれ？`,
      ...place(rng, ok, wrongs),
      explain: "255.255.255.0 のときは、前の3つの数（ネットワーク部）を見ます。同じなら、同じネットワークです。最後の1つの数（ホスト部）で機器を見分けます。",
    };
  },
  toBinary(rng) {
    const n = ri(rng, 1, 255);
    const ok = toBinary8(n);
    const wrongs = binaryWrongs(rng, n).map(toBinary8);
    return {
      kind: "toBinary",
      question: `10進数の ${n} を、2進数8けたで表すとどれ？`,
      ...place(rng, ok, wrongs),
      explain: `${n} = ${weightParts(n).join(" + ")} → ${ok}。大きい重み（128・64・32・16・8・4・2・1）から順に引きます。引けるところを1、引けないところを0にします。`,
    };
  },
  fromBinary(rng) {
    const n = ri(rng, 1, 255);
    const wrongs = binaryWrongs(rng, n);
    const bits = toBinary8(n);
    return { kind: "fromBinary", question: `2進数の ${bits} を10進数で表すといくつ？`, ...place(rng, n, wrongs), explain: `1のところの重みを足します：${weightParts(n).join(" + ")} = ${n}` };
  },
  // ホスト部の問題（/24 だけ。/25・/28 はチャレンジ問題 makeChallenge で出す）。
  // いつも「254台」にならないように、聞き方を5種類から選ぶ
  hosts(rng) {
    const v = pick(rng, HOST_VARIANTS);
    return { ...v(rng), kind: "hosts", prefix: 24 };
  },
  role(rng) {
    const qs = [
      { question: "サイトの名前（ドメイン名）から、IPアドレスを調べる役目の機器は？", ok: "DNSサーバ", wrongs: ["ルータ", "Webサーバ", "スマホ"], explain: "DNSサーバは、名前とIPアドレスの対応表を持っている「電話帳」の役目です。" },
      { question: "パケットの宛先を見て、次にどの回線へ送るかを決める機器は？", ok: "ルータ", wrongs: ["DNSサーバ", "Webサーバ", "パソコン"], explain: "ルータはパケットの宛先IPアドレスを見て、目的地に近づく回線へ中継します。" },
      { question: "たのまれたWebページのデータを送り返す機器は？", ok: "Webサーバ", wrongs: ["ルータ", "DNSサーバ", "スマホ"], explain: "Webサーバは、クライアントのお願いに応えて、ページを送ります。クライアントとは、パソコンやスマホのブラウザです。" },
      { question: "IPv4アドレスは、全部で何ビットの数？", ok: "32ビット", wrongs: ["8ビット", "16ビット", "64ビット"], explain: "8ビットの数が4つで、8×4＝32ビットです。" },
      { question: "パケットに付いている情報として、ふさわしくないものはどれ？", ok: "送った人の顔写真", wrongs: ["宛先のIPアドレス", "送信元のIPアドレス", "何番目のパケットかを表す番号"], explain: "パケットには、届けて組み立てるための情報（ヘッダ）が付いています。宛先・送信元のIPアドレスや番号などです。" },
    ];
    const q = pick(rng, qs);
    return { kind: "role", question: q.question, ...place(rng, q.ok, q.wrongs), explain: q.explain };
  },
};
export const DRILL_KINDS = Object.keys(GEN);

export function makeQuestion(kind, rng = Math.random) {
  return GEN[kind](rng);
}

// チャレンジ問題（サブネット /25・/28）。中学の範囲をこえるので、クリアの数には入れない（NW-03）
export function makeChallenge(rng = Math.random) {
  return [25, 28].map((p) => ({ ...hostsQuestion(rng, p), challenge: true }));
}

// 10問のセット（種類がかたよらないように順にまぜる）
export function makeDrill(n = 10, rng = Math.random) {
  const order = [];
  while (order.length < n) {
    const round = [...DRILL_KINDS];
    for (let i = round.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [round[i], round[j]] = [round[j], round[i]];
    }
    order.push(...round);
  }
  return order.slice(0, n).map((k) => makeQuestion(k, rng));
}
