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
const MASKS = { 24: "255.255.255.0", 25: "255.255.255.128", 28: "255.255.255.240" };
function hostsQuestion(rng, p) {
  const ok = hostCount(p);
  const wrongs = [2 ** (32 - p), 2 ** (32 - p) - 1, p].filter((x) => x !== ok);
  const all = 2 ** (32 - p);
  return {
    kind: "hosts",
    prefix: p,
    question: `サブネットマスク ${MASKS[p]}（/${p}）のネットワークに、IPアドレスを割り当てられる機器は最大で何台？`,
    ...place(rng, ok, wrongs),
    explain:
      p === 24
        ? "/24 のときは、最後の1つの数（ホスト部・8ビット）で機器を見分けます。0〜255 の 256とおりのうち、0（ネットワークそのものを表す番号）と 255（ネットワークの全員あての番号）の2つは機器に使えないので、254台です。"
        : `/${p} は「前から${p}ビットがネットワーク部」という意味です。ホスト部は ${32 - p} ビットなので 2の${32 - p}乗 = ${all} とおり。そのうち、いちばん小さい番号（ネットワークそのものを表す番号）といちばん大きい番号（全員あての番号）の2つは使えないので、${ok}台です。`,
  };
}

const GEN = {
  validIp(rng) {
    const ok = `192.168.${ri(rng, 0, 9)}.${ri(rng, 1, 254)}`;
    const bads = [
      () => `192.168.${ri(rng, 0, 9)}.${ri(rng, 256, 300)}`,
      () => `10.${ri(rng, 0, 255)}.${ri(rng, 0, 255)}`,
      () => `172.16.${ri(rng, 0, 9)}.${ri(rng, 1, 99)}.${ri(rng, 1, 9)}`,
      () => `${ri(rng, 300, 999)}.0.113.${ri(rng, 1, 254)}`,
      () => `203,0,113,${ri(rng, 1, 254)}`,
    ];
    const wrongs = uniq(rng, () => pick(rng, bads)(), 3, new Set([ok])).filter((x) => !isValidIPv4(x));
    return { kind: "validIp", question: "正しいIPアドレス（IPv4）の書き方になっているのはどれ？", ...place(rng, ok, wrongs), explain: "IPv4アドレスは、0〜255の数を4つ、点（.）で区切って書きます。256以上の数や、数が3つ・5つのものはまちがいです。" };
  },
  sameNet(rng) {
    const c = ri(rng, 0, 9);
    const base = `192.168.${c}.${ri(rng, 2, 99)}`;
    const ok = `192.168.${c}.${ri(rng, 100, 250)}`;
    const wrongs = uniq(rng, () => `192.168.${pick(rng, [c + 1, c + 2, c + 10, c + 20])}.${ri(rng, 2, 250)}`, 3, new Set([ok])).filter((x) => !sameNetwork(x, base, 24));
    return {
      kind: "sameNet",
      question: `サブネットマスクが 255.255.255.0（/24）のとき、${base} と同じネットワークにあるのはどれ？`,
      ...place(rng, ok, wrongs),
      explain: "255.255.255.0 のときは、前の3つの数（ネットワーク部）が同じなら同じネットワークです。最後の1つの数（ホスト部）で機器を見分けます。",
    };
  },
  toBinary(rng) {
    const n = ri(rng, 1, 255);
    const ok = toBinary8(n);
    const wrongs = uniq(rng, () => toBinary8(n ^ (1 << ri(rng, 0, 7))), 3, new Set([ok]));
    return {
      kind: "toBinary",
      question: `10進数の ${n} を、2進数8けたで表すとどれ？`,
      ...place(rng, ok, wrongs),
      explain: `${n} = ${weightParts(n).join(" + ")} → ${ok}。大きい重み（128・64・32・16・8・4・2・1）から順に、引けるところを1、引けないところを0にします。`,
    };
  },
  fromBinary(rng) {
    const n = ri(rng, 1, 255);
    const wrongs = uniq(rng, () => n ^ (1 << ri(rng, 0, 7)), 3, new Set([String(n)]));
    const bits = toBinary8(n);
    return { kind: "fromBinary", question: `2進数の ${bits} を10進数で表すといくつ？`, ...place(rng, n, wrongs), explain: `1のところの重みを足します：${weightParts(n).join(" + ")} = ${n}` };
  },
  // 機器の台数（/24 だけ。/25・/28 はチャレンジ問題 makeChallenge で出す）
  hosts(rng) {
    return hostsQuestion(rng, 24);
  },
  role(rng) {
    const qs = [
      { question: "サイトの名前（ドメイン名）から、IPアドレスを調べる役目の機器は？", ok: "DNSサーバ", wrongs: ["ルータ", "Webサーバ", "スマホ"], explain: "DNSサーバは、名前とIPアドレスの対応表を持っている「電話帳」の役目です。" },
      { question: "パケットの宛先を見て、次にどの回線へ送るかを決める機器は？", ok: "ルータ", wrongs: ["DNSサーバ", "Webサーバ", "パソコン"], explain: "ルータはパケットの宛先IPアドレスを見て、目的地に近づく回線へ中継します。" },
      { question: "たのまれたWebページのデータを送り返す機器は？", ok: "Webサーバ", wrongs: ["ルータ", "DNSサーバ", "スマホ"], explain: "Webサーバは、クライアント（パソコンやスマホのブラウザ）のお願いに応えて、ページを送ります。" },
      { question: "IPv4アドレスは、全部で何ビットの数？", ok: "32ビット", wrongs: ["8ビット", "16ビット", "64ビット"], explain: "8ビットの数が4つで、8×4＝32ビットです。" },
      { question: "パケットに付いている情報として、ふさわしくないものはどれ？", ok: "送った人の顔写真", wrongs: ["宛先のIPアドレス", "送信元のIPアドレス", "何番目のパケットかを表す番号"], explain: "パケットには、宛先・送信元のIPアドレスや番号など、届けて組み立てるための情報（ヘッダ）が付いています。" },
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
