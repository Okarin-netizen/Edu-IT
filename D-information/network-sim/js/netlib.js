// ネットワークの計算（画面に依存しない部分。tests/unit.test.mjs でテストする）
// すべてブラウザの中の「模型のネットワーク」。実際のネットワークには一切さわらない。

// 機器の種類。forward: true の機器（ルータ）だけが、他の機器あてのパケットを中継する
export const NODE_TYPES = {
  pc: { label: "パソコン", icon: "💻", forward: false, client: true },
  phone: { label: "スマホ", icon: "📱", forward: false, client: true },
  router: { label: "ルータ", icon: "🔀", forward: true, client: false },
  server: { label: "Webサーバ", icon: "🖥", forward: false, client: false },
  dns: { label: "DNSサーバ", icon: "📖", forward: false, client: false },
};

// はじめのネットワーク（家庭 → プロバイダの網の目 → サーバ）
// IPアドレスは、家の中はプライベートアドレス、外は説明用に予約されたアドレス（203.0.113.x など）を使う
export function defaultNetwork() {
  const nodes = [
    { id: "pc1", type: "pc", name: "わたしのPC", ip: "192.168.1.10", x: 80, y: 170 },
    { id: "phone1", type: "phone", name: "スマホ", ip: "192.168.1.11", x: 80, y: 370 },
    { id: "home", type: "router", name: "家のルータ", ip: "192.168.1.1", x: 240, y: 270 },
    { id: "rA", type: "router", name: "ルータA", ip: "10.0.0.1", x: 420, y: 140 },
    { id: "rB", type: "router", name: "ルータB", ip: "10.0.0.2", x: 420, y: 400 },
    { id: "rC", type: "router", name: "ルータC", ip: "10.0.0.3", x: 620, y: 140 },
    { id: "rD", type: "router", name: "ルータD", ip: "10.0.0.4", x: 620, y: 400 },
    { id: "web", type: "server", name: "クモストア", host: "kumo-store.example", ip: "203.0.113.10", x: 840, y: 170 },
    { id: "dns1", type: "dns", name: "DNSサーバ", ip: "198.51.100.53", x: 840, y: 400 },
  ];
  const pairs = [
    ["pc1", "home"], ["phone1", "home"], ["home", "rA"], ["home", "rB"], ["rA", "rB"],
    ["rA", "rC"], ["rB", "rD"], ["rC", "rD"], ["rC", "web"], ["rD", "web"], ["rD", "dns1"],
  ];
  return { nodes, links: pairs.map(([a, b]) => ({ id: `${a}-${b}`, a, b })) };
}

// 前の版の店の名前（くもストア／www.kumo-store.example）を、情報セキュリティ体験ラボと同じ
// 「クモストア」「kumo-store.example」に直す（NW-18）。生徒が自分で変えた名前はそのまま。
export function migrateShopNames(net) {
  for (const n of net?.nodes || []) {
    if (n.type !== "server") continue;
    if (n.host === "www.kumo-store.example") n.host = "kumo-store.example";
    if (n.name === "くもストア") n.name = "クモストア";
  }
  return net;
}

export function cloneNet(net) {
  return JSON.parse(JSON.stringify(net));
}

export const nodeById = (net, id) => net.nodes.find((n) => n.id === id);
export const linkBetween = (net, a, b) => net.links.find((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a));
export const canForward = (node) => Boolean(NODE_TYPES[node?.type]?.forward);

// 使える隣の機器（回線が切れていない・相手が止まっていない）
function neighbors(net, id) {
  const out = [];
  for (const l of net.links) {
    if (l.cut) continue;
    const other = l.a === id ? l.b : l.b === id ? l.a : null;
    if (!other) continue;
    const n = nodeById(net, other);
    if (n && !n.down) out.push({ id: other, cost: l.cost || 1 });
  }
  return out;
}

// ダイクストラ法で、いちばん近い道（通る回線の数が少ない道）を探す。
// 同じ長さの道が複数あるときは rng で選ぶ（パケットごとに道が変わることがある）。
// 途中で中継できるのはルータだけ。届かないときは null。
export function shortestPath(net, from, to, rng = Math.random) {
  const src = nodeById(net, from);
  const dst = nodeById(net, to);
  if (!src || !dst || src.down || dst.down) return null;
  if (from === to) return [from];
  const dist = new Map([[from, 0]]);
  const preds = new Map([[from, []]]);
  const done = new Set();
  const queue = [from];
  while (queue.length) {
    queue.sort((x, y) => dist.get(x) - dist.get(y));
    const u = queue.shift();
    if (done.has(u)) continue;
    done.add(u);
    if (u !== from && !canForward(nodeById(net, u))) continue; // ルータ以外は中継しない
    for (const { id: v, cost } of neighbors(net, u)) {
      const d = dist.get(u) + cost;
      const cur = dist.get(v);
      if (cur === undefined || d < cur) {
        dist.set(v, d);
        preds.set(v, [u]);
        queue.push(v);
      } else if (d === cur) {
        preds.get(v).push(u);
      }
    }
  }
  if (!dist.has(to)) return null;
  const path = [to];
  let cur = to;
  while (cur !== from) {
    const ps = preds.get(cur);
    cur = ps[Math.min(ps.length - 1, Math.floor(rng() * ps.length))];
    path.unshift(cur);
  }
  return path;
}

// 同じ長さの道がいくつあるか（テストと説明用）
export function countShortestPaths(net, from, to) {
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const p = shortestPath(net, from, to, () => Math.random());
    if (!p) return 0;
    seen.add(p.join(">"));
  }
  return seen.size;
}

// 道がいまも使えるか（回線が切れていない・機器が止まっていない・途中はルータだけ）
export function routeWorks(net, path) {
  if (!Array.isArray(path) || !path.length) return false;
  for (let i = 0; i < path.length; i++) {
    const n = nodeById(net, path[i]);
    if (!n || n.down) return false;
    if (i > 0 && i < path.length - 1 && !canForward(n)) return false;
    if (i > 0) {
      const l = linkBetween(net, path[i - 1], path[i]);
      if (!l || l.cut) return false;
    }
  }
  return true;
}
const routeCost = (net, path) => {
  let c = 0;
  for (let i = 1; i < path.length; i++) c += linkBetween(net, path[i - 1], path[i])?.cost || 1;
  return c;
};
export const sameRoute = (a, b) => Boolean(a && b && a.join(">") === b.join(">"));

// 図に太い線で出す道を決める（くじは使わない。くじで道を変えるのは「2」のパケットのアニメだけ）。
// prefer にあげた道が、まだ使えて、いちばん近い道と同じ長さなら、その道をそのまま使う（前から順に）。
// そうでなければ、毎回同じ決まった道を選ぶ。届かないときは null。
export function stableRoute(net, from, to, ...prefer) {
  const best = shortestPath(net, from, to, () => 0);
  if (!best) return null;
  const cost = routeCost(net, best);
  for (const p of prefer) {
    if (p && p[0] === from && p[p.length - 1] === to && routeWorks(net, p) && routeCost(net, p) === cost) return p;
  }
  return best;
}

// 道の上で、こわれているところ（切れた回線・止まった機器）
export function brokenOnRoute(net, path) {
  const out = { links: [], nodes: [] };
  if (!path) return out;
  for (let i = 0; i < path.length; i++) {
    const n = nodeById(net, path[i]);
    if (n?.down) out.nodes.push(n.id);
    if (i > 0) {
      const l = linkBetween(net, path[i - 1], path[i]);
      if (!l || l.cut) out.links.push([path[i - 1], path[i]]);
    }
  }
  return out;
}

// こわす前の道（before）と、いまの道（now）をくらべる。
// kind: "ok"（こわれたところがない）| "same"（こわれたところは通り道ではない）| "detour"（別の道になった）| "unreachable"
export function compareRoutes(net, before, now) {
  const faults = net.links.filter((l) => l.cut).length + net.nodes.filter((n) => n.down).length;
  const name = (id) => nodeById(net, id)?.name || id;
  const broken = brokenOnRoute(net, before);
  const brokenNames = [...broken.links.map(([a, b]) => `${name(a)}–${name(b)}`), ...broken.nodes.map(name)];
  if (!now) return { kind: "unreachable", faults, brokenNames };
  if (!faults) return { kind: "ok", faults, brokenNames };
  if (sameRoute(before, now)) return { kind: "same", faults, brokenNames };
  return { kind: "detour", faults, brokenNames, middle: now.slice(1, -1).map(name) };
}

// from から届く機器（中継はルータだけ）
export function reachableFrom(net, from) {
  const start = nodeById(net, from);
  if (!start || start.down) return new Set();
  const seen = new Set([from]);
  const stack = [from];
  while (stack.length) {
    const u = stack.pop();
    if (u !== from && !canForward(nodeById(net, u))) continue;
    for (const { id: v } of neighbors(net, u)) {
      if (!seen.has(v)) {
        seen.add(v);
        stack.push(v);
      }
    }
  }
  return seen;
}

// DNSの名前解決。届くDNSサーバに聞いて、名前（host）からIPアドレスを調べる
export function resolveName(net, clientId, host) {
  const dnsServers = net.nodes.filter((n) => n.type === "dns");
  if (!dnsServers.length) return { ok: false, reason: "no-dns" };
  let path = null;
  let dns = null;
  for (const d of dnsServers) {
    const p = shortestPath(net, clientId, d.id);
    if (p && (!path || p.length < path.length)) {
      path = p;
      dns = d;
    }
  }
  if (!path) return { ok: false, reason: "dns-unreachable" };
  const target = net.nodes.find((n) => n.type === "server" && n.host && n.host.toLowerCase() === String(host).trim().toLowerCase());
  if (!target) return { ok: false, reason: "not-found", dns, path };
  return { ok: true, dns, path, ip: target.ip, server: target };
}

// 届かないわけ（NW-07）。中継できるのはルータだけ、というきまりも説明に使う。
// kind: "ok" | "missing" | "to-down" | "from-down" | "isolated"（node がどこにもつながっていない）
//   | "broken"（こわれたところのせい） | "no-relay"（線はつながっているが、途中にルータでない機器 node がある） | "no-line"（線でつながっていない）
export function unreachableReason(net, fromId, toId) {
  const from = nodeById(net, fromId);
  const to = nodeById(net, toId);
  if (!from || !to) return { kind: "missing" };
  if (shortestPath(net, fromId, toId, () => 0)) return { kind: "ok" };
  if (to.down) return { kind: "to-down", node: to };
  if (from.down) return { kind: "from-down", node: from };
  const wired = (id) => net.links.some((l) => (l.a === id || l.b === id) && nodeById(net, l.a) && nodeById(net, l.b));
  if (!wired(fromId)) return { kind: "isolated", node: from };
  if (!wired(toId)) return { kind: "isolated", node: to };
  const healed = cloneNet(net);
  healed.links.forEach((l) => delete l.cut);
  healed.nodes.forEach((n) => delete n.down);
  if (shortestPath(healed, fromId, toId, () => 0)) return { kind: "broken" };
  // ルータでない機器も中継できるとしたら届くか（線だけを見て、近い順にさがす）
  const prev = new Map([[fromId, null]]);
  const queue = [fromId];
  while (queue.length && !prev.has(toId)) {
    const u = queue.shift();
    for (const l of net.links) {
      const v = l.a === u ? l.b : l.b === u ? l.a : null;
      if (v && !prev.has(v) && nodeById(net, v)) {
        prev.set(v, u);
        queue.push(v);
      }
    }
  }
  if (!prev.has(toId)) return { kind: "no-line" };
  const path = [];
  for (let v = toId; v !== null; v = prev.get(v)) path.unshift(v);
  const node = path
    .slice(1, -1)
    .map((id) => nodeById(net, id))
    .find((n) => !canForward(n));
  return { kind: "no-relay", node, path };
}
// 届かないわけを、中学生向けの文にする（HTMLではない、ふつうの文字）
export function reasonText(r, toName) {
  switch (r?.kind) {
    case "to-down":
      return `「${r.node.name}」そのものが止まっています。`;
    case "from-down":
      return `送る側の「${r.node.name}」が止まっています。`;
    case "isolated":
      return `「${r.node.name}」は、どこにもつながっていません。線でつなごう。`;
    case "broken":
      return `こわれたところのせいで、${toName} までの道がすべてとぎれています。`;
    case "no-relay":
      return `「${r.node.name}」の先へは進めません。${NODE_TYPES[r.node.type]?.label || "この機器"}はパケットを中継しないからです（中継するのはルータだけ）。ルータにつなごう。`;
    case "no-line":
      return `${toName} まで、線がつながっていません。`;
    default:
      return "";
  }
}

// 点(px,py)から線分(a-b)までのきょり
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
// 新しい機器を置く、空いている場所（ほかの機器や線と重ならない所）。図の左下から順にさがす（NW-04）。
// 空きがなければ、いちばん空いている所。
export function freeSpot(net, W, H, { minNode = 110, minLink = 45 } = {}) {
  let best = null;
  for (let y = H - 75; y >= 60; y -= 35) {
    for (let x = 60; x <= W - 60; x += 40) {
      let dn = Infinity;
      for (const n of net.nodes) dn = Math.min(dn, Math.hypot(n.x - x, n.y - y));
      let dl = Infinity;
      for (const l of net.links) {
        const a = nodeById(net, l.a);
        const b = nodeById(net, l.b);
        if (a && b) dl = Math.min(dl, segDist(x, y, a.x, a.y, b.x, b.y));
      }
      if (dn >= minNode && dl >= minLink) return { x, y };
      const score = Math.min(dn / minNode, dl / minLink);
      if (!best || score > best.score) best = { x, y, score };
    }
  }
  return { x: best.x, y: best.y };
}

// ---- IPアドレス ----
export function parseIPv4(s) {
  const parts = String(s).trim().split(".");
  if (parts.length !== 4) return null;
  const nums = [];
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    if (p.length > 1 && p[0] === "0") return null; // 012 のような書き方はしない
    const n = Number(p);
    if (n > 255) return null;
    nums.push(n);
  }
  return nums;
}
export const isValidIPv4 = (s) => parseIPv4(s) !== null;

// 生徒が打った文字を、判定の前にそろえる（全角の数字・点を半角に、前後と途中の空白を取る）
export function normalizeIp(s) {
  return String(s ?? "")
    .normalize("NFKC")
    .replace(/[。｡]/g, ".")
    .replace(/\s+/g, "")
    .trim();
}
// サイトの名前（ドメイン名）をそろえる（全角を半角に、空白を取る、小文字に、http:// と / から後ろを取る）
export function normalizeHost(s) {
  return String(s ?? "")
    .normalize("NFKC")
    .replace(/[。｡]/g, ".")
    .replace(/\s+/g, "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
}
// 説明用の名前（最後が .example）になっているか
export const isExampleHost = (host) => /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+example$/.test(String(host));
export const IP_FORMAT_HELP = "半角の数字（0〜255）を4つ、点（.）で区切って書こう。例：192.168.1.10";

const toInt = (nums) => ((nums[0] << 24) >>> 0) + (nums[1] << 16) + (nums[2] << 8) + nums[3];
const fromInt = (n) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
const maskInt = (prefix) => (prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0);

export const maskFromPrefix = (prefix) => fromInt(maskInt(prefix));
export function networkAddress(ip, prefix = 24) {
  const nums = parseIPv4(ip);
  if (!nums) return null;
  return fromInt((toInt(nums) & maskInt(prefix)) >>> 0);
}
export function sameNetwork(a, b, prefix = 24) {
  const na = networkAddress(a, prefix);
  return na !== null && na === networkAddress(b, prefix);
}
// つなげられる機器の数（ネットワークを表す番号とブロードキャスト用の2つを除く）
export const hostCount = (prefix) => Math.max(0, 2 ** (32 - prefix) - 2);
export const toBinary8 = (n) => Number(n).toString(2).padStart(8, "0");

// 機器を追加するときの空いているIPアドレス
export function nextFreeIp(net, type) {
  const used = new Set(net.nodes.map((n) => n.ip));
  const base = { pc: ["192.168.1.", 20], phone: ["192.168.1.", 30], router: ["10.0.0.", 11], server: ["203.0.113.", 20], dns: ["198.51.100.", 60] }[type] || ["10.0.1.", 1];
  for (let i = base[1]; i < 255; i++) if (!used.has(base[0] + i)) return base[0] + i;
  return "";
}

// ネットワークの点検（IPアドレスの書き方・重なり、つながっていない機器）
export function checkNetwork(net) {
  const issues = [];
  const byIp = new Map();
  for (const n of net.nodes) {
    if (!isValidIPv4(n.ip)) issues.push({ kind: "bad-ip", node: n.id, text: `「${n.name}」のIPアドレス「${n.ip || "（空）"}」は正しい形ではありません。0〜255の数を4つ、点で区切ります` });
    else if (byIp.has(n.ip)) issues.push({ kind: "dup-ip", node: n.id, text: `「${n.name}」と「${byIp.get(n.ip).name}」が同じIPアドレス ${n.ip} です。同じだと、どちらに届ければよいかわかりません` });
    else byIp.set(n.ip, n);
    if (!net.links.some((l) => l.a === n.id || l.b === n.id)) issues.push({ kind: "isolated", node: n.id, text: `「${n.name}」がどこにもつながっていません` });
  }
  return issues;
}

// ---- パケット ----
// データを小さなまとまり（パケット）に分ける。各パケットには番号・宛先・送信元が付く
export function splitIntoPackets(text, size, header = {}) {
  const chars = [...String(text)];
  const total = Math.max(1, Math.ceil(chars.length / size));
  const out = [];
  for (let i = 0; i < total; i++) out.push({ ...header, seq: i + 1, total, data: chars.slice(i * size, (i + 1) * size).join("") });
  return out;
}

// 届いた順がばらばらでも、番号順に並べれば元にもどる。足りない番号も調べる
export function reassemble(packets) {
  if (!packets.length) return { text: "", missing: [], complete: false };
  const total = packets[0].total;
  const bySeq = new Map(packets.map((p) => [p.seq, p]));
  const missing = [];
  for (let i = 1; i <= total; i++) if (!bySeq.has(i)) missing.push(i);
  const text = [...bySeq.values()].sort((a, b) => a.seq - b.seq).map((p) => p.data).join("");
  return { text, missing, complete: missing.length === 0 };
}

// のぞき見で、ある部分（たとえば "password=neko-sora-123"）がどれだけ見えたか。
// body を size 文字ずつのパケットに分けたとき、番号が seenSeqs のパケットだけが見えたとする。
// 返り値: { state: "all" | "part" | "none", text: 見えた文字（見えない所は「…」） }
export function visiblePart(body, size, seenSeqs, field) {
  const chars = [...String(body)];
  const f = [...String(field)];
  let start = -1;
  for (let i = 0; i + f.length <= chars.length && start < 0; i++) if (f.every((c, k) => chars[i + k] === c)) start = i;
  if (start < 0 || !f.length) return { state: "none", text: "" };
  const seen = new Set(seenSeqs);
  let text = "";
  let shown = 0;
  for (let i = 0; i < f.length; i++) {
    if (seen.has(Math.floor((start + i) / size) + 1)) {
      text += f[i];
      shown++;
    } else if (!text.endsWith("…")) text += "…";
  }
  return { state: shown === f.length ? "all" : shown ? "part" : "none", text: shown ? text : "" };
}

// 暗号化したように見せる模型（中身の代わりに意味のない16進数を表示する。本物の暗号ではない）
export function scrambleLike(text, rng = Math.random) {
  const len = new TextEncoder().encode(String(text)).length + 16;
  let s = "";
  for (let i = 0; i < len; i++) s += Math.floor(rng() * 256).toString(16).padStart(2, "0") + (i % 16 === 15 ? "\n" : " ");
  return s.trim();
}
