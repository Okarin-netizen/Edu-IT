// モジュール1: ネットワークを組み立てる（機器を置く・線でつなぐ・IPアドレスを確かめる）
import { h, explainCard, stepCard, reflectionBox, choiceQuiz, toast, simSplit, revealBetween } from "../js/ui.js";
import { store } from "../js/store.js";
import { NODE_TYPES, cloneNet, nodeById, linkBetween, nextFreeIp, checkNetwork, isValidIPv4, reachableFrom, resolveName, normalizeIp, normalizeHost, isExampleHost, IP_FORMAT_HELP, freeSpot, unreachableReason, reasonText } from "../js/netlib.js";
import { createNetView, VIEW_W, VIEW_H } from "../js/netview.js";

const ID = "build";
const STEPS = [
  { id: "place", title: "機器を置いてみよう" },
  { id: "wire", title: "線でつないでみよう" },
  { id: "check", title: "みんながWebサーバに届くか調べよう" },
  { id: "quiz", title: "確かめよう" },
  { id: "reflect", title: "ふりかえり" },
];

export const buildModule = {
  id: ID,
  minutes: "15〜20分",
  lead: "インターネットは、パソコン・ルータ・サーバなどの機器が回線でつながった「網の目」です。機器を置いて線でつなぎ、小さなネットワークを作ろう（ほかの画面でも使います）。",
  steps: STEPS,
  render(root) {
    const cards = STEPS.map((s, i) => stepCard(ID, s, i));
    let net = cloneNet(store.net);
    let tool = "move"; // move | wire | erase
    let wireFrom = null;
    let selected = null;

    const persist = () => store.saveNet(net);
    const status = h("p", { class: "build-status", "aria-live": "polite" });

    // 「1つもどす」ための写し（変える前のネットワーク）。この画面にいるあいだだけ覚えておく（NW-05）
    const history = [];
    const remember = () => {
      history.push(cloneNet(net));
      if (history.length > 30) history.shift();
      undoBtn.disabled = false;
    };

    const view = createNetView({
      net,
      draggable: () => tool === "move",
      label: "組み立て中のネットワーク図。機器をドラッグで動かせます。",
      onChange: persist,
      onBeforeChange: remember,
      onNodeClick: (n) => {
        if (tool === "erase") {
          const lines = net.links.filter((l) => l.a === n.id || l.b === n.id).length;
          if (lines && !confirm(`「${n.name}」と、つながっている線${lines}本を消します。よろしいですか？\n（まちがえたときは「↶ 1つもどす」でもどせます）`)) {
            status.textContent = "消すのをやめました。";
            return;
          }
          remember();
          net.nodes = net.nodes.filter((x) => x.id !== n.id);
          net.links = net.links.filter((l) => l.a !== n.id && l.b !== n.id);
          if (selected === n.id) selected = null;
          persist();
          view.setNet(net);
          showEditor(null);
          refreshPairForm();
          status.textContent = `「${n.name}」${lines ? `と線${lines}本` : ""}を消しました。まちがえたときは「↶ 1つもどす」。`;
          return;
        }
        if (tool === "wire") {
          if (!wireFrom) {
            wireFrom = n.id;
            view.setSelected(n.id);
            status.textContent = `「${n.name}」を選びました。つなぐ相手を押してください。`;
            return;
          }
          if (wireFrom === n.id) {
            wireFrom = null;
            view.setSelected(null);
            status.textContent = "選ぶのをやめました。";
            return;
          }
          connect(wireFrom, n.id);
          wireFrom = null;
          view.setSelected(null);
          refreshPairForm();
          return;
        }
        selected = n.id;
        view.setSelected(n.id);
        showEditor(n);
      },
      onLinkClick: (l) => {
        if (tool !== "erase") return;
        remember();
        net.links = net.links.filter((x) => x !== l);
        persist();
        view.setNet(net);
        refreshPairForm();
        status.textContent = `「${nodeById(net, l.a)?.name}」と「${nodeById(net, l.b)?.name}」の線を外しました。まちがえたときは「↶ 1つもどす」。`;
      },
    });

    // 機器の追加（パレットからドラッグ、またはクリック）
    let addCount = 0;
    function addNode(type, x, y) {
      remember();
      const t = NODE_TYPES[type];
      const id = `${type}${Date.now().toString(36)}${addCount++}`;
      const same = net.nodes.filter((n) => n.type === type).length + 1;
      const node = { id, type, name: `${t.label}${same}`, ip: nextFreeIp(net, type), x: Math.round(x), y: Math.round(y) };
      if (type === "server") node.host = `www.site${same}.example`;
      net.nodes.push(node);
      persist();
      view.setNet(net);
      refreshPairForm();
      status.textContent = `「${node.name}」（IPアドレス ${node.ip}）を置きました。光っている機器です。`;
      // 置いた機器を少しのあいだ光らせて、図が画面に入るようにする（NW-04）
      view.markNode(node.id, "just-added");
      setTimeout(() => view.markNode(node.id, null), 2500);
      revealBetween(palette, canvasWrap);
      cards[0].done();
      return node;
    }
    const palette = h(
      "div",
      { class: "palette", role: "group", "aria-label": "置く機器" },
      ...Object.entries(NODE_TYPES).map(([type, t]) => {
        const b = h("button", { type: "button", class: "palette-item", draggable: "true" }, h("span", { class: "emoji", "aria-hidden": "true" }, t.icon), `＋${t.label}`);
        b.addEventListener("dragstart", (e) => {
          e.dataTransfer.setData("text/x-netsim", type);
          e.dataTransfer.effectAllowed = "copy";
        });
        // クリック（タップ）で置くときは、ほかの機器や線と重ならない、空いている所に置く
        b.addEventListener("click", () => {
          const p = freeSpot(net, VIEW_W, VIEW_H);
          addNode(type, p.x, p.y);
        });
        return b;
      }),
    );
    const toolBanner = h("div", { class: "tool-banner", "aria-hidden": "true" });
    const canvasWrap = h("div", { class: "net-canvas" }, view.el, toolBanner);
    canvasWrap.addEventListener("dragover", (e) => {
      if ([...e.dataTransfer.types].includes("text/x-netsim")) e.preventDefault();
    });
    canvasWrap.addEventListener("drop", (e) => {
      const type = e.dataTransfer.getData("text/x-netsim");
      if (!NODE_TYPES[type]) return;
      e.preventDefault();
      const p = view.toSvgPoint(e.clientX, e.clientY);
      addNode(type, Math.max(40, Math.min(VIEW_W - 40, p.x)), Math.max(50, Math.min(VIEW_H - 75, p.y)));
    });

    const tools = [
      ["move", "✋ 動かす・選ぶ"],
      ["wire", "🔗 線でつなぐ"],
      ["erase", "🧽 消す"],
    ];
    const toolBtns = tools.map(([id, label]) => {
      const b = h("button", { type: "button", class: "chip", "aria-pressed": id === tool ? "true" : "false" }, label);
      b.addEventListener("click", () => {
        tool = id;
        wireFrom = null;
        view.setSelected(null);
        toolBtns.forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
        canvasWrap.dataset.tool = id;
        toolBanner.textContent = { move: "", wire: "🔗 いまは「線でつなぐ」を選んでいます", erase: "🧽 いまは「消す」を選んでいます（押した機器や線が消えます）" }[id];
        status.textContent = { move: "機器をドラッグで動かせます。機器を押すと、名前やIPアドレスを変えられます。", wire: "つなぎたい2つの機器を順に押そう。", erase: "消したい機器や線を押そう。終わったら「✋ 動かす・選ぶ」にもどそう。" }[id];
      });
      return b;
    });
    canvasWrap.dataset.tool = tool;
    const undoBtn = h("button", { type: "button", class: "chip", disabled: true }, "↶ 1つもどす");
    undoBtn.addEventListener("click", () => {
      const prev = history.pop();
      if (!prev) return;
      net = prev;
      wireFrom = null;
      selected = null;
      persist();
      view.setNet(net);
      view.setSelected(null);
      showEditor(null);
      refreshPairForm();
      undoBtn.disabled = history.length === 0;
      status.textContent = "1つ前の形にもどしました。";
    });

    // キーボード・タブレット用：選んでつなぐフォーム
    const selA = h("select", { id: "pair-a", "aria-label": "1つ目の機器" });
    const selB = h("select", { id: "pair-b", "aria-label": "2つ目の機器" });
    function refreshPairForm() {
      for (const sel of [selA, selB]) {
        const keep = sel.value;
        sel.replaceChildren(...net.nodes.map((n) => h("option", { value: n.id }, `${n.name}（${n.ip}）`)));
        if (net.nodes.some((n) => n.id === keep)) sel.value = keep;
      }
    }
    refreshPairForm();
    const pairBtn = h("button", { type: "button", class: "btn small secondary" }, "つなぐ");
    pairBtn.addEventListener("click", () => {
      if (!selA.value || !selB.value || selA.value === selB.value) return toast("ちがう2つの機器を選んでください");
      connect(selA.value, selB.value);
    });
    const unpairBtn = h("button", { type: "button", class: "btn small secondary" }, "線を外す");
    unpairBtn.addEventListener("click", () => {
      const exist = linkBetween(net, selA.value, selB.value);
      if (!exist) return toast("この2つの機器は、つながっていません");
      remember();
      net.links = net.links.filter((l) => l !== exist);
      persist();
      view.setNet(net);
      status.textContent = `「${nodeById(net, exist.a)?.name}」と「${nodeById(net, exist.b)?.name}」の線を外しました。まちがえたときは「↶ 1つもどす」。`;
    });
    // 線をつなぐ。すでにつながっていれば、外さずに知らせる（線を外すのは「消す」だけ。NW-05）
    function connect(aId, bId) {
      const a = nodeById(net, aId);
      const b = nodeById(net, bId);
      if (linkBetween(net, aId, bId)) {
        status.textContent = `「${a.name}」と「${b.name}」は、もうつながっています。線を外すときは「🧽 消す」を使おう。`;
        return;
      }
      remember();
      net.links.push({ id: `${aId}-${bId}-${Date.now().toString(36)}`, a: aId, b: bId });
      status.textContent = `「${a.name}」と「${b.name}」をつなぎました。`;
      cards[1].done();
      persist();
      view.setNet(net);
    }

    // 選んだ機器の名前・IPアドレスを変える
    const editor = h("div", { class: "node-editor", "aria-live": "polite" });
    function showEditor(n) {
      if (!n) {
        editor.replaceChildren(h("p", { class: "hint" }, "「✋ 動かす・選ぶ」で機器を押すと、ここで名前やIPアドレスを変えられます。"));
        return;
      }
      const t = NODE_TYPES[n.type];
      const name = h("input", { type: "text", id: "ed-name", maxlength: "12", value: n.name });
      const ip = h("input", { type: "text", id: "ed-ip", maxlength: "15", value: n.ip, inputmode: "decimal", spellcheck: "false" });
      const ipNote = h("div", { class: "hint", "aria-live": "polite" });
      const host = n.type === "server" ? h("input", { type: "text", id: "ed-host", maxlength: "40", value: n.host || "", spellcheck: "false" }) : null;
      const hostNote = host ? h("div", { class: "hint", "aria-live": "polite" }, "最後は .example にしよう（説明用の名前）") : null;
      const checkIp = (reverted = false) => {
        const v = normalizeIp(ip.value);
        const ok = isValidIPv4(v);
        const dup = net.nodes.some((x) => x !== n && x.ip === v);
        ipNote.textContent = !v ? "⚠ IPアドレスを入れよう" : !ok ? `⚠ ${IP_FORMAT_HELP}` : dup ? "⚠ ほかの機器と同じIPアドレスです" : reverted ? "⚠ 正しい形ではなかったので、元の番号にもどしました" : "✓ 正しい形です";
        ipNote.style.color = !ok || dup || reverted ? "var(--ef-ng)" : "var(--ef-ok)";
      };
      const apply = (e) => {
        remember();
        n.name = name.value.trim() || n.name;
        name.value = n.name;
        // IPアドレス：全角の数字や点は半角に直す。正しい形でなければ保存せず、元の番号にもどす
        let reverted = false;
        const v = normalizeIp(ip.value);
        if (isValidIPv4(v)) n.ip = v;
        else if (e?.target === ip) reverted = true;
        ip.value = n.ip;
        // サイトの名前：最後が .example でなければ保存せず、元の名前にもどす
        if (host) {
          const hv = normalizeHost(host.value);
          if (isExampleHost(hv)) {
            n.host = hv;
            hostNote.textContent = "最後は .example にしよう（説明用の名前）";
            hostNote.style.color = "";
          } else if (e?.target === host) {
            hostNote.textContent = `⚠ ${hv ? "説明用の名前（最後が .example）にしよう。" : "サイトの名前を入れよう。"}元の名前にもどしました`;
            hostNote.style.color = "var(--ef-ng)";
          }
          host.value = n.host || "";
        }
        persist();
        view.render();
        refreshPairForm();
        checkIp(reverted);
      };
      for (const el of [name, ip, host].filter(Boolean)) el.addEventListener("change", apply);
      ip.addEventListener("input", () => checkIp());
      checkIp();
      editor.replaceChildren(
        h("h3", {}, `${t.icon} ${t.label}「${n.name}」`),
        h(
          "div",
          { class: "field-row" },
          h("div", { class: "field" }, h("label", { for: "ed-name" }, "名前"), name),
          h("div", { class: "field" }, h("label", { for: "ed-ip" }, "IPアドレス"), ip, ipNote),
          host ? h("div", { class: "field" }, h("label", { for: "ed-host" }, "サイトの名前（ドメイン名）"), host, hostNote) : null,
        ),
        h("p", { class: "hint" }, NODE_TYPES[n.type].forward ? "ルータは、パケットの宛先を見て、次にどの回線へ送るかを決める「中継係」です。" : n.type === "dns" ? "DNSサーバは、サイトの名前からIPアドレスを調べてくれる「電話帳」の役目です。ほかの機器あてのパケットは中継しません。" : n.type === "server" ? "Webサーバは、たのまれたWebページを送り返す機器です。ほかの機器あてのパケットは中継しません。" : "パソコンやスマホは、通信をたのむ側（クライアント）です。ほかの機器あてのパケットは中継しません。"),
      );
    }

    const resetBtn = h("button", { type: "button", class: "btn small secondary" }, "はじめの形にもどす");
    resetBtn.addEventListener("click", () => {
      if (!confirm("作ったネットワークを消して、はじめの形にもどしますか？\n（まちがえたときは「↶ 1つもどす」でもどせます）")) return;
      remember();
      net = store.resetNet();
      view.setNet(net);
      showEditor(null);
      refreshPairForm();
      status.textContent = "はじめの形にもどしました。";
    });

    // ステップ1・2: 作業エリア
    showEditor(null);
    status.textContent = "機器をドラッグで動かせます。機器を押すと、名前やIPアドレスを変えられます。";
    const split = simSplit(canvasWrap, status, editor);
    cards[0].body.append(
      h("p", {}, "下の機器ボタンを押して置こう（パソコンでは、図の上へドラッグしても置けます）。「線でつなぐ」を選んで2つの機器を順に押すと、回線でつながります。"),
      palette,
      h("div", { class: "chip-row", role: "group", "aria-label": "道具" }, ...toolBtns, undoBtn, h("span", { class: "spacer" }), resetBtn),
      split.el,
      h("details", { class: "kbd-wire" }, h("summary", {}, "キーボードで線をつなぐ"), h("div", { class: "btn-row" }, selA, selB, pairBtn, unpairBtn), h("p", { class: "hint" }, "機器にフォーカスして矢印キーを押すと動かせます。")),
    );
    cards[1].body.append(
      h("p", {}, "家のパソコンやスマホは、まず「家のルータ」につながります。ルータどうしは回線でつながっています。こうして、遠くのサーバまで届きます。"),
      explainCard("きまり：中継するのはルータだけ", "ほかの機器あてのパケットを<strong>中継</strong>（受け取って次へ送ること）するのは<strong>ルータ</strong>だけです。パソコン・スマホ・サーバは中継しません。だから、スマホをパソコンにだけつないでも、その先へは届きません。"),
      explainCard("ポイント", "ルータとルータの間を<strong>何本もの道</strong>でつないでおこう。1本が切れても、別の道で届きます。あとの「回線が切れたら？」で試せます。"),
    );

    // ステップ3: つながりチェック
    const resultBox = h("div", { "aria-live": "polite" });
    const checkBtn = h("button", { type: "button", class: "btn" }, "つながりを調べる");
    checkBtn.addEventListener("click", () => {
      const issues = checkNetwork(net);
      const clients = net.nodes.filter((n) => NODE_TYPES[n.type].client);
      const servers = net.nodes.filter((n) => n.type === "server");
      const rows = [];
      let allOk = clients.length > 0 && servers.length > 0;
      for (const c of clients) {
        const reach = reachableFrom(net, c.id);
        for (const sv of servers) {
          const ok = reach.has(sv.id);
          const dns = resolveName(net, c.id, sv.host);
          if (!ok || !dns.ok) allOk = false;
          // 届かないときは、わけも出す（NW-07）
          const why = ok ? "" : reasonText(unreachableReason(net, c.id, sv.id), sv.name);
          const dnsNode = net.nodes.find((n) => n.type === "dns");
          const dnsWhy = dns.ok || dns.reason === "no-dns" || !dnsNode ? "" : reasonText(unreachableReason(net, c.id, dnsNode.id), dnsNode.name);
          rows.push(
            h(
              "tr",
              {},
              h("td", {}, c.name),
              h("td", {}, sv.name),
              h("td", {}, h("span", { class: `status ${ok ? "good" : "bad"}` }, ok ? "届く" : "届かない"), why ? h("div", { class: "hint why" }, why) : null),
              h("td", {}, h("span", { class: `status ${dns.ok ? "good" : "warn"}` }, dns.ok ? "名前で調べられる" : dns.reason === "no-dns" ? "DNSサーバがない" : "DNSに届かない"), dnsWhy && dnsWhy !== why ? h("div", { class: "hint why" }, dnsWhy) : null),
            ),
          );
        }
      }
      if (issues.length) allOk = false;
      resultBox.replaceChildren(
        ...[
        !clients.length || !servers.length ? explainCard("たりない機器", "パソコンかスマホと、Webサーバを少なくとも1台ずつ置こう。", "warn") : null,
        rows.length ? h("div", { class: "table-wrap" }, h("table", { class: "data" }, h("thead", {}, h("tr", {}, h("th", {}, "から"), h("th", {}, "へ"), h("th", {}, "パケット"), h("th", {}, "DNS"))), h("tbody", {}, rows))) : null,
        issues.length ? explainCard("直したいところ", h("ul", {}, issues.map((i) => h("li", {}, i.text))), "warn") : null,
        allOk ? explainCard("ばっちり！", "どのパソコン・スマホからも、Webサーバに届き、サイトの名前も調べられます。", "good") : null,
        ].filter(Boolean),
      );
      if (allOk) cards[2].done();
    });
    cards[2].body.append(h("p", {}, "パソコン・スマホから、Webサーバまで本当に届くかを調べよう。IPアドレスがまちがっていたり、ほかの機器と同じだったりしないかも点検します。"), checkBtn, resultBox);

    // ステップ4
    cards[3].body.append(
      choiceQuiz(
        {
          question: "ネットワークの中で、IPアドレスが果たしている役目はどれ？",
          choices: ["機器を見分けるための「住所」の役目", "通信を暗号化するための鍵", "Webページの題名", "回線の速さを表す数"],
          answer: 0,
          explain: "IPアドレスは、ネットワークにつながった機器一つ一つを見分ける番号です。だから同じネットワークの中で、ほかの機器と重なってはいけません。",
        },
        () => cards[3].done(),
        { retry: true },
      ),
    );

    // ステップ5
    cards[4].body.append(
      reflectionBox(ID, "ルータどうしを何本もの道でつなぐと、どんなよいことがありそう？", () => cards[4].done(), {
        placeholder: "例: 1本の線が切れても、〇〇を通って届くから、△△になる。",
        hint: "図でためしたこと（どの線とどの線をつないだか）をもとに書こう。",
      }),
    );

    root.append(...cards.map((c) => c.el));
  },
};
