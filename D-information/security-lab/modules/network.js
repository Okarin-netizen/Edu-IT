// モジュール⑤: ネットワーク通信の模擬（HTTP と HTTPS で、途中ののぞき見に何が見えるか）
// 実際の通信は一切しない。HTTPS の暗号文は Web Crypto API（AES-GCM）でこの端末の中で作る。
import { h, explainCard, stepCard, reflectionBox, threeSteps, choiceQuiz } from "../js/ui.js";

const ID = "network";
const STEPS = [
  { id: "send", title: "HTTP と HTTPS で送りくらべよう" },
  { id: "visible", title: "HTTPS でも見えるもの・見えないもの" },
  { id: "lock", title: "https（鍵マーク）なら安全なサイト？" },
  { id: "reflect", title: "ふりかえり" },
];
const DEMO = { id: "taro2026", pass: "neko-sora-123", host: "kumo-store.example" };

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

async function encryptDemo(text) {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 128 }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const buf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join(" ");
}

export const networkModule = {
  id: ID,
  minutes: "10〜15分",
  lead: "インターネットの通信は、Wi-Fi やたくさんの機器を通って相手に届きます。通信ののぞき見もサイバー攻撃の一つです。サイバーセキュリティのための「通信の暗号化」を学ぼう。HTTP と HTTPS で、何が見えるのかを比べよう。",
  steps: STEPS,
  async render(root) {
    const cards = STEPS.map((s, i) => stepCard(ID, s, i));
    const sent = new Set();

    // ステップ1
    {
      const c = cards[0];
      const packet = h("span", { class: "packet", "aria-hidden": "true" }, "✉");
      const route = h(
        "div",
        { class: "net-route", role: "img", "aria-label": "あなたの端末から、フリーWi-Fi、インターネットを通って、お店のサーバーに届く。フリーWi-Fiのところで、のぞき見している人がいる。" },
        h("div", { class: "net-node" }, h("span", { class: "emoji" }, "💻"), "あなた"),
        h("div", { class: "net-node" }, h("span", { class: "emoji" }, "📶"), "フリーWi-Fi", h("span", { class: "spy" }, "👀 のぞき見")),
        h("div", { class: "net-node" }, h("span", { class: "emoji" }, "🌐"), "インターネット"),
        h("div", { class: "net-node" }, h("span", { class: "emoji" }, "🏬"), "お店のサーバー"),
        packet,
      );
      const spy = h("div", { class: "spy-panel", "aria-live": "polite" }, h("p", { class: "hint" }, "まだ何も通っていません。"));
      const mode = { value: "http" };
      const modeBtns = ["http", "https"].map((m) => {
        const b = h("button", { type: "button", "aria-pressed": m === "http" ? "true" : "false" }, m === "http" ? "HTTP（暗号化なし）" : "HTTPS（暗号化あり）");
        b.addEventListener("click", () => {
          mode.value = m;
          modeBtns.forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
          addr.textContent = `${m}://${DEMO.host}/login`;
          lock.textContent = m === "https" ? "🔒" : "⚠";
          lock.setAttribute("aria-label", m === "https" ? "暗号化された通信" : "暗号化されていない通信");
        });
        return b;
      });
      const addr = h("span", { class: "url" }, `http://${DEMO.host}/login`);
      const lock = h("span", { "aria-label": "暗号化されていない通信" }, "⚠");
      const sendBtn = h("button", { class: "btn", type: "button" }, "ログイン（送信）");
      sendBtn.addEventListener("click", async () => {
        sendBtn.disabled = true;
        const m = mode.value;
        const body = `id=${DEMO.id}&password=${DEMO.pass}`;
        const cipher = m === "https" ? await encryptDemo(`POST /login\n${body}`) : null;
        packet.classList.toggle("locked", m === "https");
        packet.textContent = m === "https" ? "🔒" : "✉";
        if (!reducedMotion()) {
          packet.style.transition = "none";
          packet.style.left = "4%";
          packet.getBoundingClientRect();
          packet.style.transition = "left 2.4s linear";
        }
        packet.style.left = "88%";
        await new Promise((r) => setTimeout(r, reducedMotion() ? 0 : 1000));
        spy.replaceChildren(
          h("p", {}, h("strong", {}, `👀 のぞき見している人に見えたもの（${m.toUpperCase()}）`)),
          m === "http"
            ? h("pre", { class: "cipher-text" }, `送信先: ${DEMO.host}\nPOST /login\n${body}`)
            : h("pre", { class: "cipher-text" }, `送信先: ${DEMO.host}\n中身: ${cipher}`),
          m === "http"
            ? explainCard("丸見え！", "IDもパスワードも、そのまま読めてしまいました。HTTP では、途中の機器を通る内容がすべて読めます。", "bad")
            : explainCard("中身は読めない", "HTTPS では、中身が暗号化されています。のぞき見しても、意味のない数字の並びにしか見えません。ただし「どのサイトと通信しているか」は分かります。", "good"),
        );
        sent.add(m);
        await new Promise((r) => setTimeout(r, reducedMotion() ? 0 : 1500));
        sendBtn.disabled = false;
        if (sent.size === 2) c.done();
      });
      c.body.append(
        h("p", {}, "駅のフリーWi-Fiから、ネットショップにログインします。HTTP と HTTPS の両方で送ってみよう。"),
        h("div", { class: "btn-row scenario-tabs", role: "group", "aria-label": "通信の方法" }, modeBtns),
        h(
          "div",
          { class: "mock", style: "margin:10px auto" },
          h("div", { class: "mock-bar" }, lock, addr),
          h(
            "div",
            { class: "mock-body" },
            h("div", { class: "logo" }, "クモストア ログイン"),
            h("div", { class: "login-box", style: "margin-top:8px" }, h("span", {}, "ID"), h("span", { class: "fake-input" }, DEMO.id), h("span", {}, "パスワード"), h("span", { class: "fake-input" }, "●●●●●●●●●●●●●"), sendBtn),
            h("p", { class: "hint", style: "color:#6d6c67" }, "※ 例のためのIDとパスワードです"),
          ),
        ),
        route,
        spy,
      );
    }

    // ステップ2: 見える・見えない
    {
      const c = cards[1];
      const items = [
        { text: "通信している相手のサイト名（kumo-store.example）", visible: true, why: "通信の宛先はわかります。どんなサイトを使っているかは知られることがあります。" },
        { text: "入力したIDとパスワード", visible: false, why: "暗号化された中身なので読めません。" },
        { text: "見ているページの文章や画像", visible: false, why: "ページの中身も暗号化されています。" },
        { text: "通信した時刻と、データの量", visible: true, why: "いつ、どれくらい通信したかは外から分かります。" },
      ];
      const answers = new Map();
      const fb = h("div", { "aria-live": "polite" });
      const rows = items.map((it, i) => {
        const btns = ["見える", "見えない"].map((label) => {
          const b = h("button", { class: "btn small secondary", type: "button", "aria-pressed": "false" }, label);
          b.addEventListener("click", () => {
            answers.set(i, label === "見える");
            btns.forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
            btns.forEach((x) => x.classList.toggle("secondary", x !== b));
          });
          return b;
        });
        return h("tr", {}, h("td", {}, it.text), h("td", {}, h("div", { class: "btn-row", style: "margin:0" }, btns)));
      });
      const check = h("button", { class: "btn", type: "button" }, "答え合わせ");
      check.addEventListener("click", () => {
        if (answers.size < items.length) return fb.replaceChildren(explainCard("まだ選んでいない項目があります", "すべての項目で「見える」「見えない」を選ぼう。", "warn"));
        const correct = items.filter((it, i) => answers.get(i) === it.visible).length;
        fb.replaceChildren(
          explainCard(`${items.length}問中 ${correct}問 正解`, "", correct === items.length ? "good" : "warn"),
          h("ul", { class: "feedback-list" }, items.map((it, i) => h("li", { class: answers.get(i) === it.visible ? "found" : "missed" }, h("span", { class: "tag" }, answers.get(i) === it.visible ? "○" : "×"), h("strong", {}, `${it.text} … ${it.visible ? "見える" : "見えない"}`), h("br"), it.why))),
        );
        c.done();
      });
      c.body.append(h("p", {}, "HTTPS で通信しているとき、途中でのぞき見している人に「見える」のはどれ？"), h("div", { class: "table-wrap" }, h("table", { class: "data" }, h("tbody", {}, rows))), h("div", { class: "btn-row" }, check), fb);
    }

    // ステップ3: https（鍵マーク）
    {
      const c = cards[2];
      c.body.append(
        choiceQuiz(
          {
            question: "アドレスが https:// で始まっています（ブラウザによっては鍵マークも出ます）。このサイトについて言えることは？",
            choices: ["本物の会社が運営している、安全なサイトだと保証されている", "通信は暗号化されているが、サイトが本物かどうかは別に確かめる", "ページやファイルにウイルスが入っていないことが保証されている"],
            answer: 1,
            explain: "https は「通信路が暗号化されている」という意味です。フィッシングサイトでも https は簡単に使えます。https かどうかより大切なのは、ドメイン名が公式のものかどうか。アドレスの「//」のあとのドメイン名を、右から読んで確かめよう（フィッシング見分けで学んだ方法）。なお、今の Chrome（Chromebook）では、鍵マークではなく別のアイコンが出ます。",
          },
          () => c.done(),
        ),
        h("h3", {}, "フリーWi-Fiを使うときの対策"),
        h(
          "ul",
          {},
          h("li", {}, "アドレスが https:// で始まり、ドメイン名が公式のものか確かめてから入力する。"),
          h("li", {}, "パスワードを入力するような大切な操作は、家のWi-Fiやスマホの回線で行う。"),
          h("li", {}, "名前がよく似た、正体のわからないWi-Fiにはつながない。"),
        ),
        threeSteps({ stop: "入力する前に手を止める", check: "https と公式アドレスを確認", ask: "わからなければ大人に聞く" }),
      );
    }

    cards[3].body.append(reflectionBox(ID, "HTTPS を使うと、のぞき見されても安全なのはなぜだと思う？", () => cards[3].done()));
    root.append(...cards.map((c) => c.el));
  },
};
