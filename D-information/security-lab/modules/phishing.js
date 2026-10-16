// モジュール④: フィッシング見分け
// 画面に出るメールやページはすべて架空の模型。リンクやボタンを押しても、どこにも移動しない。
import { h, explainCard, stepCard, reflectionBox, threeSteps, choiceQuiz } from "../js/ui.js";
import { loadData } from "../js/data.js";
import { store } from "../js/store.js";

const ID = "phishing";
const STEPS = [
  { id: "first", title: "怪しいところを見つけよう" },
  { id: "all", title: "すべての場面に挑戦しよう" },
  { id: "reflect", title: "ふりかえり" },
];

export const phishingModule = {
  id: ID,
  minutes: "15分",
  lead: "サイバーセキュリティとは、インターネットを通じた攻撃（サイバー攻撃）から情報や機器を守ることです。その代表的な攻撃がフィッシング。本物そっくりのメールやページで、パスワードや個人情報、お金をだまし取ります。ニセの画面を見て、怪しいところを見つける練習をしよう。",
  steps: STEPS,
  async render(root) {
    const { scenarios } = await loadData("phishing");
    const cards = STEPS.map((s, i) => stepCard(ID, s, i));
    const isDone = (sc) => Boolean(store.getScore(ID, sc.id));
    const summary = h("div");

    const tabs = h("div", { class: "scenario-tabs", role: "group", "aria-label": "場面を選ぶ" });
    const stage = h("div");
    let current = 0;

    const refreshTabs = () => {
      tabs.replaceChildren(
        ...scenarios.map((sc, i) => {
          const b = h("button", { type: "button", "aria-pressed": i === current ? "true" : "false", class: isDone(sc) ? "done" : "" }, `${i + 1}. ${sc.title}`, isDone(sc) ? h("span", { class: "visually-hidden" }, "（挑戦ずみ）") : null);
          b.addEventListener("click", () => {
            current = i;
            refreshTabs();
            renderScenario();
          });
          return b;
        }),
      );
    };

    const refreshSummary = () => {
      const doneCount = scenarios.filter(isDone).length;
      summary.replaceChildren(
        h("p", {}, `挑戦した場面: ${doneCount} / ${scenarios.length}`),
        h(
          "div",
          { class: "table-wrap" },
          h(
            "table",
            { class: "data" },
            h("thead", {}, h("tr", {}, h("th", {}, "場面"), h("th", {}, "見つけた怪しい点"), h("th", {}, "行動の判断"))),
            h(
              "tbody",
              {},
              scenarios.map((sc) => {
                const s = store.getScore(ID, sc.id);
                return h("tr", {}, h("td", {}, sc.title), h("td", {}, s ? s.split("|")[0] : "—"), h("td", {}, s ? s.split("|")[1] : "—"));
              }),
            ),
          ),
        ),
      );
      if (doneCount >= 1) cards[0].done();
      if (doneCount === scenarios.length) cards[1].done();
    };

    const renderScenario = () => {
      const sc = scenarios[current];
      const picked = new Set();
      let checked = false;
      const hotspots = new Map();

      const hs = (part, extraClass = "", content) => {
        const b = h("button", { type: "button", class: `hs ${extraClass}`, "aria-pressed": "false" }, content ?? part.text);
        b.addEventListener("click", () => {
          if (checked) return;
          if (picked.has(part.id)) picked.delete(part.id);
          else picked.add(part.id);
          b.classList.toggle("picked", picked.has(part.id));
          b.setAttribute("aria-pressed", picked.has(part.id) ? "true" : "false");
          count.textContent = `選んだ数: ${picked.size}`;
        });
        hotspots.set(part.id, { el: b, part });
        return b;
      };

      const mock = buildMock(sc, hs);
      const count = h("span", { class: "hint", "aria-live": "polite" }, "選んだ数: 0");
      const checkBtn = h("button", { class: "btn", type: "button" }, "答え合わせ");
      const result = h("div");

      checkBtn.addEventListener("click", () => {
        if (checked) return;
        checked = true;
        checkBtn.disabled = true;
        const items = { found: [], missed: [], falsePick: [], other: [] };
        for (const { el, part } of hotspots.values()) {
          const p = picked.has(part.id);
          let kind = "other";
          if (part.suspicious && p) kind = "found";
          else if (part.suspicious) kind = "missed";
          else if (p) kind = "falsePick";
          items[kind].push(part);
          el.classList.remove("picked");
          if (kind !== "other") {
            el.classList.add(kind === "falsePick" ? "false-pick" : kind);
            el.append(h("span", { class: "mark" }, kind === "found" ? "✓ 見つけた" : kind === "missed" ? "！ 見のがし" : "△ これは決め手ではない"));
          }
        }
        const total = items.found.length + items.missed.length;
        const over = items.falsePick.length;
        // 全部選べば満点、にならないように「決め手ではない所」を選んだ数も伝える
        const pickedAll = items.other.length === 0 && over > 0;
        const head = sc.isPhishing
          ? explainCard(
              "これはフィッシングです",
              `怪しい点 ${total} 個のうち、${items.found.length} 個を見つけました。${
                over ? `決め手ではない所も ${over} 個選んでいます（下の△を読もう）。` : ""
              }${items.missed.length ? "見のがしたところも確認しよう。" : over ? "" : "すべて見つけられました！"}${pickedAll ? "全部を疑うと、本物のメールも見分けられなくなるよ。手がかりを1つずつ見て判断しよう。" : ""}`,
              items.missed.length || over ? "warn" : "good",
            )
          : explainCard(
              "これは本物のメールです",
              items.falsePick.length ? "怪しいと思ったところもありましたが、今回は本物でした。怪しい点がなくても、心配なときは公式アプリで確かめれば大丈夫。" : "怪しい点がないと判断できました。何でもこわがるのではなく、手がかりを見て判断することが大切です。",
              "good",
            );
        const li = (part, kind, tag) => h("li", { class: kind }, h("span", { class: "tag" }, tag), h("strong", {}, `「${short(part.text)}」`), h("br"), part.explain);
        const list = h(
          "ul",
          { class: "feedback-list" },
          items.found.map((p) => li(p, "found", "✓ 見つけた")),
          items.missed.map((p) => li(p, "missed", "！ 見のがし")),
          items.falsePick.map((p) => li(p, "false-pick", "△ 決め手ではない")),
          items.other.map((p) => li(p, "", "・")),
        );
        // まちがえたら1回だけ選び直せる。答えが決まったら記録する（○: 1回目で正解、○（2回目）: 選び直して正解、△: 2回ともちがった）
        const quiz = choiceQuiz(sc.action, (ok, tries) => {
          store.setScore(ID, sc.id, `${sc.isPhishing ? `${items.found.length}/${total}${over ? `（選びすぎ${over}）` : ""}` : items.falsePick.length ? "本物（迷った）" : "本物と判断"}|${ok ? (tries > 1 ? "○（2回目）" : "○") : "△"}`);
          refreshTabs();
          refreshSummary();
          const next = scenarios.findIndex((s, i) => i > current && !isDone(s));
          after.replaceChildren(
            threeSteps(),
            next >= 0 || current < scenarios.length - 1
              ? h(
                  "div",
                  { class: "btn-row" },
                  h(
                    "button",
                    {
                      class: "btn",
                      type: "button",
                      onclick: () => {
                        current = next >= 0 ? next : current + 1;
                        refreshTabs();
                        renderScenario();
                        tabs.scrollIntoView({ behavior: "smooth", block: "start" });
                      },
                    },
                    "次の場面へ →",
                  ),
                )
              : "",
          );
        });
        const after = h("div");
        result.replaceChildren(head, list, h("h3", {}, "行動を選ぼう"), quiz, after);
        result.querySelector(".explain")?.setAttribute("tabindex", "-1");
        result.querySelector(".explain")?.focus();
      });

      stage.replaceChildren(h("p", {}, sc.intro), mock, h("div", { class: "btn-row", style: "justify-content:center" }, count, checkBtn), result);
    };

    cards[0].body.append(
      explainCard("遊び方", "画面の中で「怪しい」と思うところをタップ（クリック）して選びます。もう一度押すと取り消せます。選び終わったら「答え合わせ」。この画面はすべて模型なので、押してもどこにも移動しません。"),
      h(
        "details",
        { open: true },
        h("summary", {}, "見分けるときのチェックポイント（まず読もう）"),
        h(
          "ul",
          {},
          h(
            "li",
            {},
            h("strong", {}, "URL・差出人: "),
            "URLは「//」のすぐあとから、次の「/」までがサイトの住所（ドメイン名）。ドメイン名は右から読む。右はしの「.example」（本物なら「.jp」「.co.jp」「.com」など）と、そのすぐ左の名前が本当の持ち主。メールアドレスなら @ の後ろがドメイン名。似た文字（m と rn、l と 1）に注意。",
            urlFigure(),
          ),
          h("li", {}, h("strong", {}, "差出人はにせられる: "), "差出人の名前やアドレスは、にせることもできる。本物と同じに見えても、メールのリンクは押さずに公式アプリで確かめる。"),
          h("li", {}, h("strong", {}, "急かす・脅す: "), "「今すぐ」「本日中」「停止」「凍結」などで、考える時間をうばっていないか。"),
          h("li", {}, h("strong", {}, "うまい話: "), "応募していないのに当選、「無料」「今だけ」。"),
          h("li", {}, h("strong", {}, "求めるもの: "), "パスワード、個人情報、ギフトカードの番号など、必要のない情報を求めていないか。"),
          h("li", {}, h("strong", {}, "日本語: "), "不自然な言い回し。ただし、自然な日本語のニセモノも増えているので、これだけでは判断しない。"),
        ),
      ),
      tabs,
      stage,
    );
    cards[1].body.append(
      summary,
      explainCard("いちばん大切なこと", "見分ける力をつけても、だまされることはあります。だからこそ、<strong>メッセージの中のリンクは使わず、自分で公式アプリやブックマークから確かめる</strong>習慣が一番の対策になります。もし入力してしまったら、すぐに家族や先生に相談し、パスワードを変えよう。", "good"),
    );
    cards[2].body.append(reflectionBox(ID, "メッセージの中のリンクではなく、公式アプリから確かめるのが安全なのは、なぜだと思う？", () => cards[2].done()));

    refreshTabs();
    refreshSummary();
    renderScenario();
    root.append(...cards.map((c) => c.el));
  },
};

// URL のどこが「本当の持ち主」かを色で示す小さな図
function urlFigure() {
  const part = (text, style) => h("span", { style }, text);
  return h(
    "div",
    { style: "margin:6px 0 2px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;overflow-wrap:anywhere" },
    h(
      "div",
      { class: "mono", style: "font-size:0.95rem" },
      part("http://", "opacity:0.6"),
      part("hayate-haisou.", ""),
      h("mark", { style: "background:var(--accent-soft);color:var(--accent);font-weight:700;border-radius:2px;padding:0 2px" }, "delivery-check.example"),
      part("/xk7", "opacity:0.6"),
    ),
    h("div", { class: "hint", style: "margin-top:4px" }, "色の部分（右から読んだ、右はしとそのすぐ左）が本当の持ち主。左の「hayate-haisou」は、持ち主が自由に付けられる飾り。最後の「/xk7」はサイトの中の場所で、持ち主とは関係ない。"),
  );
}

function short(text) {
  return text.length > 28 ? `${text.slice(0, 28)}…` : text;
}

// 場面の種類ごとに、メール・SMS・Webページ・DM の模型を組み立てる
function buildMock(sc, hs) {
  const parts = sc.parts;
  const byRole = (role) => parts.filter((p) => p.role === role);
  const textParts = (list) => list.map((p) => (p.role === "link" ? h("div", {}, hs(p, "", h("span", { style: "color:#256abf;text-decoration:underline;word-break:break-all" }, p.text))) : p.role === "button" ? h("div", { style: "margin:8px 0" }, hs(p, "", h("span", {}, h("span", { class: "fake-btn" }, p.text), p.sub ? h("span", { style: "display:block;font-size:0.8rem;color:#6d6c67;margin-top:4px;word-break:break-all" }, p.sub) : ""))) : hs(p)));
  const body = parts.filter((p) => !["sender", "subject"].includes(p.role));
  const label = { sms: "メッセージ", email: "メール", web: "ブラウザ", dm: "SNS のダイレクトメッセージ" }[sc.kind];

  if (sc.kind === "web") {
    const field = (p) => hs(p, "", h("span", {}, h("span", { style: "font-size:0.85rem;font-weight:700" }, p.text), h("span", { class: "fake-input", style: "display:block" }, "入力欄")));
    return h(
      "div",
      { class: "mock", role: "group", "aria-label": `${label}の模型` },
      h("div", { class: "mock-bar" }, h("span", { class: "dots", "aria-hidden": "true" }), hs(sc.address, "inline url", sc.address.text)),
      h(
        "div",
        { class: "mock-body" },
        byRole("logo").map((p) => hs(p, "", h("span", { class: "logo" }, p.text))),
        byRole("heading").map((p) => hs(p, "", h("span", { style: "font-size:1.1rem;font-weight:700" }, p.text))),
        byRole("timer").map((p) => hs(p, "", h("span", { style: "color:#b3261e;font-weight:700" }, `⏰ ${p.text}`))),
        h("div", { class: "login-box" }, byRole("field").map(field), h("span", { class: "fake-btn", style: "text-align:center" }, "ログインして受け取る")),
      ),
    );
  }
  const sender = byRole("sender")[0];
  const subject = byRole("subject")[0];
  if (sc.kind === "email") {
    return h(
      "div",
      { class: "mock", role: "group", "aria-label": `${label}の模型` },
      h("div", { class: "mock-bar" }, h("span", { class: "dots", "aria-hidden": "true" }), label),
      h(
        "div",
        { class: "mock-body" },
        h("div", { class: "mail-head" }, h("div", {}, "差出人: ", sender ? hs(sender, "inline") : ""), subject ? hs(subject, "mail-subject") : ""),
        textParts(body),
      ),
    );
  }
  // sms / dm
  return h(
    "div",
    { class: "mock", role: "group", "aria-label": `${label}の模型` },
    h("div", { class: "mock-bar" }, h("span", { class: "dots", "aria-hidden": "true" }), label),
    h("div", { class: "mock-body" }, h("div", { style: "font-size:0.85rem;margin-bottom:8px" }, sc.kind === "sms" ? "送信元: " : "送り主: ", sender ? hs(sender, "inline") : ""), h("div", { class: "sms" }, textParts(body))),
  );
}
