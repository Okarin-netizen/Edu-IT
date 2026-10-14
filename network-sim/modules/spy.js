// モジュール4: のぞき見と暗号化（途中の回線で見える内容を、HTTP と HTTPS で比べる）
// 実際の通信はしない。HTTPS の「暗号文」は意味のない16進数を表示する模型。
import { h, explainCard, stepCard, reflectionBox, choiceQuiz, escapeHtml, simSplit, revealBetween } from "../js/ui.js";
import { store } from "../js/store.js";
import { NODE_TYPES, cloneNet, nodeById, shortestPath, splitIntoPackets, scrambleLike, visiblePart, unreachableReason, reasonText } from "../js/netlib.js";
import { createNetView, speedControl, wait } from "../js/netview.js";

const ID = "spy";
const STEPS = [
  { id: "http", title: "HTTP（暗号化なし）で送る" },
  { id: "https", title: "HTTPS（暗号化あり）で送る" },
  { id: "place", title: "のぞき見の場所を変えてみる" },
  { id: "quiz", title: "確かめよう" },
  { id: "reflect", title: "ふりかえり" },
];
// 架空のログイン情報（入力はさせない）
export const DEMO = { id: "taro2026", pass: "neko-sora-123" };
export const LOGIN_BODY = `POST /login\nid=${DEMO.id}\npassword=${DEMO.pass}`;
export const PACKET_SIZE = 18;

// HTTPで、のぞき見した人に見えたパケット（番号 seenSeqs）に合わせた説明の文
export function httpLeakText(seenSeqs, total) {
  const pass = visiblePart(LOGIN_BODY, PACKET_SIZE, seenSeqs, `password=${DEMO.pass}`);
  const id = visiblePart(LOGIN_BODY, PACKET_SIZE, seenSeqs, `id=${DEMO.id}`);
  const code = (t) => `<code>${escapeHtml(t)}</code>`;
  if (pass.state === "all" && id.state === "all") return `暗号化していないので、IDとパスワード（${code(DEMO.pass)}）がそのまま読めてしまいました。`;
  const parts = [];
  if (id.state === "all") parts.push(`ID（${code(DEMO.id)}）`);
  else if (id.state === "part") parts.push(`IDの一部「${code(id.text)}」`);
  if (pass.state === "all") parts.push(`パスワード（${code(DEMO.pass)}）`);
  else if (pass.state === "part") parts.push(`パスワードの一部「${code(pass.text)}」`);
  const head = `暗号化していないので、通ったパケットの中身がそのまま読めてしまいました（${total}個のうち${seenSeqs.length}個）。`;
  const what = parts.length ? `${parts.join("と、")}が見えています。` : "";
  return `${head}${what}ほかのパケットも同じ回線を通れば、全部読まれてしまいます。`;
}

export const spyModule = {
  id: ID,
  minutes: "10〜15分",
  lead: "パケットはいくつもの回線や機器を通って届きます。もし途中の回線をのぞき見している人がいたら、何が見えてしまうのでしょう。暗号化しない HTTP と、暗号化する HTTPS（どちらもWebページをやりとりするためのプロトコル＝通信の約束ごと）で比べてみよう。",
  steps: STEPS,
  render(root) {
    const cards = STEPS.map((s, i) => stepCard(ID, s, i));
    const net = cloneNet(store.net);
    const client = net.nodes.find((n) => NODE_TYPES[n.type].client);
    const server = net.nodes.find((n) => n.type === "server" && n.host) || net.nodes.find((n) => n.type === "server");
    let spyLink = (client && net.links.find((l) => l.a === client.id || l.b === client.id)) || net.links[0];
    let moved = false;
    let mode = "http";

    const placeMsg = h("p", { class: "hint", "aria-live": "polite" });
    const linkName = (l) => `${nodeById(net, l.a)?.name} と ${nodeById(net, l.b)?.name} の間`;
    const view = createNetView({
      net,
      label: "のぞき見している人（目のマーク）がいる回線を、押して選べるネットワーク図",
      onLinkClick: (l) => {
        spyLink = l;
        moved = true;
        view.setSpyLink(l.id);
        placeMsg.textContent = `👀 のぞき見する人を「${linkName(l)}」に動かしました。`;
      },
    });
    if (spyLink) {
      view.setSpyLink(spyLink.id);
      placeMsg.textContent = `👀 のぞき見する人は「${linkName(spyLink)}」の回線にいます。図の回線を押すと場所を変えられます。`;
    }

    const modeBtns = [
      ["http", "HTTP（暗号化なし）"],
      ["https", "HTTPS（暗号化あり）"],
    ].map(([m, label]) => {
      const b = h("button", { type: "button", class: "chip", "aria-pressed": m === mode ? "true" : "false" }, label);
      b.addEventListener("click", () => {
        mode = m;
        modeBtns.forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
        addr.textContent = `${m}://${server?.host || "site.example"}/login`;
        lock.textContent = m === "https" ? "🔒" : "⚠ 保護されていない通信";
      });
      return b;
    });
    const addr = h("span", { class: "url" }, `http://${server?.host || "site.example"}/login`);
    const lock = h("span", {}, "⚠ 保護されていない通信");
    const form = h(
      "div",
      { class: "mock" },
      h("div", { class: "mock-bar" }, h("span", { class: "dots" }), lock, addr),
      h("div", { class: "mock-body" }, h("div", { class: "login-box" }, h("div", { class: "logo" }, server?.name || "サイト"), h("div", {}, "ID"), h("div", { class: "fake-input" }, DEMO.id), h("div", {}, "パスワード"), h("div", { class: "fake-input" }, "●".repeat(DEMO.pass.length)))),
    );

    const spyPanel = h("div", { class: "spy-panel", "aria-live": "polite" }, h("p", { class: "hint" }, "のぞき見している人の画面：まだ何も通っていません。"));
    const sendBtn = h("button", { type: "button", class: "btn" }, "ログイン（送信）");
    // 機器や線が足りないときの案内（NW-08）
    const missingText = () => {
      const lack = [];
      if (!client) lack.push("パソコンかスマホ");
      if (!server) lack.push("Webサーバ");
      if (lack.length) return `${lack.join("と、")}がありません。「ネットワークを組み立てる」で置いて、線でつなごう（「はじめの形にもどす」でもかまいません）。`;
      if (!spyLink) return "回線（線）が1本もありません。「ネットワークを組み立てる」で、機器を線でつなごう（「はじめの形にもどす」でもかまいません）。";
      return "";
    };
    let split = null;
    sendBtn.addEventListener("click", async () => {
      const lack = missingText();
      if (lack) {
        spyPanel.replaceChildren(explainCard("たりない機器", lack, "warn"));
        return;
      }
      sendBtn.disabled = true;
      revealBetween(sendBtn, canvasWrap);
      try {
        spyPanel.replaceChildren(h("p", {}, h("strong", {}, `👀 のぞき見している人の画面（${linkName(spyLink)}）`)));
        const packets = splitIntoPackets(LOGIN_BODY, PACKET_SIZE, { from: client.ip, to: server.ip });
        let seen = 0;
        const seenSeqs = new Set();
        const sendMode = mode;
        await Promise.all(
          packets.map(async (p, i) => {
            await wait(i * 300);
            const path = shortestPath(net, client.id, server.id);
            if (!path) return;
            await view.animate(path, {
              label: sendMode === "https" ? "🔒" : String(p.seq),
              kind: sendMode === "https" ? "secure" : "data",
              onHop: (a, b) => {
                if (!spyLink || !((spyLink.a === a && spyLink.b === b) || (spyLink.a === b && spyLink.b === a))) return;
                seen++;
                seenSeqs.add(p.seq);
                spyPanel.append(
                  h(
                    "div",
                    { class: "spy-item" },
                    h("div", { class: "hint" }, `パケット ${p.seq}/${p.total}　送信元 ${p.from} → 宛先 ${p.to}${sendMode === "https" ? `　（行き先のサイト名 ${server.host} も見えることがある）` : ""}`),
                    h("pre", { class: sendMode === "https" ? "cipher" : "plain" }, sendMode === "https" ? scrambleLike(p.data) : p.data),
                  ),
                );
                split.scrollSideToEnd();
              },
            });
          }),
        );
        if (!shortestPath(net, client.id, server.id)) {
          spyPanel.append(explainCard("届かない", `サーバまでの道がありません。${escapeHtml(reasonText(unreachableReason(net, client.id, server.id), server.name))}「ネットワークを組み立てる」で確かめよう。`, "warn"));
        } else if (!seen) {
          spyPanel.append(explainCard("何も見えなかった", "今回のパケットは、のぞき見している回線を通りませんでした。でも、通り道が変わると見られるかもしれません。いつも通る場所（家のWi‑Fiや、お店のフリーWi‑Fiなど）でのぞかれたら？", "info"));
          if (moved) cards[2].done();
        } else if (sendMode === "http") {
          const all = seenSeqs.size === packets.length;
          spyPanel.append(explainCard(all ? "丸見え！" : "中身が読めた！", httpLeakText([...seenSeqs].sort((a, b) => a - b), packets.length), "bad"));
          cards[0].done();
          if (moved) cards[2].done();
        } else {
          spyPanel.append(explainCard("中身は読めない", "送り先のIPアドレスやデータの量は見えても、中身は暗号化されていて読めません。かぎを持っているのは、あなたのブラウザとサーバだけです。", "good"));
          cards[1].done();
          if (moved) cards[2].done();
        }
        split.scrollSideToEnd();
      } finally {
        sendBtn.disabled = false;
      }
    });

    const canvasWrap = h("div", { class: "net-canvas" }, view.el);
    split = simSplit(canvasWrap, placeMsg, spyPanel);
    const lackNow = missingText();
    cards[0].body.append(
      h("p", {}, "IDとパスワード（架空のもの）でログインします。まず HTTP のまま「ログイン（送信）」を押そう。"),
      h("div", { class: "chip-row", role: "group", "aria-label": "通信の方法" }, ...modeBtns),
      form,
      ...(lackNow ? [explainCard("たりない機器", lackNow, "warn")] : []),
      h("div", { class: "btn-row" }, sendBtn, speedControl(h)),
      split.el,
      h("p", { class: "hint" }, "※ のぞき見の画面の「POST /login」は、HTTPで「入力した内容（IDとパスワード）を送ります」というお願いの書き方です。"),
      h("p", { class: "hint" }, "※ HTTPS の暗号文は、しくみを見せるための模型です（本物の暗号ではありません）。"),
    );
    cards[1].body.append(h("p", {}, "上の「HTTPS（暗号化あり）」に切りかえて、もう一度送ってみよう。のぞき見している人には何が見える？"));
    cards[2].body.append(
      h("p", {}, "図の別の回線を押して、のぞき見する人の場所を変えてから送ってみよう。パケットが通らない回線では、何も見えません。"),
      explainCard("考えよう", "いちばん危ないのは、<strong>毎回かならず通る場所</strong>です。たとえば、あなたの端末とWi‑Fiの間。だれでも使えるフリーWi‑Fiでは、暗号化されていない通信を見られるおそれがあります。"),
    );
    cards[3].body.append(
      choiceQuiz(
        {
          question: "HTTPS（鍵マーク）について正しいのはどれ？",
          choices: ["通信の中身が暗号化され、途中でのぞかれても読まれにくい", "鍵マークがあれば、そのサイトは必ず安全な本物のサイトだ", "HTTPSなら、パスワードをどのサイトに入れても大丈夫", "HTTPSにすると、通信の行き先もすべて見えなくなる"],
          answer: 0,
          explain: "HTTPSが守るのは「通信の途中」です。にせもののサイトも鍵マークを付けられるので、サイトのアドレスが本物かどうかは別に確かめる必要があります。HTTPSでも、通信の相手（IPアドレスやサイト名）や、いつ・どれくらい通信したかは見えることがあります。",
        },
        () => cards[3].done(),
        { retry: true },
      ),
    );
    cards[4].body.append(
      reflectionBox(ID, "フリーWi‑Fiを使うとき、どんなことに気をつける？　理由もいっしょに書こう。", () => cards[4].done(), {
        placeholder: "例: 〇〇に気をつける。なぜなら、のぞき見している人に△△が見えてしまうから。",
        hint: "HTTPとHTTPSで、のぞき見している人の画面がどうちがったかを思い出して書こう。",
      }),
    );
    root.append(...cards.map((c) => c.el));
  },
};
