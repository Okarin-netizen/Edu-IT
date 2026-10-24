// 計算部分のテスト（Node.js 20以上）: npm test
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultNetwork, cloneNet, shortestPath, countShortestPaths, reachableFrom, resolveName, linkBetween, nodeById,
  parseIPv4, isValidIPv4, sameNetwork, networkAddress, maskFromPrefix, hostCount, toBinary8,
  splitIntoPackets, reassemble, checkNetwork, nextFreeIp, scrambleLike,
  stableRoute, sameRoute, compareRoutes, routeWorks, brokenOnRoute, normalizeIp, normalizeHost, isExampleHost, visiblePart,
  unreachableReason, reasonText, freeSpot, migrateShopNames,
} from "../js/netlib.js";
import { setPaused, isPaused, whenResumed, dragThreshold, VIEW_W, VIEW_H, hostAnchor } from "../js/netview.js";
import { makeDraftSaver, flushDrafts, AUTOSAVE_MS } from "../js/ui.js";
import { store } from "../js/store.js";
import { httpLeakText, LOGIN_BODY, PACKET_SIZE } from "../modules/spy.js";
import { makeDrill, makeQuestion, DRILL_KINDS, makeChallenge, weightParts } from "../js/drilllib.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cut = (net, a, b) => (linkBetween(net, a, b).cut = true);
const down = (net, id) => (nodeById(net, id).down = true);

test("はじめのネットワーク: PCからWebサーバへは家のルータ経由で4本の回線", () => {
  const net = defaultNetwork();
  const p = shortestPath(net, "pc1", "web");
  assert.equal(p[0], "pc1");
  assert.equal(p.at(-1), "web");
  assert.equal(p[1], "home");
  assert.equal(p.length, 5);
  assert.equal(countShortestPaths(net, "pc1", "web"), 2); // A→C と B→D の2とおり
});

test("回線を1本切ると、別の道を迂回する", () => {
  const net = defaultNetwork();
  cut(net, "home", "rA");
  const p = shortestPath(net, "pc1", "web");
  assert.deepEqual(p, ["pc1", "home", "rB", "rD", "web"]);
});

test("ルータが止まると、そのルータを通らない", () => {
  const net = defaultNetwork();
  down(net, "rD");
  const p = shortestPath(net, "pc1", "web");
  assert.ok(p && !p.includes("rD"));
  assert.deepEqual(p, ["pc1", "home", "rA", "rC", "web"]);
});

test("近い道が両方こわれると、遠回りの道で届く", () => {
  const net = defaultNetwork();
  cut(net, "rA", "rC");
  cut(net, "home", "rB");
  assert.deepEqual(shortestPath(net, "pc1", "web"), ["pc1", "home", "rA", "rB", "rD", "web"]);
});

test("道がすべてとぎれると到達不能（null）", () => {
  const net = defaultNetwork();
  cut(net, "pc1", "home");
  assert.equal(shortestPath(net, "pc1", "web"), null);
  const net2 = defaultNetwork();
  down(net2, "rA");
  down(net2, "rB");
  assert.equal(shortestPath(net2, "pc1", "web"), null);
  const reach = reachableFrom(net2, "pc1");
  assert.ok(reach.has("home") && reach.has("phone1"));
  assert.ok(!reach.has("web"));
});

test("宛先が止まっていれば到達不能", () => {
  const net = defaultNetwork();
  down(net, "web");
  assert.equal(shortestPath(net, "pc1", "web"), null);
});

test("ルータ以外（パソコン・サーバ）は中継しない", () => {
  const net = { nodes: [{ id: "a", type: "pc" }, { id: "b", type: "pc" }, { id: "c", type: "server" }], links: [{ id: "1", a: "a", b: "b" }, { id: "2", a: "b", b: "c" }] };
  assert.equal(shortestPath(net, "a", "c"), null);
  net.nodes[1].type = "router";
  assert.deepEqual(shortestPath(net, "a", "c"), ["a", "b", "c"]);
});

test("回線の重み（cost）があるときは合計の小さい道（ダイクストラ）", () => {
  const net = defaultNetwork();
  linkBetween(net, "rA", "rC").cost = 10;
  assert.deepEqual(shortestPath(net, "pc1", "web"), ["pc1", "home", "rB", "rD", "web"]);
});

test("DNS: 名前からIPアドレスを調べる・DNSが止まると調べられない", () => {
  const net = defaultNetwork();
  const r = resolveName(net, "pc1", "kumo-store.example");
  assert.equal(r.ok, true);
  assert.equal(r.ip, "203.0.113.10");
  assert.equal(resolveName(net, "pc1", "Kumo-Store.example").ok, true);
  assert.equal(resolveName(net, "pc1", "nothing.example").reason, "not-found");
  down(net, "dns1");
  assert.equal(resolveName(net, "pc1", "kumo-store.example").reason, "dns-unreachable");
  assert.ok(shortestPath(net, "pc1", "web")); // Webサーバへの道はある
  const net2 = cloneNet(net);
  net2.nodes = net2.nodes.filter((n) => n.type !== "dns");
  assert.equal(resolveName(net2, "pc1", "kumo-store.example").reason, "no-dns");
});

test("IPアドレスの形", () => {
  assert.deepEqual(parseIPv4("192.168.1.10"), [192, 168, 1, 10]);
  for (const ok of ["0.0.0.0", "255.255.255.255", "10.0.0.1"]) assert.ok(isValidIPv4(ok), ok);
  for (const bad of ["256.1.1.1", "1.2.3", "1.2.3.4.5", "a.b.c.d", "01.2.3.4", "1,2,3,4", "", " 1.2.3.-4"]) assert.ok(!isValidIPv4(bad), bad);
});

test("サブネット", () => {
  assert.equal(maskFromPrefix(24), "255.255.255.0");
  assert.equal(maskFromPrefix(25), "255.255.255.128");
  assert.equal(maskFromPrefix(16), "255.255.0.0");
  assert.equal(networkAddress("192.168.1.10", 24), "192.168.1.0");
  assert.equal(networkAddress("192.168.1.200", 25), "192.168.1.128");
  assert.ok(sameNetwork("192.168.1.10", "192.168.1.250", 24));
  assert.ok(!sameNetwork("192.168.1.10", "192.168.2.10", 24));
  assert.ok(sameNetwork("192.168.1.10", "192.168.2.10", 16));
  assert.equal(hostCount(24), 254);
  assert.equal(hostCount(28), 14);
  assert.equal(toBinary8(192), "11000000");
  assert.equal(toBinary8(5), "00000101");
});

test("パケットに分けて、順番がばらばらでも組み立てられる", () => {
  const text = "くもストアへようこそ！今日のおすすめ";
  const ps = splitIntoPackets(text, 4, { from: "a", to: "b" });
  assert.equal(ps.length, Math.ceil([...text].length / 4));
  assert.ok(ps.every((p) => p.total === ps.length && p.from === "a"));
  const shuffled = [...ps].reverse();
  const r = reassemble(shuffled);
  assert.equal(r.text, text);
  assert.ok(r.complete);
  const lost = reassemble(shuffled.filter((p) => p.seq !== 2));
  assert.deepEqual(lost.missing, [2]);
});

test("ネットワークの点検: 重複IP・まちがったIP・つながっていない機器", () => {
  const net = defaultNetwork();
  assert.deepEqual(checkNetwork(net), []);
  nodeById(net, "phone1").ip = "192.168.1.10";
  nodeById(net, "rA").ip = "10.0.0.300";
  net.nodes.push({ id: "x", type: "pc", name: "x", ip: nextFreeIp(net, "pc"), x: 0, y: 0 });
  const kinds = checkNetwork(net).map((i) => i.kind).sort();
  assert.deepEqual(kinds, ["bad-ip", "dup-ip", "isolated"]);
  assert.ok(isValidIPv4(nodeById(net, "x").ip));
});

test("暗号文の模型は中身を含まない", () => {
  const s = scrambleLike("password=neko-sora-123");
  assert.ok(!s.includes("neko"));
  assert.match(s, /^[0-9a-f\s]+$/);
});

test("ドリル: どの種類も正解がちょうど1つ・選択肢が重ならない", () => {
  let seed = 1;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const kind of DRILL_KINDS) {
    for (let i = 0; i < 200; i++) {
      const q = makeQuestion(kind, rng);
      assert.ok(q.choices.length >= 3, `${kind}: 選択肢が少ない`);
      assert.equal(new Set(q.choices).size, q.choices.length, `${kind}: 選択肢が重複 ${q.choices}`);
      assert.ok(q.answer >= 0 && q.answer < q.choices.length);
      if (kind === "validIp") assert.equal(q.choices.filter(isValidIPv4).length, 1);
      if (kind === "sameNet") {
        const base = q.question.match(/(\d+\.\d+\.\d+\.\d+) と同じ/)[1];
        assert.equal(q.choices.filter((c) => sameNetwork(c, base, 24)).length, 1);
        assert.ok(sameNetwork(q.choices[q.answer], base, 24));
      }
      if (kind === "toBinary") assert.equal(parseInt(q.choices[q.answer], 2), Number(q.question.match(/(\d+) を/)[1]));
      if (kind === "fromBinary") assert.equal(Number(q.choices[q.answer]), parseInt(q.question.match(/([01]{8})/)[1], 2));
    }
  }
  const d = makeDrill(10, rng);
  assert.equal(d.length, 10);
  assert.ok(new Set(d.map((q) => q.kind)).size >= 5);
});

test("外部への通信をするコードがない", () => {
  const files = ["js", "modules"].flatMap((d) => readdirSync(join(root, d)).map((f) => join(root, d, f)));
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    assert.ok(!/\bfetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|import\(/.test(src), `${f} に通信する記述`);
    // SVGの名前空間（www.w3.org）は通信ではない
    for (const host of src.match(/[a-z0-9-]+(\.[a-z0-9-]+)+\.(com|net|org|jp|io)\b/gi) || []) if (host !== "www.w3.org") assert.fail(`${f} に実在しうるドメイン ${host}`);
  }
});

// ---- 2026-10-13 レビュー第1段の修正の回帰テスト ----

// 3「回線が切れたら？」と同じ手順で道を決める（modules/fault.js の showRoute と同じ）
function faultRoute(net, from, to, shown) {
  const healed = cloneNet(net);
  healed.links.forEach((l) => delete l.cut);
  healed.nodes.forEach((n) => delete n.down);
  const before = stableRoute(healed, from, to);
  const now = stableRoute(net, from, to, before, shown);
  return { before, now, cmp: compareRoutes(net, before, now) };
}

test("NW-01: 通り道でない回線を切る・直すをくり返しても、太い線（道）は入れかわらない", () => {
  const net = defaultNetwork();
  const first = faultRoute(net, "pc1", "web", null).now;
  assert.ok(first && first.length === 5);
  let shown = first;
  for (let i = 0; i < 6; i++) {
    const l = linkBetween(net, "rD", "dns1");
    l.cut = !l.cut;
    const r = faultRoute(net, "pc1", "web", shown);
    assert.ok(sameRoute(r.now, first), `${i}回目に道が変わった: ${r.now}`);
    shown = r.now;
  }
  // スマホを止めても、道は変わらない
  nodeById(net, "phone1").down = true;
  const r = faultRoute(net, "pc1", "web", shown);
  assert.ok(sameRoute(r.now, first));
});

test("NW-01: 通り道でない所がこわれたときは「同じ道」、通り道がこわれたときだけ「別の道」", () => {
  const net = defaultNetwork();
  const base = faultRoute(net, "pc1", "web", null);
  assert.equal(base.cmp.kind, "ok");
  cut(net, "rD", "dns1");
  assert.equal(faultRoute(net, "pc1", "web", base.now).cmp.kind, "same");
  down(net, "phone1");
  assert.equal(faultRoute(net, "pc1", "web", base.now).cmp.kind, "same");
  // 通り道の回線（家のルータの次）を切る
  const net2 = defaultNetwork();
  const b2 = faultRoute(net2, "pc1", "web", null).now;
  cut(net2, b2[1], b2[2]);
  const r2 = faultRoute(net2, "pc1", "web", b2);
  assert.equal(r2.cmp.kind, "detour");
  assert.ok(!sameRoute(r2.now, b2));
  assert.equal(r2.cmp.brokenNames.length, 1);
  assert.match(r2.cmp.brokenNames[0], /家のルータ–ルータ[AB]/);
  assert.equal(r2.cmp.middle[0], "家のルータ");
  assert.ok(routeWorks(net2, r2.now));
  assert.deepEqual(brokenOnRoute(net2, b2).links, [[b2[1], b2[2]]]);
  // 道がすべてとぎれると「届かない」
  cut(net2, "pc1", "home");
  assert.equal(faultRoute(net2, "pc1", "web", r2.now).cmp.kind, "unreachable");
});

test("NW-01: 迂回した道は、まだ使えるあいだは続けて使う（くじで変えない）", () => {
  // 同じ長さの迂回路が2本ある形：s - r1 - (r2 | r3) - r4 - t、いつもの道は s - r1 - r4 - t
  const N = (id, type = "router") => ({ id, type, name: id, ip: "10.0.0.1", x: 0, y: 0 });
  const L = (a, b) => ({ id: `${a}-${b}`, a, b });
  const net = { nodes: [N("s", "pc"), N("r1"), N("r2"), N("r3"), N("r4"), N("t", "server")], links: [L("s", "r1"), L("r1", "r4"), L("r1", "r2"), L("r1", "r3"), L("r2", "r4"), L("r3", "r4"), L("r4", "t")] };
  const base = faultRoute(net, "s", "t", null).now;
  assert.deepEqual(base, ["s", "r1", "r4", "t"]);
  cut(net, "r1", "r4");
  const d1 = faultRoute(net, "s", "t", base).now;
  for (let i = 0; i < 10; i++) assert.ok(sameRoute(faultRoute(net, "s", "t", d1).now, d1));
  // 迂回していない方（r3 経由など）の別の回線を切っても、今の迂回路はそのまま
  const other = d1.includes("r2") ? "r3" : "r2";
  cut(net, "r1", other);
  assert.ok(sameRoute(faultRoute(net, "s", "t", d1).now, d1));
  // 今の迂回路を切ると、もう1本の迂回路へ
  cut(net, d1[1], d1[2]);
  const d2 = faultRoute(net, "s", "t", d1);
  assert.equal(d2.now, null); // r2・r3 の両方が使えない → 届かない
});

test("NW-01: 3の画面は、太い線の道をくじ（shortestPath の rng）で選んでいない", () => {
  const src = readFileSync(join(root, "modules/fault.js"), "utf8");
  assert.ok(/stableRoute\(net, fromSel\.value, toSel\.value/.test(src));
  assert.ok(!/faultCount\(\) \? "<br>こわれたところをさけて/.test(src));
  assert.ok(src.includes("今回の通り道ではなかったので、同じ道で届きました"));
});

test("NW-06: ふりかえりは、ボタンを押さなくても少し待つと自動で保存される", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    store.reset();
    let text = "";
    let saved = 0;
    const statuses = [];
    const saver = makeDraftSaver("flow", () => text, { onSaved: () => saved++, onStatus: (m) => statuses.push(m) });
    text = "ルー";
    saver.schedule();
    assert.equal(store.getReflection("flow"), "");
    mock.timers.tick(AUTOSAVE_MS);
    assert.equal(store.getReflection("flow"), "ルー"); // 短くても下書きは残る
    assert.equal(saved, 0); // 5文字未満は「できた」にしない（ボタンと同じきまり）
    text = "ルータが別の道を選ぶから";
    saver.schedule();
    mock.timers.tick(AUTOSAVE_MS - 1);
    assert.equal(store.getReflection("flow"), "ルー");
    mock.timers.tick(1);
    assert.equal(store.getReflection("flow"), "ルータが別の道を選ぶから");
    assert.equal(saved, 1);
    assert.equal(statuses.at(-1), "保存しました");
    // ページを移る・閉じるときは、待たずにすぐ保存（flushDrafts）
    text = "ルータが別の道を選ぶから届く";
    saver.schedule();
    flushDrafts();
    assert.equal(store.getReflection("build") , "");
    assert.equal(store.getReflection("flow"), "ルータが別の道を選ぶから届く");
    assert.equal(store.state.reflections.flow.text, "ルータが別の道を選ぶから届く"); // 書き出し（JSON・CSV）と同じ場所
    assert.equal(saver.pending, false);
  } finally {
    mock.timers.reset();
    store.reset();
  }
});

test("NW-06: ふりかえりの欄に、自動保存の文が出る・ページを移るときに保存する", () => {
  const ui = readFileSync(join(root, "js/ui.js"), "utf8");
  const app = readFileSync(join(root, "js/app.js"), "utf8");
  assert.ok(ui.includes("書いた文は、自動でこの端末に保存されます。"));
  assert.ok(/addEventListener\("pagehide", flushDrafts\)/.test(ui));
  assert.ok(/function route\(\) \{\s*flushDrafts\(\);/.test(app));
});

test("NW-09: 全角の数字・点のIPアドレスも受けつける", () => {
  assert.equal(normalizeIp("１９２．１６８．１．２５"), "192.168.1.25");
  assert.equal(normalizeIp("192.168.1.２５"), "192.168.1.25");
  assert.equal(normalizeIp(" 192. 168 .1.10　"), "192.168.1.10");
  assert.equal(normalizeIp("192。168。1。10"), "192.168.1.10");
  assert.ok(isValidIPv4(normalizeIp("２０３．０．１１３．１０")));
  assert.ok(!isValidIPv4(normalizeIp("192,168,1,10")));
  assert.equal(normalizeIp(""), "");
  assert.equal(normalizeHost(" ＷＷＷ．Kumo-Store．example "), "www.kumo-store.example");
  assert.equal(normalizeHost("https://www.kumo-store.example/login"), "www.kumo-store.example");
  assert.ok(isExampleHost("www.kumo-store.example"));
  for (const bad of ["www.google.com", "", "example", ".example", "www..example"]) assert.ok(!isExampleHost(bad), bad);
});

test("NW-11: のぞき見で見えたパケットに合わせて、説明の文が変わる", () => {
  const total = [...LOGIN_BODY].length;
  assert.equal(Math.ceil(total / PACKET_SIZE), 3);
  assert.deepEqual(visiblePart(LOGIN_BODY, PACKET_SIZE, [2], "password=neko-sora-123"), { state: "part", text: "password=nek…" });
  assert.equal(visiblePart(LOGIN_BODY, PACKET_SIZE, [1], "password=neko-sora-123").state, "none");
  assert.equal(visiblePart(LOGIN_BODY, PACKET_SIZE, [2, 3], "password=neko-sora-123").state, "all");
  const part = httpLeakText([2], 3);
  assert.ok(part.includes("パスワードの一部") && part.includes("password=nek") && part.includes("3個のうち1個"));
  assert.ok(!part.includes("IDとパスワード（"));
  assert.ok(httpLeakText([1, 2, 3], 3).includes("IDとパスワード（<code>neko-sora-123</code>）がそのまま読めて"));
  const spy = readFileSync(join(root, "modules/spy.js"), "utf8");
  assert.ok(spy.includes("HTTPSでも、通信の相手（IPアドレスやサイト名）や、いつ・どれくらい通信したかは見えることがあります。"));
});

test("NW-10・NW-12: 2の表の下の注と、はじめにの言い方", () => {
  const flow = readFileSync(join(root, "modules/flow.js"), "utf8");
  assert.ok(flow.includes("ここでは暗号化しないで送っています"));
  assert.ok(flow.includes("家のルータが、外に出るときに自分の番号に付けかえています（NAT）"));
  const app = readFileSync(join(root, "js/app.js"), "utf8");
  assert.ok(app.includes("家の中で使う番号（プライベートアドレス）と、説明用に予約された番号"));
  assert.ok(!app.includes("IPアドレスは説明用に予約された番号です"));
});

// ---- 2026-10-13 レビュー第2段の修正の回帰テスト ----

test("NW-03: ドリル10問には /25・/28 の台数問題が出ない。チャレンジ問題は別にあり、答えが正しい", () => {
  let seed = 7;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 500; k++) {
    for (const q of makeDrill(10, rng)) {
      assert.ok(!/\/2[58]|255\.255\.255\.(128|240)/.test(q.question), q.question);
      assert.ok(!q.challenge);
      if (q.kind === "hosts") assert.ok(["254", "256", "8ビット"].includes(q.choices[q.answer]) || /\.(0|255)$/.test(q.choices[q.answer]), q.choices[q.answer]);
    }
  }
  const ch = makeChallenge(rng);
  assert.deepEqual(ch.map((q) => q.prefix), [25, 28]);
  assert.ok(ch.every((q) => q.challenge));
  assert.deepEqual(ch.map((q) => q.choices[q.answer]), [String(hostCount(25)), String(hostCount(28))]);
  assert.deepEqual(ch.map((q) => q.choices[q.answer]), ["126", "14"]);
});

test("NW-03: 2進数の重みの説明（68 = 64 + 4 → 01000100）", () => {
  assert.deepEqual(weightParts(68), [64, 4]);
  assert.deepEqual(weightParts(255), [128, 64, 32, 16, 8, 4, 2, 1]);
  assert.deepEqual(weightParts(0), []);
  let found = false;
  for (let i = 0; i < 300 && !found; i++) {
    const q = makeQuestion("toBinary");
    const n = Number(q.question.match(/(\d+) を/)[1]);
    assert.ok(q.explain.startsWith(`${n} = ${weightParts(n).join(" + ")} → ${toBinary8(n)}`), q.explain);
    found = true;
  }
  const drill = readFileSync(join(root, "modules/drill.js"), "utf8");
  assert.ok(drill.includes("128・64・32・16・8・4・2・1"));
  assert.ok(drill.indexOf("2進数の読み方（重み）") < drill.indexOf("IPアドレスを入れてみよう"));
});

test("NW-07: 届かないわけ（パソコンは中継しない・つながっていない・こわれたところ）", () => {
  const net = defaultNetwork();
  assert.equal(unreachableReason(net, "pc1", "web").kind, "ok");
  // スマホを「わたしのPC」にだけつなぐ
  net.links = net.links.filter((l) => l.id !== "phone1-home");
  net.links.push({ id: "phone1-pc1", a: "phone1", b: "pc1" });
  const r = unreachableReason(net, "phone1", "web");
  assert.equal(r.kind, "no-relay");
  assert.equal(r.node.id, "pc1");
  assert.ok(reasonText(r, "くもストア").includes("パソコンはパケットを中継しない"));
  // どこにもつながっていない機器
  net.nodes.push({ id: "pc2", type: "pc", name: "パソコン2", ip: "192.168.1.20", x: 100, y: 465 });
  const iso = unreachableReason(net, "pc2", "web");
  assert.equal(iso.kind, "isolated");
  assert.ok(reasonText(iso, "くもストア").includes("どこにもつながっていません"));
  // こわれたところのせい
  const net2 = defaultNetwork();
  cut(net2, "pc1", "home");
  assert.equal(unreachableReason(net2, "pc1", "web").kind, "broken");
  down(net2, "web");
  assert.equal(unreachableReason(net2, "pc1", "web").kind, "to-down");
  // 線がまったくない
  const net3 = defaultNetwork();
  net3.links = net3.links.filter((l) => l.a !== "web" && l.b !== "web");
  assert.equal(unreachableReason(net3, "pc1", "web").kind, "isolated");
  assert.equal(unreachableReason(net3, "pc1", "nothing").kind, "missing");
});

test("NW-04: クリックで置く機器は、ほかの機器や線と重ならない所に、左下から置く", () => {
  const net = defaultNetwork();
  for (let i = 0; i < 4; i++) {
    const p = freeSpot(net, VIEW_W, VIEW_H);
    for (const n of net.nodes) assert.ok(Math.hypot(n.x - p.x, n.y - p.y) >= 110, `${i}: ${n.id} に近すぎる`);
    assert.ok(p.x >= 40 && p.x <= VIEW_W - 40 && p.y >= 50 && p.y <= VIEW_H - 75);
    net.nodes.push({ id: `pc${i + 10}`, type: "pc", name: `p${i}`, ip: `192.168.1.${20 + i}`, x: p.x, y: p.y });
  }
  assert.equal(net.nodes[9].y, VIEW_H - 75); // いちばん下の行から
  // 空きがなくても、どこかを返す
  const full = { nodes: [], links: [] };
  for (let x = 40; x <= 880; x += 60) for (let y = 50; y <= 465; y += 60) full.nodes.push({ id: `${x}-${y}`, x, y });
  const q = freeSpot(full, VIEW_W, VIEW_H);
  assert.ok(Number.isFinite(q.x) && Number.isFinite(q.y));
});

test("NW-02: 一時停止のあいだは待つ・つづけると進む。2ではページを動かさない", async () => {
  setPaused(false);
  assert.equal(isPaused(), false);
  let resumed = false;
  setPaused(true);
  const w = whenResumed().then(() => (resumed = true));
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(resumed, false);
  setPaused(false);
  await w;
  assert.equal(resumed, true);
  const flow = readFileSync(join(root, "modules/flow.js"), "utf8");
  assert.ok(!flow.includes("scrollIntoView"));
  assert.ok(flow.includes("⏸ 一時停止") && flow.includes("⏭ 1つずつ進む"));
});

test("NW-14: 指で押したときは、少しぶれても「押した」。図の上でページをスクロールできる", () => {
  assert.ok(dragThreshold("touch") >= 10);
  assert.equal(dragThreshold("mouse"), 4);
  const css = readFileSync(join(root, "css/style.css"), "utf8");
  const canvasRule = css.match(/\.net-canvas \{[^}]*\}/)[0];
  assert.ok(!canvasRule.includes("touch-action"));
  assert.ok(css.includes('.net-canvas[data-tool="move"] .nn { touch-action: none; }'));
});

test("NW-05: 「消す」は線のある機器で確かめる・1つもどすがある・つなぐで線を外さない", () => {
  const build = readFileSync(join(root, "modules/build.js"), "utf8");
  assert.ok(build.includes("つながっている線${lines}本を消します。よろしいですか？"));
  assert.ok(build.includes("↶ 1つもどす"));
  assert.ok(build.includes("もうつながっています"));
  assert.ok(!build.includes("もう一度つなぐと線が外れます"));
});

test("NW-08・NW-13・NW-16・NW-17: 足りない機器の案内・用語・クイズのやり直し・2時間の目安", () => {
  const src = (f) => readFileSync(join(root, f), "utf8");
  for (const f of ["modules/fault.js", "modules/spy.js"]) assert.ok(src(f).includes("たりない機器"), f);
  assert.ok(src("modules/flow.js").includes("<strong>プロトコル</strong>"));
  assert.ok(src("modules/spy.js").includes("POST /login」は、HTTPで"));
  assert.ok(src("modules/drill.js").includes("/24 は「前から24ビット＝前の3つの数がネットワーク部」"));
  for (const f of ["modules/build.js", "modules/flow.js", "modules/fault.js", "modules/spy.js"]) assert.ok(/\{ retry: true \}/.test(src(f)), f);
  const placeholders = ["build", "flow", "fault", "spy", "drill"].map((m) => src(`modules/${m}.js`).match(/placeholder: "([^"]+)"/)[1]);
  assert.equal(new Set(placeholders).size, 5);
  assert.ok(!src("js/ui.js").includes("すると安全になる"));
  const app = src("js/app.js");
  assert.ok(!app.includes("授業で使うとき（2時間）"), "時間わりは先生用ガイドに移した。生徒の画面には出さない");
  assert.ok(/num: 1, period: 1/.test(app) && /num: 2, period: 1/.test(app) && /num: 3, period: 2/.test(app) && /num: 4, period: 2/.test(app) && /num: 5, period: 2/.test(app));
});

test("記録: 組と番号がないと書き出さない・書き出したらファイル名を出す・出すのはJSON", () => {
  const app = readFileSync(join(root, "js/app.js"), "utf8");
  assert.ok(app.includes("組と番号を入れてから書き出そう"));
  assert.ok(app.includes("ファイルを保存しました（ファイル名: ${filename}）。先生に言われた場所に出そう。"));
  assert.ok(app.includes("先生に出すのは JSON のファイルです。"));
});

test("店の名前は情報セキュリティ体験ラボとそろえる（NW-18）・前の版の名前は直す", () => {
  const web = nodeById(defaultNetwork(), "web");
  assert.equal(web.name, "クモストア");
  assert.equal(web.host, "kumo-store.example");
  assert.ok(isExampleHost(web.host));
  const old = defaultNetwork();
  Object.assign(nodeById(old, "web"), { name: "くもストア", host: "www.kumo-store.example" });
  migrateShopNames(old);
  assert.equal(nodeById(old, "web").name, "クモストア");
  assert.equal(nodeById(old, "web").host, "kumo-store.example");
  // 生徒が自分で変えた名前は変えない
  const mine = defaultNetwork();
  Object.assign(nodeById(mine, "web"), { name: "ぼくの店", host: "my-shop.example" });
  migrateShopNames(mine);
  assert.equal(nodeById(mine, "web").name, "ぼくの店");
  assert.equal(nodeById(mine, "web").host, "my-shop.example");
});

test("サイト名は図の左右のはしで切れない向きに置く（NW-15）", () => {
  assert.deepEqual(hostAnchor(VIEW_W / 2), { x: 0, "text-anchor": "middle" });
  const r = hostAnchor(840);
  assert.equal(r["text-anchor"], "end");
  assert.ok(840 + r.x <= VIEW_W - 8 && r.x <= 40);
  const l = hostAnchor(40);
  assert.equal(l["text-anchor"], "start");
  assert.ok(40 + l.x >= 8 && l.x >= -40);
});

// ---- 2026-10-17 考えずに答えが当たる問題の修正の回帰テスト ----
const seededRng = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

test("2進数の問題: 選択肢の各けたの多数決や「まん中の数」で正解が当たらない（4択の偶然くらい）", () => {
  const rng = seededRng(11);
  const ones = (x) => [...x.toString(2)].filter((b) => b === "1").length;
  for (const kind of ["toBinary", "fromBinary"]) {
    let maj = 0, mid = 0, oneBit = 0, total = 0;
    const N = 6000;
    for (let i = 0; i < N; i++) {
      const q = makeQuestion(kind, rng);
      const vals = q.choices.map((c) => (kind === "toBinary" ? parseInt(c, 2) : Number(c)));
      assert.equal(new Set(vals).size, 4);
      assert.ok(vals.every((v) => v >= 1 && v <= 255));
      let m = 0;
      for (let b = 0; b < 8; b++) if (vals.filter((v) => v & (1 << b)).length >= 3) m |= 1 << b;
      if (m === vals[q.answer]) maj++;
      const gap = vals.map((v) => vals.reduce((a, u) => a + Math.abs(u - v), 0));
      if (gap[q.answer] === Math.min(...gap) && gap.filter((g) => g === Math.min(...gap)).length === 1) mid++;
      for (const [i, v] of vals.entries()) if (i !== q.answer) { total++; if (ones(v ^ vals[q.answer]) === 1) oneBit++; }
    }
    assert.ok(maj / N < 0.3, `${kind}: 多数決で ${maj / N}`);
    assert.ok(mid / N < 0.3, `${kind}: まん中の数で ${mid / N}`);
    assert.ok(oneBit / total < 0.5, `${kind}: 1けただけちがうまちがいが多すぎる ${oneBit / total}`);
  }
});

test("台数の問題: いつも254ではなく、聞き方が変わる（どれも /24 の範囲）", () => {
  const rng = seededRng(5);
  const answers = {};
  const N = 5000;
  for (let i = 0; i < N; i++) {
    const q = makeQuestion("hosts", rng);
    assert.equal(q.prefix, 24);
    assert.ok(!/\/2[58]|\/26|\/30/.test(q.question), q.question);
    const a = q.choices[q.answer];
    const key = a.replace(/^\d+\.\d+\.\d+\./, "x.");
    answers[key] = (answers[key] || 0) + 1;
    if (key === "x.0" || key === "x.255") {
      const ip = q.question.match(/\d+\.\d+\.\d+\.\d+/g).find((x) => x !== "255.255.255.0");
      assert.ok(isValidIPv4(a));
      assert.ok(sameNetwork(a, ip, 24), `${a} は ${ip} と同じネットワーク`);
      assert.equal(networkAddress(a, 24) === a, key === "x.0");
      assert.ok(q.explain.includes(a));
    }
    if (a === "254") assert.ok(q.explain.includes("254台"));
    if (a === "256") assert.ok(q.explain.includes("256とおり"));
  }
  assert.deepEqual(Object.keys(answers).sort(), ["254", "256", "8ビット", "x.0", "x.255"].sort());
  for (const v of Object.values(answers)) assert.ok(v / N > 0.15 && v / N < 0.25, JSON.stringify(answers));
});

test("IPアドレスの書き方の問題: 正解の始まり（192.168. など）で選べない", () => {
  const rng = seededRng(9);
  const heads = {};
  const N = 5000;
  for (let i = 0; i < N; i++) {
    const q = makeQuestion("validIp", rng);
    const ok = q.choices[q.answer];
    assert.ok(isValidIPv4(ok));
    const head = ok.split(".")[0];
    heads[head] = (heads[head] || 0) + 1;
    // まちがいも同じ始まり（コンマのものも同じ数で始まる）
    for (const c of q.choices) assert.ok(c.startsWith(head + ".") || c.startsWith(head + ","), `${ok} / ${c}`);
  }
  for (const h of ["10", "172", "192"]) assert.ok(heads[h] / N > 0.28, JSON.stringify(heads));
});
