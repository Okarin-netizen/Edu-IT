// モジュール3: 回線が切れたら？（回線を切る・ルータを止める → 別の道で届く／届かない）
import { h, explainCard, stepCard, reflectionBox, choiceQuiz, escapeHtml as escape, simSplit, revealBetween } from "../js/ui.js";
import { store } from "../js/store.js";
import { NODE_TYPES, cloneNet, nodeById, shortestPath, reachableFrom, resolveName, stableRoute, sameRoute, compareRoutes, unreachableReason, reasonText } from "../js/netlib.js";
import { createNetView, speedControl, pathText } from "../js/netview.js";

const ID = "fault";
const STEPS = [
  { id: "detour", title: "1か所こわれても届く？" },
  { id: "unreach", title: "届かなくなるのはどんなとき？" },
  { id: "dns", title: "DNSサーバが止まったら？" },
  { id: "quiz", title: "確かめよう" },
  { id: "reflect", title: "ふりかえり" },
];

export const faultModule = {
  id: ID,
  minutes: "15分",
  lead: "回線が切れたりルータが止まったりしても、インターネットはすぐには止まりません。こわれた場所をさけて、別の道（経路）を通るからです。図の回線やルータをクリックして、こわしたり直したりしてみよう。",
  steps: STEPS,
  render(root) {
    const cards = STEPS.map((s, i) => stepCard(ID, s, i));
    let net = cloneNet(store.net);
    const clients = () => net.nodes.filter((n) => NODE_TYPES[n.type].client);
    const targets = () => net.nodes.filter((n) => !NODE_TYPES[n.type].client && n.type !== "router");
    const status = h("div", { class: "fault-status", "aria-live": "polite" });
    const faultCount = () => net.links.filter((l) => l.cut).length + net.nodes.filter((n) => n.down).length;

    const view = createNetView({
      net,
      label: "障害を起こせるネットワーク図。回線やルータを押すと、切ったり止めたりできます。",
      onLinkClick: (l) => {
        l.cut = !l.cut;
        afterChange(`${nodeById(net, l.a).name} と ${nodeById(net, l.b).name} の回線を${l.cut ? "切りました ✂" : "つなぎ直しました"}。`);
      },
      onNodeClick: (n) => {
        if (n.id === fromSel.value) return afterChange("送る側の機器は止められません。");
        n.down = !n.down;
        afterChange(`「${n.name}」を${n.down ? "止めました ✕" : "動かしました"}。`);
      },
    });

    const fromSel = h("select", { id: "fault-from" });
    const toSel = h("select", { id: "fault-to" });
    function fillSelects() {
      fromSel.replaceChildren(...clients().map((c) => h("option", { value: c.id }, c.name)));
      toSel.replaceChildren(...targets().map((c) => h("option", { value: c.id }, c.name)));
    }
    fillSelects();

    // 太い線で出す道は、くじで決めない。こわす前の道（どこもこわれていないときの道）がまだ使えれば、その道のまま。
    // こわす前の道が使えなくなったときだけ、別の道にする（前に出していた道がまだ使えれば、それを続ける）。
    let shownRoute = null;
    const healedNet = () => {
      const c = cloneNet(net);
      c.links.forEach((l) => delete l.cut);
      c.nodes.forEach((n) => delete n.down);
      return c;
    };
    const beforeRoute = () => stableRoute(healedNet(), fromSel.value, toSel.value);
    function showRoute() {
      const before = beforeRoute();
      const p = stableRoute(net, fromSel.value, toSel.value, before, shownRoute);
      shownRoute = p;
      view.clearMarks();
      view.setPath(p);
      view.setOldPath(before && !sameRoute(before, p) ? before : null);
      return { path: p, before };
    }
    function afterChange(msg) {
      status.replaceChildren(h("p", {}, msg, ` いまこわれているところ：${faultCount()}か所`));
      showRoute();
    }
    fromSel.addEventListener("change", showRoute);
    toSel.addEventListener("change", showRoute);

    // 機器が足りないときの案内（NW-08）。2と同じ「たりない機器」のカード
    const missingText = () => {
      const lack = [];
      if (!clients().length) lack.push("パソコンかスマホ");
      if (!targets().length) lack.push("Webサーバ（またはDNSサーバ）");
      return lack.length ? `${lack.join("と、")}がありません。「ネットワークを組み立てる」で置いて、線でつなごう。「はじめの形にもどす」でもかまいません。` : "";
    };
    const missingCard = () => explainCard("たりない機器", missingText(), "warn");

    const sendBtn = h("button", { type: "button", class: "btn" }, "▶ パケットを送る");
    const result = h("div", { "aria-live": "polite" });
    sendBtn.addEventListener("click", async () => {
      const from = nodeById(net, fromSel.value);
      const to = nodeById(net, toSel.value);
      if (!from || !to) {
        result.replaceChildren(missingCard());
        return;
      }
      sendBtn.disabled = true;
      revealBetween(sendBtn, canvasWrap);
      try {
        const { path: p, before } = showRoute();
        if (p) {
          await view.animate(p, { label: "✉", kind: "req" });
          const cmp = compareRoutes(net, before, p);
          const more =
            cmp.kind === "detour"
              ? `<br>こわれたところ${cmp.brokenNames.length ? `（${escape(cmp.brokenNames.join("、"))}）` : ""}をさけて、別の道${cmp.middle.length ? `（${escape(cmp.middle.join(" → "))}）` : ""}を通りました。点線は、こわす前の道です。`
              : cmp.kind === "same"
                ? "<br>こわれたところは、今回の通り道ではなかったので、同じ道で届きました。太い線（通り道）の回線を切ってみよう。"
                : "";
          result.replaceChildren(explainCard("届いた！", `道：${escape(pathText(net, p))}（通った回線 ${p.length - 1}本）${more}`, "good"));
          if (cmp.kind === "detour") cards[0].done();
        } else {
          const reach = reachableFrom(net, from.id);
          for (const n of net.nodes) if (n.id !== from.id) view.markNode(n.id, reach.has(n.id) ? "reach" : "unreach");
          // 届かないわけを分けて出す（NW-07）。こわれたところのせいでないときは、ステップ2のクリアにしない
          const r = unreachableReason(net, from.id, to.id);
          const why = escape(reasonText(r, to.name));
          const faded = `「${escape(from.name)}」から届くのは、うすい色になっていない機器だけです。`;
          result.replaceChildren(explainCard("到達できない（とどかない）", `${why}<br>${faded}${r.kind === "broken" || r.kind === "to-down" ? "どこを直せば届くか、考えてみよう。" : "これは、こわれたところのせいではありません。「ネットワークを組み立てる」で、つなぎ方を確かめよう。"}`, "bad"));
          if (r.kind === "broken" || r.kind === "to-down") cards[1].done();
        }
      } finally {
        sendBtn.disabled = false;
      }
    });

    const dnsBtn = h("button", { type: "button", class: "btn secondary" }, "名前でWebページを開いてみる");
    const dnsResult = h("div", { "aria-live": "polite" });
    dnsBtn.addEventListener("click", () => {
      const from = nodeById(net, fromSel.value);
      const server = net.nodes.find((n) => n.type === "server" && n.host);
      if (!from) return dnsResult.replaceChildren(explainCard("たりない機器", "パソコンかスマホがありません。「ネットワークを組み立てる」で置いて、線でつなごう。「はじめの形にもどす」でもかまいません。", "warn"));
      if (!server) return dnsResult.replaceChildren(explainCard("たりない機器", "Webサーバがありません。「ネットワークを組み立てる」で置いて、線でつなごう。「はじめの形にもどす」でもかまいません。", "warn"));
      const r = resolveName(net, from.id, server.host);
      const direct = shortestPath(net, from.id, server.id);
      if (r.ok) {
        dnsResult.replaceChildren(explainCard("開けた", `DNSサーバ（${escape(r.dns.name)}）が「${escape(server.host)} は ${escape(r.ip)}」と答えました。${direct ? "" : "でも、Webサーバまでの道はとぎれています。"}DNSサーバを止めて、もう一度ためそう。`, direct ? "good" : "warn"));
      } else {
        dnsResult.replaceChildren(
          explainCard(
            "名前がわからない",
            `DNSサーバに問い合わせできないので、<code>${escape(server.host)}</code> のIPアドレスがわかりません。${direct ? `<br>Webサーバ（${escape(server.ip)}）までの道は<strong>つながっている</strong>のに、名前では開けません。` : ""}`,
            "bad",
          ),
        );
        if (direct) cards[2].done();
      }
    });

    const resetBtn = h("button", { type: "button", class: "btn small secondary" }, "ぜんぶ直す");
    resetBtn.addEventListener("click", () => {
      net.links.forEach((l) => delete l.cut);
      net.nodes.forEach((n) => delete n.down);
      result.replaceChildren();
      dnsResult.replaceChildren();
      afterChange("すべて直しました。");
    });

    const canvasWrap = h("div", { class: "net-canvas" }, view.el);
    const missingNow = missingText();
    cards[0].body.append(
      h("p", {}, "図の", h("strong", {}, "回線（線）"), "を押すと切れ（✂）、", h("strong", {}, "ルータやサーバ"), "を押すと止まります（✕）。もう一度押すと元にもどります。太い線が、いまいちばん近い道です。"),
      h("p", { class: "hint" }, "パケットを中継するのはルータだけです。パソコン・スマホ・サーバは中継しません。"),
      h("div", { class: "field-row" }, h("div", { class: "field" }, h("label", { for: "fault-from" }, "送る機器"), fromSel), h("div", { class: "field" }, h("label", { for: "fault-to" }, "あて先"), toSel)),
      ...(missingNow ? [missingCard()] : []),
      h("div", { class: "btn-row" }, sendBtn, resetBtn, speedControl(h)),
      simSplit(canvasWrap, status, result).el,
      h("p", {}, h("strong", {}, "やってみよう："), "太い線（通り道）の回線を1本切ってから「パケットを送る」。それでも届くか確かめよう。"),
    );
    cards[1].body.append(
      h("p", {}, "今度は、わざと届かない状態を作ってみよう。どこを切ると届かなくなる？　何か所こわすと届かなくなる？"),
      explainCard("ポイント", "道が1本しかないところが切れると、回り道がないので届きません。大事なところは、道を2本以上にしておきます（<strong>冗長化</strong>）。"),
    );
    cards[2].body.append(h("p", {}, "DNSサーバを止めよう（図のDNSサーバを押す）。そして、名前でWebページを開いてみよう。Webサーバまでの道がつながっていても開ける？"), h("div", { class: "btn-row" }, dnsBtn), dnsResult);
    cards[3].body.append(
      choiceQuiz(
        {
          question: "ルータAが止まったのに、Webページがちゃんと表示された。いちばんの理由は？",
          choices: ["ほかのルータを通る別の道があり、パケットがその道を通ったから", "ルータは止まってもパケットを通すから", "Webページはパケットを使わないから", "DNSサーバがページを送ってくれたから"],
          answer: 0,
          explain: "ネットワークは、網の目のようにつながっています。だから、一部がこわれても別の経路で届けられます。全部の道がとぎれると「到達できない」になります。",
        },
        () => cards[3].done(),
        { retry: true },
      ),
    );
    cards[4].body.append(
      reflectionBox(ID, "インターネットがこわれにくいのはなぜ？　ためしたことをもとに書こう。", () => cards[4].done(), {
        placeholder: "例: 〇〇の回線を切っても、△△を通って届いた。それは…",
        hint: "どこをこわしたら、どうなったかを入れて書こう。",
      }),
    );

    afterChange("はじめは、どこもこわれていません。");
    root.append(...cards.map((c) => c.el));
  },
};
