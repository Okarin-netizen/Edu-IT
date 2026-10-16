// モジュール⑦: デジタルタトゥー／拡散シミュレーション
import { h, explainCard, stepCard, reflectionBox, choiceQuiz, threeSteps } from "../js/ui.js";
import { consultCard } from "../js/consult.js";

const ID = "tattoo";
const STEPS = [
  { id: "spread", title: "投稿が広がる様子を見よう" },
  { id: "delete", title: "消したら、なかったことになる？" },
  { id: "quiz", title: "消えない理由と、守るための行動" },
  { id: "responsibility", title: "発信者としての責任" },
  { id: "reflect", title: "ふりかえり" },
];

// 削除ボタンが押せるようになる人数・ステップ1の完了の人数・ひとまず止める回数
export const DELETE_AT = 8;
export const SPREAD_DONE_AT = 10;
export const MAX_TICKS = 30;
export const AFTER_DELETE_TICKS = 3;

// 1回分（10分）広げる。画面に依存しない（テストできるように）。
// state: [{ seen, copy, sharing }]（0番が自分）、neighbors: Map、p: 広がりやすさ、rand: 0〜1 の乱数
// 決まり（SEC-58）:
//  - 削除する前、見た人が SPREAD_DONE_AT 人に届くまでは、1回に少なくとも1人には届く（止まって進めなくならない）
//  - 見た人が DELETE_AT 人以上になった時点で、保存・スクショした人が少なくとも1人いる
export function spreadStep(state, neighbors, p, deleted, rand = Math.random) {
  const next = state.map((s) => ({ ...s }));
  const active = (s, i) => (deleted ? s.copy && i !== 0 : s.sharing || s.copy);
  state.forEach((s, i) => {
    // 削除後は、元の投稿（自分）とそれを共有しただけの人からは広がらない。保存したコピーからは広がり続ける
    if (!active(s, i)) return;
    for (const nb of neighbors.get(i)) {
      if (next[nb].seen) continue;
      if (rand() < p + 0.25) {
        next[nb].seen = true;
        if (rand() < 0.18) next[nb].copy = true;
        if (rand() < p) next[nb].sharing = true;
      }
    }
  });
  const seenCount = (st) => st.filter((s, i) => i && s.seen).length;
  if (!deleted && seenCount(next) === seenCount(state) && seenCount(state) < SPREAD_DONE_AT) {
    // だれにも届かなかったときは、広げている人のとなりのだれか1人に届ける
    const cands = [];
    state.forEach((s, i) => active(s, i) && neighbors.get(i).forEach((nb) => !next[nb].seen && cands.push(nb)));
    if (cands.length) {
      const nb = cands[Math.floor(rand() * cands.length)];
      next[nb].seen = true;
      next[nb].sharing = true;
    }
  }
  if (!deleted && seenCount(next) >= DELETE_AT && !next.some((s, i) => i && s.copy)) {
    // だれも保存していなければ、見た人のうち1人が保存（スクショ）したことにする
    const seenIds = next.map((s, i) => (i && s.seen ? i : 0)).filter(Boolean);
    next[seenIds[Math.floor(rand() * seenIds.length)]].copy = true;
  }
  if (deleted) next.forEach((s) => (s.sharing = false));
  return next;
}

// 同心円状の人のつながり（中心が自分）
function buildNetwork() {
  const nodes = [{ id: 0, ring: 0, x: 200, y: 160 }];
  const rings = [
    { n: 6, r: 58 },
    { n: 12, r: 104 },
    { n: 18, r: 148 },
  ];
  rings.forEach((ring, ri) => {
    for (let i = 0; i < ring.n; i++) {
      const a = (i / ring.n) * Math.PI * 2 + ri * 0.3;
      nodes.push({ id: nodes.length, ring: ri + 1, x: 200 + Math.cos(a) * ring.r * 1.25, y: 160 + Math.sin(a) * ring.r });
    }
  });
  const edges = [];
  const byRing = (r) => nodes.filter((n) => n.ring === r);
  for (const n of byRing(1)) edges.push([0, n.id]);
  for (let r = 1; r <= 3; r++) {
    const ring = byRing(r);
    ring.forEach((n, i) => edges.push([n.id, ring[(i + 1) % ring.length].id]));
    if (r < 3) {
      const outer = byRing(r + 1);
      for (const o of outer) {
        const nearest = ring.reduce((best, n) => (Math.hypot(n.x - o.x, n.y - o.y) < Math.hypot(best.x - o.x, best.y - o.y) ? n : best));
        edges.push([nearest.id, o.id]);
      }
    }
  }
  const neighbors = new Map(nodes.map((n) => [n.id, []]));
  for (const [a, b] of edges) {
    neighbors.get(a).push(b);
    neighbors.get(b).push(a);
  }
  return { nodes, edges, neighbors };
}

export const tattooModule = {
  id: ID,
  minutes: "10〜15分",
  lead: "インターネットに一度出た情報は、コピーされて広がり、完全に消すことはほぼできません。入れ墨（タトゥー）のように消えないので「デジタルタトゥー」と呼ばれます。",
  steps: STEPS,
  async render(root) {
    const cards = STEPS.map((s, i) => stepCard(ID, s, i));
    const consultSlot = await consultCard();
    const net = buildNetwork();
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 400 320");
    svg.setAttribute("role", "img");
    svg.setAttribute("class", "spread-svg");
    const label = h("p", { class: "visually-hidden", "aria-live": "polite" });
    for (const [a, b] of net.edges) {
      const l = document.createElementNS(NS, "line");
      Object.entries({ x1: net.nodes[a].x, y1: net.nodes[a].y, x2: net.nodes[b].x, y2: net.nodes[b].y, class: "edge" }).forEach(([k, v]) => l.setAttribute(k, v));
      svg.append(l);
    }
    const circles = net.nodes.map((n) => {
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", n.x);
      c.setAttribute("cy", n.y);
      c.setAttribute("r", n.id === 0 ? 13 : 9);
      c.setAttribute("class", n.id === 0 ? "node me" : "node");
      svg.append(c);
      return c;
    });
    const meText = document.createElementNS(NS, "text");
    meText.setAttribute("x", 200);
    meText.setAttribute("y", 164);
    meText.setAttribute("text-anchor", "middle");
    meText.setAttribute("class", "node-label");
    meText.textContent = "自分";
    svg.append(meText);

    // 状態: seen(見た), copy(スクショ・保存した), sharing(さらに広げている)
    let state;
    let deleted = false;
    let tick = 0;
    let timer = null;
    const stats = h("div", { class: "spread-stats", "aria-live": "polite" });
    const content = h("select", { id: "tattoo-content" }, h("option", { value: "0.55" }, "友達の変顔写真（おもしろがられやすい）"), h("option", { value: "0.25" }, "今日の夕ごはんの写真（ふつうの投稿）"));
    const scope = h("select", { id: "tattoo-scope" }, h("option", { value: "1" }, "だれでも見られる"), h("option", { value: "0.4" }, "友達だけ"));

    const reset = () => {
      clearInterval(timer);
      timer = null;
      playBtn.textContent = "▶ 時間を進める";
      deleted = false;
      tick = 0;
      deletedAt = 0;
      state = net.nodes.map((n) => ({ seen: n.id === 0, copy: n.id === 0, sharing: n.id === 0 }));
      draw();
      delBtns.forEach((b) => (b.disabled = true));
      fb.replaceChildren();
    };
    const draw = () => {
      net.nodes.forEach((n, i) => {
        const s = state[i];
        const cls = ["node"];
        if (i === 0) cls.push(deleted ? "deleted" : "me");
        else if (s.copy) cls.push("copy");
        else if (s.seen) cls.push("seen");
        circles[i].setAttribute("class", cls.join(" "));
      });
      const seen = state.filter((s, i) => i && s.seen).length;
      const copies = state.filter((s, i) => i && s.copy).length;
      stats.replaceChildren(
        h("span", {}, `経過: ${tick * 10}分`),
        h("span", {}, "見た人: ", h("strong", {}, `${seen}`), " 人"),
        h("span", {}, "保存・スクショした人: ", h("strong", {}, `${copies}`), " 人"),
        deleted ? h("span", { class: "status bad" }, "元の投稿は削除ずみ") : "",
      );
      label.textContent = `見た人 ${seen} 人、保存した人 ${copies} 人`;
      return { seen, copies };
    };
    let deletedAt = 0;
    const step = () => {
      tick++;
      state = spreadStep(state, net.neighbors, Number(content.value) * Number(scope.value), deleted);
      const { seen } = draw();
      if (seen >= DELETE_AT && !deleted) delBtns.forEach((b) => (b.disabled = false));
      if (seen >= SPREAD_DONE_AT && !deleted) cards[0].done();
      if (deleted && tick >= deletedAt + AFTER_DELETE_TICKS) cards[1].done();
      // 削除する前は、見た人が10人に届くまで止めない。削除したあとは、少し見てから止める
      if (deleted ? tick >= deletedAt + AFTER_DELETE_TICKS + 3 : tick >= MAX_TICKS && seen >= SPREAD_DONE_AT) stop();
      if (seen === net.nodes.length - 1) stop();
    };
    const stop = () => {
      clearInterval(timer);
      timer = null;
      playBtn.textContent = "▶ 時間を進める";
    };
    const playBtn = h("button", { class: "btn", type: "button" }, "▶ 時間を進める");
    playBtn.addEventListener("click", () => {
      if (timer) return stop();
      playBtn.textContent = "⏸ 止める";
      timer = setInterval(step, 700);
    });
    // 削除ボタンは、ステップ2と、図の下（「時間を進める」の横）の2か所に置く（図を見ながら押せるように）
    const fb = h("div", { "aria-live": "polite" });
    const fbTop = h("div", { "aria-live": "polite" });
    const doDelete = () => {
      if (deleted) return;
      deleted = true;
      deletedAt = tick;
      state[0].copy = false;
      delBtns.forEach((b) => (b.disabled = true));
      const { copies } = draw();
      const msg =
        copies > 0
          ? explainCard("削除しました…でも", `自分の投稿は消えましたが、保存やスクリーンショットをした ${copies} 人のところにはコピーが残っています。そこからまた広がっていくかもしれません。時間を進めて確かめよう。`, "warn")
          : explainCard("削除しました", "今回は、保存した人がいませんでした。でも実際には、見えないところでスクリーンショットされていることもあります。「最初から」でもう一度ためそう。", "warn");
      fb.replaceChildren(msg);
      fbTop.replaceChildren(h("p", { class: "hint" }, "削除しました。ステップ2の説明も読もう。"));
      if (!timer) playBtn.click();
    };
    const delBtns = [0, 1].map(() => h("button", { class: "btn secondary", type: "button", disabled: true, onclick: doDelete }, "🗑 元の投稿を削除する"));
    const delBtn = delBtns[0];
    content.addEventListener("change", reset);
    scope.addEventListener("change", reset);

    cards[0].body.append(
      h("p", {}, "投稿の内容と公開範囲を選んで、時間を進めてみよう。点が人を、線がつながりを表しています。"),
      h("div", { class: "field-row" }, h("div", { class: "field" }, h("label", { for: "tattoo-content" }, "投稿の内容"), content), h("div", { class: "field" }, h("label", { for: "tattoo-scope" }, "公開範囲"), scope)),
      h("ul", { class: "legend" }, h("li", {}, h("span", { class: "dot me" }), "自分"), h("li", {}, h("span", { class: "dot seen" }), "見た人"), h("li", {}, h("span", { class: "dot copy" }), "保存・スクショした人"), h("li", {}, h("span", { class: "dot" }), "まだ見ていない人")),
      svg,
      label,
      stats,
      h("div", { class: "btn-row" }, playBtn, delBtns[1], h("button", { class: "btn secondary", type: "button", onclick: reset }, "最初から")),
      fbTop,
      explainCard("気づいたかな？", "広がる速さは、投稿の内容や公開範囲で変わります。それでも、知らない人（外側の輪）にまで届くことがあります。「友達だけ」にしても、友達が保存して別の場所に投稿すれば広がります。"),
    );
    cards[1].body.append(h("p", {}, "投稿が広がってから（見た人が8人以上になったら）、元の投稿を削除してみよう。"), h("div", { class: "btn-row" }, delBtn), fb);
    reset();

    cards[2].body.append(
      choiceQuiz(
        {
          question: "自分の投稿を削除しても、ネット上から消えないことがあるのはなぜ？",
          choices: ["削除ボタンは見た目だけで、本当は消えないから", "見た人が保存・スクリーンショット・転載していて、コピーがあちこちに残るから", "インターネットは一度書きこむと書きかえられないしくみだから"],
          answer: 1,
          explain: "自分の投稿を消しても、他の人が保存したコピーや転載、まとめサイト、検索結果の記録などが残ります。コピーは自分では消せません。進学や就職のときに昔の投稿が見つかることもあります。",
        },
        () => cards[2].done(),
      ),
      h("h3", {}, "デジタルタトゥーを残さないために"),
      h("ul", {}, h("li", {}, "投稿する前に「ずっと残っても、だれに見られても大丈夫？」と考える。"), h("li", {}, "友達の写真や名前を、勝手に投稿しない（相手のデジタルタトゥーになる）。"), h("li", {}, "人を傷つける投稿を見つけても、広げない（共有しない・スクショで回さない）。")),
      h("h3", {}, "もし広がってしまったら"),
      h("ul", {}, h("li", {}, "一人でかかえこまず、すぐに家族や先生に相談する。"), h("li", {}, "サービスの通報・削除依頼の機能を使う。"), h("li", {}, "家族や先生に言いにくいときは、下の相談窓口もある。")),
      consultSlot,
      threeSteps({ stop: "投稿・共有の前に止まる", check: "残っても困らないか考える", ask: "広がったらすぐ相談" }),
    );
    // ステップ4: 発信者としての責任
    {
      const c = cards[3];
      const answered = new Set();
      const mark = (k) => {
        answered.add(k);
        if (answered.size >= 2) c.done();
      };
      c.body.append(
        h("p", {}, "SNSに投稿したり、共有したりすると、あなたは「情報を発信した人（発信者）」になります。発信した情報には、責任がともないます。"),
        choiceQuiz(
          {
            question: "友達の悪口や、本当かどうかわからない うわさを投稿してしまった。あとで削除すれば、責任はなくなる？",
            choices: ["削除すれば、なかったことになる", "投稿した時点で相手を傷つけているので、責任を問われることがある", "名前を出さない匿名のアカウントなら、だれが書いたか分からないので大丈夫"],
            answer: 1,
            danger: [2],
            explain: "人を傷つけたり、うそで評判を下げたりする投稿は、名誉毀損や侮辱として法律上の責任を問われることがあります。削除してもコピーは残り、匿名でも、手続きによって発信者が特定されることがあります。",
          },
          () => mark("post"),
        ),
        choiceQuiz(
          {
            question: "ほかの人が書いた、だれかの悪いうわさを、軽い気持ちで再投稿（リポスト・シェア）した。",
            choices: ["自分で書いたわけではないので、責任はない", "広げた人も発信者として、責任を問われることがある", "いいねや再投稿なら、何をしても問題ない"],
            answer: 1,
            danger: [2],
            explain: "再投稿も、情報を広げる「発信」です。うその情報や人を傷つける内容を広げた人が、責任を問われた例もあります。広げる前に「本当？」「だれかが傷つかない？」と考えよう。",
          },
          () => mark("share"),
        ),
        explainCard("発信する前の3つの問い", "① それは本当？（確かめた？）<br>② だれかが傷ついたり、困ったりしない？<br>③ ずっと残って、だれに見られても大丈夫？", "good"),
      );
    }
    cards[4].body.append(reflectionBox(ID, "投稿を削除しても消えないのはなぜ？ 発信者として、あなたはどう行動する？", () => cards[4].done()));
    root.append(...cards.map((c) => c.el));
  },
};
