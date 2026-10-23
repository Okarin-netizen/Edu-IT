// モジュール2: Webページが届くまで（DNS問い合わせ → IPアドレス → パケットに分ける → 経路 → 組み立て）
import { h, explainCard, stepCard, reflectionBox, choiceQuiz, escapeHtml as escape, simSplit, revealBetween } from "../js/ui.js";
import { store } from "../js/store.js";
import { NODE_TYPES, cloneNet, nodeById, shortestPath, resolveName, splitIntoPackets, reassemble, normalizeHost, unreachableReason, reasonText } from "../js/netlib.js";
import { createNetView, speedControl, wait, pathText, setPaused, isPaused, whenResumed } from "../js/netview.js";

const ID = "flow";
const STEPS = [
  { id: "run", title: "Webページを見てみよう" },
  { id: "dns", title: "DNSのしごと" },
  { id: "packet", title: "なぜパケットに分けるの？" },
  { id: "reflect", title: "ふりかえり" },
];

export const pageText = (server) => `${server.name}へようこそ！今日のおすすめは、青いノートと消しゴムのセットです。`;

export const flowModule = {
  id: ID,
  minutes: "15分",
  lead: "ブラウザにサイトの名前を入れると、Webページが表示されます。そのあいだ、ネットワークの中では何が起きているのでしょう。DNSへの問い合わせ、パケットへの分割、ルータの中継、組み立てを順番に見てみよう。",
  steps: STEPS,
  render(root) {
    const cards = STEPS.map((s, i) => stepCard(ID, s, i));
    const net = cloneNet(store.net);
    const view = createNetView({ net, label: "通信のようすを表すネットワーク図" });

    const clients = net.nodes.filter((n) => NODE_TYPES[n.type].client);
    const servers = net.nodes.filter((n) => n.type === "server" && n.host);
    const clientSel = h("select", { id: "flow-client" }, clients.map((c) => h("option", { value: c.id }, `${c.name}（${c.ip}）`)));
    const hostList = h("datalist", { id: "flow-hosts" }, servers.map((s) => h("option", { value: s.host })));
    const urlIn = h("input", { type: "text", id: "flow-url", list: "flow-hosts", value: servers[0]?.host || "", spellcheck: "false", autocomplete: "off" });

    const log = h("ol", { class: "flow-log", "aria-live": "polite" });
    const logHint = h("p", { class: "hint" }, "「▶ 通信スタート」を押すと、ここに ①〜⑦ の説明が出ます。「⏭ 1つずつ進む」で始めると、1つごとに止まります。");
    const startBtn = h("button", { type: "button", class: "btn" }, "▶ 通信スタート");
    const pauseBtn = h("button", { type: "button", class: "btn secondary", disabled: true }, "⏸ 一時停止");
    const stepBtn = h("button", { type: "button", class: "btn secondary" }, "⏭ 1つずつ進む");
    const playState = h("p", { class: "hint play-state", "aria-live": "polite" });
    let running = false;
    let stepMode = false; // 1つずつ進むとき、①〜⑦の文が1つ出るごとに止まる
    const canvas = h("div", { class: "net-canvas" }, view.el);
    const split = simSplit(canvas, logHint, log);

    function refreshPlay() {
      startBtn.disabled = running;
      pauseBtn.disabled = !running;
      pauseBtn.textContent = running && isPaused() ? "▶ つづける" : "⏸ 一時停止";
      pauseBtn.setAttribute("aria-pressed", running && isPaused() ? "true" : "false");
      stepBtn.textContent = running && isPaused() ? "⏭ 次へ進む" : "⏭ 1つずつ進む";
      playState.textContent = !running ? "" : isPaused() ? "止まっています。「⏭ 次へ進む」で1つ進みます。「▶ つづける」で最後まで進みます。" : stepMode ? "次の文が出たら止まります。" : "";
    }
    // 文を出したあと、止めているあいだはここで待つ（画面がちがうページに移ったら、やめる）
    const ABORT = Symbol("abort");
    async function gate() {
      if (stepMode) setPaused(true);
      refreshPlay();
      await whenResumed();
      if (!view.el.isConnected) throw ABORT;
      refreshPlay();
    }
    // ページは動かさない（NW-02）。右の欄の中だけを、新しい文までスクロールする
    const say = (html, kind = "") => {
      const li = h("li", { class: kind, html });
      log.append(li);
      split.scrollSideToEnd();
      return li;
    };

    pauseBtn.addEventListener("click", () => {
      if (!running) return;
      if (isPaused()) {
        stepMode = false;
        setPaused(false);
      } else setPaused(true);
      refreshPlay();
    });
    stepBtn.addEventListener("click", () => {
      stepMode = true;
      if (!running) return run();
      setPaused(false);
      refreshPlay();
    });

    async function run() {
      if (running) return;
      running = true;
      setPaused(false);
      refreshPlay();
      revealBetween(startBtn, canvas);
      logHint.hidden = true;
      log.replaceChildren();
      view.clearMarks();
      try {
        const client = nodeById(net, clientSel.value);
        const host = normalizeHost(urlIn.value);
        if (!client) return say("パソコンかスマホを、組み立て画面で置いてください。", "bad");
        if (!host) {
          say("サイトの名前を入れよう。例：<code>kumo-store.example</code>", "bad");
          urlIn.focus();
          return;
        }
        say(`① ブラウザに <code>${escape(host)}</code> と入力しました。でも、名前のままでは相手に送れません。<strong>IPアドレス</strong>が必要です。`);
        await gate();

        // DNS
        const dns = resolveName(net, client.id, host);
        if (!dns.ok && dns.reason !== "not-found") {
          const dnsNode = net.nodes.find((n) => n.type === "dns");
          const why = dnsNode ? reasonText(unreachableReason(net, client.id, dnsNode.id), dnsNode.name) : "";
          say(dns.reason === "no-dns" ? "DNSサーバがないので、名前からIPアドレスを調べられません。組み立て画面でDNSサーバを置いてつなごう。" : `DNSサーバまでの道がありません。名前を調べられないので、ページを開けません。${escape(why)}`, "bad");
          return;
        }
        view.setPath(dns.path);
        say(`② <strong>DNSサーバ</strong>（${dns.dns.ip}）に「${escape(host)} のIPアドレスは？」と問い合わせます。`);
        await gate();
        await view.animate(dns.path, { label: "？", kind: "dns" });
        await view.animate([...dns.path].reverse(), { label: "IP", kind: "dns" });
        if (!dns.ok) {
          say(`DNSサーバの答え：「${escape(host)} という名前は見つかりません」。名前がまちがっていないか確かめよう。`, "bad");
          view.setPath(null);
          return;
        }
        say(`③ DNSサーバの答え：「${escape(host)} は <strong>${dns.ip}</strong> です」`, "good");
        await gate();

        // リクエスト
        const server = dns.server;
        const reqPath = shortestPath(net, client.id, server.id);
        if (!reqPath) {
          say(`IPアドレスはわかったけれど、${escape(server.name)} までの道がありません（到達できない）。${escape(reasonText(unreachableReason(net, client.id, server.id), server.name))}`, "bad");
          view.setPath(null);
          return;
        }
        view.setPath(reqPath);
        say(`④ ${server.ip} あてに「ページをください」というお願い（<strong>GET</strong>）を送ります。道：${escape(pathText(net, reqPath))}`);
        await gate();
        await view.animate(reqPath, { label: "GET", kind: "req" });

        // パケットに分けて送る
        const packets = splitIntoPackets(pageText(server), 8, { from: server.ip, to: client.ip });
        const li5 = say(`⑤ Webサーバは、ページを <strong>${packets.length}個のパケット</strong> に分けて送り返します。一つ一つに「宛先」「送信元」「番号」が付いています。こうした情報を<strong>ヘッダ</strong>といいます。`);
        const rows = packets.map((p) => h("tr", { "data-seq": p.seq }, h("td", {}, `${p.seq}/${p.total}`), h("td", { class: "mono" }, p.to), h("td", { class: "mono" }, p.from), h("td", {}, p.data), h("td", { class: "arrive" }, "…")));
        const packetBox = h("div", { class: "packet-box" });
        li5.append(packetBox);
        packetBox.replaceChildren(h("div", { class: "table-wrap" }, h("table", { class: "data packets-table" }, h("caption", { class: "hint" }, "送られるパケット"), h("thead", {}, h("tr", {}, h("th", {}, "番号"), h("th", {}, "宛先IP"), h("th", {}, "送信元IP"), h("th", {}, "中身"), h("th", {}, "とう着"))), h("tbody", {}, rows))),
          h("p", { class: "hint packets-note" }, "※ しくみを見やすくするため、ここでは暗号化しないで送っています。暗号化するとどうなるかは「④ のぞき見と暗号化」で比べます。"),
          h("p", { class: "hint packets-note" }, "※ 192.168.… のような家の中の番号は、そのままではインターネットに出られません。じつは、家のルータが、外に出るときに自分の番号に付けかえています（NAT）。"),
        );
        split.scrollSideToEnd();
        await gate();
        const arrived = [];
        const usedPaths = new Set();
        view.setPath(null);
        await Promise.all(
          packets.map(async (p, i) => {
            await wait(i * 260);
            const path = shortestPath(net, server.id, client.id);
            if (!path) return;
            usedPaths.add(pathText(net, path));
            await view.animate(path, { label: String(p.seq), kind: "data", hopMs: 450 + Math.random() * 500 });
            arrived.push(p);
            const cell = rows[p.seq - 1].querySelector(".arrive");
            cell.textContent = `${arrived.length}番目`;
          }),
        );
        say(`⑥ とどいた順番：<strong>${arrived.map((p) => p.seq).join(" → ")}</strong>${usedPaths.size > 1 ? `（${usedPaths.size}とおりの道を通りました）` : ""}`);
        await gate();
        const re = reassemble(arrived);
        const li7 = say(`⑦ ブラウザは番号の順に並べ直して、元のページに<strong>組み立て</strong>ます。`, "good");
        li7.append(
          h("div", { class: "mock flow-browser" }, h("div", { class: "mock-bar" }, h("span", { class: "dots" }), h("span", { class: "url" }, `https://${host}/`)), h("div", { class: "mock-body" }, h("p", { class: "logo" }, server.name), h("p", {}, re.text))),
        );
        split.scrollSideToEnd();
        if (view.el.isConnected) cards[0].done();
      } catch (e) {
        if (e !== ABORT) throw e;
      } finally {
        running = false;
        stepMode = false;
        setPaused(false);
        refreshPlay();
      }
    }
    startBtn.addEventListener("click", () => {
      stepMode = false;
      run();
    });

    cards[0].body.append(
      h("p", {}, "どの機器から、どのサイトを見るかを決めて「通信スタート」を押そう。とちゅうで止めたり、1つずつ進めたりできます。"),
      h("div", { class: "field-row" }, h("div", { class: "field" }, h("label", { for: "flow-client" }, "使う機器"), clientSel), h("div", { class: "field" }, h("label", { for: "flow-url" }, "サイトの名前"), urlIn, hostList)),
      h("div", { class: "btn-row" }, startBtn, pauseBtn, stepBtn, speedControl(h)),
      playState,
      split.el,
      h("div", { class: "legend-row hint" }, h("span", { class: "pk k-dns" }, "？"), " DNSへの問い合わせ　", h("span", { class: "pk k-req" }, "GET"), " ページのお願い　", h("span", { class: "pk k-data" }, "1"), " ページのパケット（数字は番号）"),
      ...(!clients.length || !servers.length ? [explainCard("たりない機器", "「ネットワークを組み立てる」で、パソコンかスマホとWebサーバを置こう。", "warn")] : []),
      explainCard(
        "プロトコル（通信の約束ごと）",
        "ネットワークでは、送る側と受け取る側が、同じ<strong>約束ごと</strong>を守って通信します。この約束ごとを<strong>プロトコル</strong>といいます。Webページは <strong>HTTP</strong>（暗号化するときは <strong>HTTPS</strong>）、パケットを届けるのは <strong>IP</strong> というプロトコルです。",
      ),
    );

    cards[1].body.append(
      explainCard("DNSは電話帳", "人は <code>kumo-store.example</code> のような<strong>名前</strong>で覚えます。でも機器どうしは、<strong>IPアドレス</strong>（数字）で相手を見分けます。名前からIPアドレスを調べるのがDNSサーバのしごとです。"),
      choiceQuiz(
        {
          question: "DNSサーバが止まってしまったら、どうなる？",
          choices: ["サイトの名前からIPアドレスを調べられず、名前ではページを開けなくなる", "回線がすべて切れる", "パソコンの電源が切れる", "ページの文字が暗号化される"],
          answer: 0,
          explain: "ネットワークがつながっていても、送れません。名前からIPアドレスがわからないからです。「回線が切れたら？」でDNSサーバを止めて試せます。",
        },
        () => cards[1].done(),
        { retry: true },
      ),
    );
    cards[2].body.append(
      explainCard("パケット通信", "データを小さなパケットに分けると、<strong>1本の回線をたくさんの人で分け合えます</strong>。こわれた分だけ送り直せて、番号があるので順番がばらばらでも組み立てられます。"),
      choiceQuiz(
        {
          question: "パケットに「番号」が付いているのはなぜ？",
          choices: ["届いた順番がばらばらでも、元の順に組み立てるため", "パケットを暗号化するため", "ルータの名前を表すため", "通信料金を計算するため"],
          answer: 0,
          explain: "パケットは別々の道を通ることがあり、届く順番が入れかわることもあります。番号を見て並べ直すので、元のデータにもどせます。",
        },
        () => cards[2].done(),
        { retry: true },
      ),
    );
    cards[3].body.append(
      reflectionBox(ID, "Webページが表示されるまでに起きていたことを、自分の言葉で順番に書こう。", () => cards[3].done(), {
        placeholder: "例: ①サイトの名前を入れる → ②DNSサーバに〇〇を聞く → ③…",
        hint: "①〜⑦の文を見ながら、起きた順に書こう。",
      }),
    );
    root.append(...cards.map((c) => c.el));
  },
};

