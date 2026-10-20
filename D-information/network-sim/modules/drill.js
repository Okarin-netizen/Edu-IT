// モジュール5: IPアドレス・サブネットの基礎ドリル
import { h, explainCard, stepCard, reflectionBox, choiceQuiz, toast } from "../js/ui.js";
import { store } from "../js/store.js";
import { parseIPv4, toBinary8, networkAddress, normalizeIp, IP_FORMAT_HELP } from "../js/netlib.js";
import { makeDrill, makeChallenge, weightParts } from "../js/drilllib.js";

const ID = "drill";
const STEPS = [
  { id: "explore", title: "IPアドレスを2進数で見てみよう" },
  { id: "drill", title: "ドリルに挑戦（10問）" },
  { id: "master", title: "8問以上正解しよう" },
  { id: "reflect", title: "ふりかえり" },
];

export const drillModule = {
  id: ID,
  minutes: "15分",
  lead: "IPアドレスは、機器を見分けるための番号です。コンピュータの中では2進数で扱われます。しくみを確かめてから、ドリルで練習しよう。問題は毎回ちがうものが出ます。",
  steps: STEPS,
  render(root) {
    const cards = STEPS.map((s, i) => stepCard(ID, s, i));

    // ステップ1: IPアドレスを2進数で見る
    const ipIn = h("input", { type: "text", id: "drill-ip", value: "192.168.1.10", maxlength: "15", inputmode: "decimal", spellcheck: "false" });
    const out = h("div", { "aria-live": "polite" });
    let touched = false;
    let octetIdx = 3; // 重みの表で見る数（はじめは4つ目）
    const WEIGHTS = [128, 64, 32, 16, 8, 4, 2, 1];
    // 1つの数を、重みの表で見せる（NW-03）
    const weightTable = (nums) => {
      const n = nums[octetIdx];
      const bits = toBinary8(n);
      const chips = nums.map((v, i) => {
        const b = h("button", { type: "button", class: "chip", "aria-pressed": i === octetIdx ? "true" : "false" }, `${i + 1}つ目（${v}）`);
        b.addEventListener("click", () => {
          octetIdx = i;
          show();
        });
        return b;
      });
      const parts = weightParts(n);
      return h(
        "div",
        { class: "weight-box" },
        h("div", { class: "chip-row", role: "group", "aria-label": "重みの表で見る数" }, h("span", { class: "hint" }, "表で見る数："), ...chips),
        h(
          "div",
          { class: "table-wrap" },
          h(
            "table",
            { class: "data weight-table" },
            h("tbody", {}, h("tr", {}, h("th", { scope: "row" }, "重み"), WEIGHTS.map((w) => h("td", {}, w))), h("tr", {}, h("th", { scope: "row" }, "2進数"), [...bits].map((b) => h("td", { class: b === "1" ? "on mono" : "mono" }, b)))),
          ),
        ),
        h("p", {}, `1のところの重みを足すと：${parts.length ? parts.join(" + ") : "0"} = ${n}`),
      );
    };
    const show = () => {
      const ip = normalizeIp(ipIn.value);
      const nums = parseIPv4(ip);
      if (!nums) {
        out.replaceChildren(explainCard("書き方をチェック", ip ? IP_FORMAT_HELP : `IPアドレスを入れよう。${IP_FORMAT_HELP}`, "warn"));
        return;
      }
      out.replaceChildren(
        h(
          "div",
          { class: "ip-bits", role: "img", "aria-label": `${ip} を2進数にすると ${nums.map(toBinary8).join(" ")}` },
          ...nums.map((n, i) => h("div", { class: `octet ${i < 3 ? "netpart" : "hostpart"}` }, h("div", { class: "dec" }, n), h("div", { class: "bin mono" }, toBinary8(n)))),
        ),
        h("p", { class: "hint" }, h("span", { class: "sw netpart" }), "ネットワーク部（サブネットマスク 255.255.255.0 のとき）　", h("span", { class: "sw hostpart" }), "ホスト部"),
        weightTable(nums),
        h("p", {}, `この機器のネットワークは ${networkAddress(ip, 24)}/24 です。/24 は「前から24ビット＝前の3つの数がネットワーク部」という意味です。前の3つの数が同じ機器とは、同じネットワーク（たとえば同じ家の中）です。`),
      );
      if (touched) cards[0].done();
    };
    ipIn.addEventListener("input", () => {
      touched = true;
      show();
    });
    show();
    cards[0].body.append(
      explainCard("IPアドレスのしくみ", "いま広く使われている IPアドレスの形（<strong>IPv4</strong>。IPのバージョン4）は、<strong>8ビットの数 × 4つ ＝ 32ビット</strong>。それぞれ0〜255の数で書きます。前半は「どのネットワークか」を表します（ネットワーク部）。後半は「その中のどの機器か」を表します（ホスト部）。どこまでがネットワーク部かは<strong>サブネットマスク</strong>で決めます。"),
      explainCard(
        "2進数の読み方（重み）",
        "2進数の8けたには、左から <strong>128・64・32・16・8・4・2・1</strong> の<strong>重み</strong>があります。<strong>1のところの重みを足すと、10進数</strong>になります（例：01000100 → 64 + 4 = 68）。反対に、10進数を2進数にするときは、<strong>大きい重みから順に引いていきます</strong>。引けたら1、引けなければ0にします（例：68 → 64を引くと残り4 → 4を引くと残り0 → 01000100）。2進数は「デジタル化ラボ」でもくわしく練習できます。",
      ),
      h("div", { class: "field" }, h("label", { for: "drill-ip" }, "IPアドレスを入れてみよう（数を変えてみよう）"), ipIn),
      out,
    );

    // ステップ2・3: ドリル
    const area = h("div");
    const best = store.getScore(ID, "best");
    const bestNote = h("p", { class: "hint" }, best !== undefined ? `これまでの最高：${best} / 10問` : "");
    const startBtn = h("button", { type: "button", class: "btn" }, "ドリルをはじめる");
    function startDrill() {
      const qs = makeDrill(10);
      let i = 0;
      let correct = 0;
      const next = () => {
        if (i >= qs.length) return finish();
        const q = qs[i];
        const nextBtn = h("button", { type: "button", class: "btn", disabled: true }, i === qs.length - 1 ? "結果を見る" : "次の問題へ");
        nextBtn.addEventListener("click", () => {
          i++;
          next();
        });
        area.replaceChildren(
          h("p", { class: "hint" }, `${i + 1} / ${qs.length}問　正解 ${correct}`),
          h("div", { class: "bar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(qs.length), "aria-valuenow": String(i), "aria-label": "ドリルの進み具合" }, h("span", { style: `width:${(i / qs.length) * 100}%` })),
          choiceQuiz(q, (ok) => {
            if (ok) correct++;
            nextBtn.disabled = false;
            nextBtn.focus();
          }),
          h("div", { class: "btn-row" }, nextBtn),
        );
        area.querySelector(".choice-list button")?.focus();
      };
      const finish = () => {
        const prev = store.getScore(ID, "best");
        if (prev === undefined || correct > prev) store.setScore(ID, "best", correct);
        store.setScore(ID, "last", correct);
        bestNote.textContent = `これまでの最高：${Math.max(correct, prev ?? 0)} / 10問`;
        cards[1].done();
        if (correct >= 8) cards[2].done();
        const again = h("button", { type: "button", class: "btn" }, "もう一度（新しい問題）");
        again.addEventListener("click", startDrill);
        area.replaceChildren(
          h("div", { class: "result-box" }, h("div", { class: "big-number" }, `${correct} / ${qs.length}問 正解`), h("p", {}, correct >= 8 ? "すばらしい！ IPアドレスのしくみがよくわかっています。" : "まちがえた問題の解説を思い出して、もう一度挑戦しよう。8問以上が目標です。")),
          h("div", { class: "btn-row" }, again),
        );
        toast(`${correct}問正解でした`);
      };
      next();
    }
    startBtn.addEventListener("click", startDrill);
    area.append(h("div", { class: "btn-row" }, startBtn));
    cards[1].body.append(h("p", {}, "10問出ます。IPアドレスの書き方、同じネットワークかどうか、2進数、機器の役目などです。どれも、ステップ1の説明で答えられます。"), bestNote, area);

    // チャレンジ問題（サブネット /25・/28）。中学の範囲をこえるので、クリア（8問以上）には入れない（NW-03）
    const chArea = h("div");
    const chBest = store.getScore(ID, "challengeBest");
    const chNote = h("p", { class: "hint" }, chBest !== undefined ? `チャレンジ問題のこれまでの最高：${chBest} / 2問` : "");
    function startChallenge() {
      const qs = makeChallenge();
      let i = 0;
      let correct = 0;
      const next = () => {
        if (i >= qs.length) {
          const prev = store.getScore(ID, "challengeBest");
          if (prev === undefined || correct > prev) store.setScore(ID, "challengeBest", correct);
          chNote.textContent = `チャレンジ問題のこれまでの最高：${Math.max(correct, prev ?? 0)} / 2問`;
          const again = h("button", { type: "button", class: "btn secondary" }, "もう一度チャレンジ");
          again.addEventListener("click", startChallenge);
          chArea.replaceChildren(h("div", { class: "result-box" }, h("p", {}, h("strong", {}, `チャレンジ問題 ${correct} / ${qs.length}問 正解`), "（クリアの数には入りません）")), h("div", { class: "btn-row" }, again));
          return;
        }
        const nextBtn = h("button", { type: "button", class: "btn", disabled: true }, i === qs.length - 1 ? "結果を見る" : "次の問題へ");
        nextBtn.addEventListener("click", () => {
          i++;
          next();
        });
        chArea.replaceChildren(
          h("p", { class: "hint" }, `チャレンジ ${i + 1} / ${qs.length}問`),
          choiceQuiz(qs[i], (ok) => {
            if (ok) correct++;
            nextBtn.disabled = false;
            nextBtn.focus();
          }),
          h("div", { class: "btn-row" }, nextBtn),
        );
        chArea.querySelector(".choice-list button")?.focus();
      };
      next();
    }
    const chBtn = h("button", { type: "button", class: "btn secondary" }, "チャレンジ問題をはじめる（2問）");
    chBtn.addEventListener("click", startChallenge);
    chArea.append(h("div", { class: "btn-row" }, chBtn));

    cards[2].body.append(
      h("p", {}, "ドリルで8問以上正解するとクリアです。何度でも挑戦できます（問題は毎回変わります）。"),
      h(
        "details",
        { class: "challenge" },
        h("summary", {}, "チャレンジ問題（できる人だけ・クリアには関係ありません）"),
        explainCard(
          "サブネットマスクを変えると",
          "サブネットマスクを 255.255.255.128（/25）や 255.255.255.240（/28）にしてみます。すると、ネットワーク部が長くなります。ホスト部（機器を見分ける部分）は短くなります。ホスト部が n ビットなら、番号は 2の n 乗とおり。そのうち2つは、機器に使えません。いちばん小さい番号（ネットワークそのものを表す番号）と、いちばん大きい番号（全員あての番号）です。",
        ),
        chNote,
        chArea,
      ),
    );
    cards[3].body.append(
      reflectionBox(ID, "家のパソコンとスマホは、IPアドレスのどこが同じで、どこがちがう？　それはなぜ？", () => cards[3].done(), {
        placeholder: "例: 前の3つの数が〇〇で同じ。最後の数は△△でちがう。それは…",
        hint: "ステップ1で入れたIPアドレスや、ドリルの解説を思い出して書こう。",
      }),
    );
    root.append(...cards.map((c) => c.el));
  },
};
