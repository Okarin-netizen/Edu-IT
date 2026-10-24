// モジュール③: 暗号ラボ（シーザー暗号 → 総当たり → 頻度分析 ｜2回目｜ ヴィジュネル暗号 → 鍵の受け渡し → 素因数分解 → 発展: 公開鍵暗号RSA）
// 2回の授業に分ける前提（1回目: ステップ1〜3、2回目: ステップ4〜）。RSA の計算は「発展」で、やらなくても完了になる。
import { h, explainCard, stepCard, reflectionBox, choiceQuiz, furikaeriOn } from "../js/ui.js";
import { loadData } from "../js/data.js";
import { caesar, vigenere, letterCounts, guessCaesarShift, rsaKeygen, rsaEncrypt, rsaDecrypt, freqHint, judgeFactor } from "../js/cryptolib.js";

const ID = "crypto";
const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const STEPS = [
  { id: "caesar", title: "シーザー暗号で暗号文を作ろう" },
  { id: "brute", title: "鍵を知らなくても解ける？（総当たり）" },
  { id: "freq", title: "頻度分析で解読しよう" },
  { id: "vigenere", title: "ヴィジュネル暗号で強くしよう" },
  { id: "keyx", title: "鍵をどうやって渡す？" },
  // id は前の版（RSAのステップ。素因数分解チャレンジも入っていた）と同じ「rsa」のまま。
  // この端末の記録・読み込んだ記録と、理解度チェックの復習リンク（#/crypto/rsa: 素因数分解の問題）をそのまま使えるように
  { id: "rsa", title: "かけ算は簡単、もどすのは大変（素因数分解チャレンジ）" },
  { id: "reflect", title: "ふりかえり" },
];
// 発展（やれる人だけ）。STEPS に入れないので、やらなくてもモジュールは完了になる
const ADVANCED = { id: "rsa-extra", title: "公開鍵暗号（RSA）を小さな数で体験" };
// 2回に分けるときの区切り（このステップのあと）
export const SESSION_BREAK_AFTER = "freq";

function randomShift() {
  const a = new Uint8Array(1);
  crypto.getRandomValues(a);
  return 3 + (a[0] % 21); // 3〜23（0や1だと簡単すぎるので）
}

function cipherWheel(shift) {
  return h(
    "div",
    { class: "cipher-wheel", "aria-label": `対応表: A は ${A[shift]} になる` },
    h("div", { class: "row" }, [...A].map((c) => h("span", {}, c))),
    h("div", { class: "arrow" }, `↓ ${shift} 文字ずらす`),
    h("div", { class: "row out" }, [...A].map((_, i) => h("span", {}, A[(i + shift) % 26]))),
  );
}

// 26文字の棒グラフ（1系列なので凡例なし。見出しで何のグラフかを示す）
function freqBars(values, { title, highlight = [] } = {}) {
  const max = Math.max(...values, 0.0001);
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const W = 520, H = 120, bw = W / 26;
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H + 18}`);
  svg.setAttribute("role", "img");
  const top3 = values.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 3).map((x) => A[x[1]]);
  svg.setAttribute("aria-label", `${title}。多い文字の上位3つ: ${top3.join("、")}`);
  values.forEach((v, i) => {
    const bh = (v / max) * (H - 8);
    const r = document.createElementNS(NS, "rect");
    r.setAttribute("x", i * bw + 2);
    r.setAttribute("y", H - bh);
    r.setAttribute("width", bw - 4);
    r.setAttribute("height", Math.max(bh, 0.5));
    r.setAttribute("rx", 3);
    r.setAttribute("fill", highlight.includes(i) ? "var(--fig-series-2)" : "var(--fig-series-1)");
    const t = document.createElementNS(NS, "title");
    t.textContent = `${A[i]}: ${Math.round((v / total) * 1000) / 10}%`;
    r.append(t);
    const lab = document.createElementNS(NS, "text");
    lab.setAttribute("x", i * bw + bw / 2);
    lab.setAttribute("y", H + 14);
    lab.setAttribute("text-anchor", "middle");
    lab.setAttribute("class", highlight.includes(i) ? "label-strong" : "axis");
    lab.textContent = A[i];
    svg.append(r, lab);
  });
  return h("figure", { class: "chart", style: "margin:8px 0" }, h("figcaption", { class: "hint" }, title), svg);
}

export const cryptoModule = {
  id: ID,
  minutes: "2回に分けて 各15〜20分",
  lead: "暗号は「鍵」を知っている人だけが読めるようにするしくみです。昔の暗号を作って、破ってみることで、今の暗号がなぜ強いのかを考えよう。",
  steps: STEPS,
  async render(root) {
    const data = await loadData("crypto");
    const romaji = data.romajiFrequency.values;
    const cards = STEPS.map((s, i) => stepCard(ID, s, i));
    const adv = stepCard(ID, ADVANCED, STEPS.length);
    adv.el.querySelector(".badge").textContent = "発展";
    adv.el.classList.add("advanced-step");
    const breakIdx = STEPS.findIndex((st) => st.id === SESSION_BREAK_AFTER);
    const secondFirst = STEPS[breakIdx + 1];
    const goSecond = () => {
      const t = document.getElementById(`step-${ID}-${secondFirst.id}`);
      t?.scrollIntoView({ behavior: "smooth", block: "start" });
      t?.setAttribute("tabindex", "-1");
      t?.focus({ preventScroll: true });
    };
    root.append(
      explainCard(
        "すすめ方（2回に分けます）",
        h(
          "div",
          {},
          h(
            "ul",
            { style: "margin:4px 0" },
            h("li", {}, h("strong", {}, "1回目: "), `ステップ1〜${breakIdx + 1}（昔の暗号を作って、破る）約15〜20分`),
            h("li", {}, h("strong", {}, "2回目: "), `ステップ${breakIdx + 2}〜${STEPS.length}（強い暗号、鍵の受け渡し、素因数分解）約15〜20分`),
            h("li", {}, h("strong", {}, "発展: "), "公開鍵暗号（RSA）の計算は、やれる人だけ。やらなくても、この体験は完了になります。"),
          ),
          h("div", { class: "btn-row" }, h("button", { class: "btn small secondary", type: "button", onclick: goSecond }, `2回目の人: ステップ${breakIdx + 2}へ ↓`)),
        ),
      ),
    );

    // ステップ1: シーザー暗号
    {
      const c = cards[0];
      const input = h("input", { type: "text", id: "caesar-in", value: data.caesarSample, autocomplete: "off", spellcheck: "false" });
      const slider = h("input", { type: "range", id: "caesar-shift", min: "0", max: "25", value: "3" });
      const shiftLabel = h("output", { for: "caesar-shift" }, "3");
      const wheel = h("div");
      const out = h("div", { class: "cipher-text", "aria-live": "polite" });
      let touched = false;
      const update = () => {
        const s = Number(slider.value);
        shiftLabel.textContent = s;
        wheel.replaceChildren(cipherWheel(s));
        out.textContent = caesar(input.value, s);
        if (touched && s !== 0 && input.value.trim()) c.done();
      };
      input.addEventListener("input", () => ((touched = true), update()));
      slider.addEventListener("input", () => ((touched = true), update()));
      c.body.append(
        h("p", {}, "シーザー暗号は、2000年以上前からある暗号です。アルファベットを決まった数だけずらします。「何文字ずらすか」が鍵になります。"),
        h("div", { class: "field" }, h("label", { for: "caesar-in" }, "もとの文（ローマ字・英字）"), input),
        h("div", { class: "field" }, h("label", { for: "caesar-shift" }, "鍵（ずらす数）: ", shiftLabel), slider),
        wheel,
        h("p", { style: "margin-top:10px" }, h("strong", {}, "暗号文")),
        out,
        explainCard("やってみよう", "となりの人と鍵（ずらす数）を決めて、暗号文だけを見せ合おう。鍵を知っていれば、反対向きにずらすだけで元に戻せます。"),
      );
      update();
    }

    // ステップ2: 総当たり
    {
      const c = cards[1];
      const key = randomShift();
      const plain = data.messages[0].split(".")[0] + ".";
      const cipher = caesar(plain, key);
      const tableWrap = h("div", { class: "table-wrap" });
      const fb = h("div", { "aria-live": "polite" });
      const showAll = () => {
        const rows = [];
        for (let s = 1; s < 26; s++) {
          const cand = caesar(cipher, -s);
          const btn = h("button", { class: "btn small secondary", type: "button" }, "これだ！");
          const tr = h("tr", {}, h("td", {}, `${s}`), h("td", { class: "mono" }, cand), h("td", {}, btn));
          btn.addEventListener("click", () => {
            if (s === key) {
              tr.classList.add("hit");
              fb.replaceChildren(explainCard("解読成功！", `鍵は「${key}」でした。鍵の候補が25通りしかないので、全部試せばすぐに見つかります。これが<strong>総当たり攻撃</strong>です。`, "good"));
              c.done();
            } else {
              fb.replaceChildren(explainCard("もう一度", "その行は意味の通る文になっているかな？ ローマ字として読めるものを探そう。", "warn"));
            }
          });
          rows.push(tr);
        }
        tableWrap.replaceChildren(h("table", { class: "data shift-table" }, h("thead", {}, h("tr", {}, h("th", {}, "戻す数"), h("th", {}, "結果"), h("th", {}, ""))), h("tbody", {}, rows)));
      };
      c.body.append(
        h("p", {}, "友達からの暗号文を手に入れました。でも鍵（ずらす数）はわかりません。"),
        h("div", { class: "cipher-text" }, cipher),
        h("div", { class: "btn-row" }, h("button", { class: "btn", type: "button", onclick: showAll }, "25通りをすべて試す")),
        tableWrap,
        fb,
      );
    }

    // ステップ3: 頻度分析
    {
      const c = cards[2];
      const msgIndex = new Uint8Array(1);
      crypto.getRandomValues(msgIndex);
      const plain = data.messages[1 + (msgIndex[0] % (data.messages.length - 1))];
      const key = randomShift();
      const cipher = caesar(plain, key);
      const counts = letterCounts(cipher);
      const top = counts.indexOf(Math.max(...counts));
      const slider = h("input", { type: "range", id: "freq-shift", min: "0", max: "25", value: "0" });
      const label = h("output", { for: "freq-shift" }, "0");
      const preview = h("div", { class: "cipher-text", "aria-live": "polite" });
      const expectedWrap = h("div");
      const fb = h("div", { "aria-live": "polite" });
      const update = () => {
        const s = Number(slider.value);
        label.textContent = s;
        preview.textContent = caesar(cipher, -s);
        // 「ふつうのローマ字の頻度」を s だけずらして重ねると、暗号文の形と一致するところが鍵
        const shifted = A.split("").map((_, i) => romaji[(i - s + 26) % 26]);
        expectedWrap.replaceChildren(freqBars(shifted, { title: `ふつうのローマ字の文字の多さを、${s} 文字ずらしたもの（上のグラフと形が重なれば正解に近い）`, highlight: [s % 26] }));
        if (s === key) {
          fb.replaceChildren(explainCard("解読成功！", "鍵を総当たりしなくても、「文字の出やすさのかたより」から鍵がわかりました。これが<strong>頻度分析</strong>です。ずらすだけの暗号は、文が長くなるほど破られやすくなります。", "good"));
          c.done();
        } else fb.replaceChildren();
      };
      slider.addEventListener("input", update);
      c.body.append(
        h("p", {}, "ローマ字で書いた日本語では、母音の A・I・O・U がとても多く出てきます。暗号文でよく出る文字を調べれば、どの文字が A なのか見当がつきます。"),
        h("div", { class: "cipher-text" }, cipher),
        freqBars(counts, { title: "暗号文に出てくる文字の数", highlight: [top] }),
        expectedWrap,
        h("div", { class: "field" }, h("label", { for: "freq-shift" }, "戻す数（鍵の予想）: ", label), slider),
        h("p", {}, h("strong", {}, "戻した結果")),
        preview,
        h(
          "details",
          {},
          h("summary", {}, "ヒント"),
          h("p", {}, freqHint(top)),
          h("button", { class: "btn small secondary", type: "button", onclick: () => ((slider.value = String(guessCaesarShift(cipher, romaji))), update()) }, "コンピュータに推定させる"),
        ),
        fb,
      );
      update();
    }

    // ステップ4: ヴィジュネル暗号
    {
      const c = cards[3];
      const plainIn = h("input", { type: "text", id: "vig-plain", value: data.vigenereSample.plain, autocomplete: "off", spellcheck: "false" });
      const keyIn = h("input", { type: "text", id: "vig-key", value: data.vigenereSample.key, autocomplete: "off", spellcheck: "false", maxlength: "12" });
      const out = h("div", { class: "cipher-text", "aria-live": "polite" });
      const detail = h("div", { class: "table-wrap" });
      const charts = h("div");
      let touched = false;
      const update = () => {
        const key = keyIn.value.toUpperCase().replace(/[^A-Z]/g, "");
        const cipher = vigenere(plainIn.value, key);
        out.textContent = cipher;
        const letters = plainIn.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 14);
        detail.replaceChildren(
          key
            ? h(
                "table",
                { class: "data mono" },
                h("tbody", {}, h("tr", {}, h("th", {}, "もとの文字"), [...letters].map((ch) => h("td", {}, ch))), h("tr", {}, h("th", {}, "鍵の文字"), [...letters].map((_, i) => h("td", {}, key[i % key.length]))), h("tr", {}, h("th", {}, "ずらす数"), [...letters].map((_, i) => h("td", {}, A.indexOf(key[i % key.length])))), h("tr", {}, h("th", {}, "暗号文字"), [...letters].map((ch, i) => h("td", {}, A[(A.indexOf(ch) + A.indexOf(key[i % key.length])) % 26])))),
              )
            : h("p", { class: "hint" }, "鍵の言葉を英字で入れてください。"),
        );
        const long = data.messages.join(" ");
        charts.replaceChildren(
          freqBars(letterCounts(caesar(long, 7)), { title: "長い文をシーザー暗号（7ずらす）にしたときの文字の数：山がはっきりしている" }),
          key ? freqBars(letterCounts(vigenere(long, key)), { title: `同じ文をヴィジュネル暗号（鍵 ${key}）にしたときの文字の数：山がならされている` }) : "",
        );
        if (touched && key.length >= 3) c.done();
      };
      plainIn.addEventListener("input", () => ((touched = true), update()));
      keyIn.addEventListener("input", () => ((touched = true), update()));
      c.body.append(
        h("p", {}, "ヴィジュネル暗号は、鍵を「言葉」にして、1文字ごとにずらす数を変える暗号です。同じ文字でも、場所によって違う文字になります。"),
        h("div", { class: "field-row" }, h("div", { class: "field" }, h("label", { for: "vig-plain" }, "もとの文"), plainIn), h("div", { class: "field" }, h("label", { for: "vig-key" }, "鍵の言葉（3文字以上）"), keyIn)),
        h("p", {}, h("strong", {}, "暗号文")),
        out,
        detail,
        charts,
        explainCard("でも…", "ヴィジュネル暗号も、鍵の長さを見つける方法が見つかり、19世紀には破られました。今の暗号は数学を使っていて、コンピュータでも現実的な時間では解けません。"),
      );
      update();
    }

    // ステップ5: 鍵の受け渡し問題
    {
      const c = cards[4];
      c.body.append(
        h("p", {}, "ここまでの暗号は、暗号にする鍵と元に戻す鍵が同じでした（共通鍵暗号）。では、遠くにいる相手と、その鍵をどうやって共有すればよいでしょう？"),
        h(
          "div",
          { class: "kx-diagram", "aria-label": "Aさんが暗号文をBさんに送る。途中でEさんが通信をのぞき見ている。" },
          h("div", { class: "kx-person" }, h("span", { class: "emoji", "aria-hidden": "true" }, "🧑"), "Aさん（送る人）"),
          h("div", { class: "kx-mid" }, "暗号文 →", h("br"), h("span", { "aria-hidden": "true" }, "👀"), " Eさんがのぞき見"),
          h("div", { class: "kx-person" }, h("span", { class: "emoji", "aria-hidden": "true" }, "🧑"), "Bさん（受け取る人）"),
        ),
        choiceQuiz(
          {
            question: "Aさんは、鍵をどうやってBさんに伝えればいい？",
            choices: ["暗号文と同じメールの最後に、鍵も書いていっしょに送る", "暗号文とは別のメールにして、鍵だけをあとから送る", "だれでも閉められ、Bさんだけが開ける南京錠を使う"],
            answer: 2,
            explain: "鍵を送ると、のぞき見ているEさんにも知られます。そこで<strong>公開鍵暗号</strong>。Bさんは開いた南京錠（公開鍵）を配り、その鍵（秘密鍵）は自分だけが持ちます。南京錠で閉めた箱は、Bさんにしか開けられません。",
          },
          () => c.done(),
        ),
      );
    }

    // ステップ6: 素因数分解チャレンジ（全員）
    {
      const c = cards[5];
      c.body.append(
        h("p", {}, "公開鍵暗号（RSAなど）の公開鍵には、2つの素数をかけた数 n が入っています。n から元の2つの素数が分かると、秘密鍵も計算できてしまいます。"),
        h("div", { class: "math-line" }, "かけ算: 11 × 13 ＝ 143 …… すぐできる"),
        h("div", { class: "math-line" }, "もどす: 143 ＝ ？ × ？ …… どの数でわればいい？"),
        factorChallenge(() => c.done()),
        explainCard("なぜ安全なの？", "けたが増えると、わり切れる数を探すのはどんどん大変になります。実際の n は600けた以上あり、分解できないので、公開しても安全です。"),
        h("p", { class: "hint" }, `時間がある人は、${furikaeriOn() ? "ふりかえりのあと" : "このページのさいご"}の「発展」で、RSA の計算をたどってみよう。`),
      );
    }

    // 発展: RSA（小さな数）。やれる人だけ（STEPS に入っていないので、やらなくても完了になる）
    {
      const c = adv;
      const pSel = h("select", { id: "rsa-p" }, data.rsaPrimes.map((p) => h("option", { value: p, selected: p === 17 ? true : null }, p)));
      const qSel = h("select", { id: "rsa-q" }, data.rsaPrimes.map((p) => h("option", { value: p, selected: p === 23 ? true : null }, p)));
      const keyOut = h("div", { "aria-live": "polite" });
      const msgIn = h("input", { type: "text", id: "rsa-msg", value: "HIMITSU", maxlength: "10", autocomplete: "off", spellcheck: "false" });
      const encOut = h("div", { "aria-live": "polite" });
      let keys = null;
      const makeKeys = () => {
        const p = Number(pSel.value), q = Number(qSel.value);
        encOut.replaceChildren();
        try {
          keys = rsaKeygen(p, q);
          keyOut.replaceChildren(
            h("div", { class: "math-line" }, `n ＝ p × q ＝ ${p} × ${q} ＝ ${keys.n}`),
            h("div", { class: "math-line" }, `φ（ファイ）＝ (p − 1) × (q − 1) ＝ ${p - 1} × ${q - 1} ＝ ${keys.phi}`),
            h("div", { class: "math-line" }, `e ＝ ${keys.e}（φ ＝ ${keys.phi} と、1 のほかに共通の約数がない数を選ぶ）`),
            h("div", { class: "math-line" }, `d ＝ ${keys.d}（e × d を φ でわると 1 あまる数: ${keys.e} × ${keys.d} ＝ ${keys.e * keys.d} ＝ ${keys.phi} × ${(keys.e * keys.d) / keys.phi} ＋ 1）`),
            h("p", { class: "hint", style: "margin:4px 0" }, "φ（ギリシャ文字。「ファイ」と読む）は、鍵を作るときだけ使う数です。e と d の決め方は、高校・大学で学ぶ数学です。ここでは、決めた鍵で「元に戻る」ことを確かめよう。"),
            h(
              "div",
              { class: "field-row", style: "margin-top:10px" },
              explainCard("🔓 公開鍵（みんなに見せてよい）", `n ＝ ${keys.n}、e ＝ ${keys.e}`, "good"),
              explainCard("🔑 秘密鍵（自分だけのひみつ）", `d ＝ ${keys.d}（p と q も秘密）`, "warn"),
            ),
          );
        } catch (e) {
          keys = null;
          keyOut.replaceChildren(explainCard("鍵を作れません", e.message, "warn"));
        }
      };
      const encrypt = () => {
        if (!keys) return;
        const letters = msgIn.value.toUpperCase().replace(/[^A-Z]/g, "");
        if (!letters) {
          encOut.replaceChildren(explainCard("文字を入れてください", "英字で入力してください。", "warn"));
          return;
        }
        const rows = [...letters].map((ch) => {
          const m = BigInt(A.indexOf(ch) + 1); // A=1 … Z=26
          const cnum = rsaEncrypt(m, keys.e, keys.n);
          const back = rsaDecrypt(cnum, keys.d, keys.n);
          return h("tr", {}, h("td", {}, ch), h("td", {}, `${m}`), h("td", { class: "mono" }, `${m}^${keys.e} mod ${keys.n} ＝ `, h("strong", {}, `${cnum}`)), h("td", { class: "mono" }, `${cnum}^${keys.d} mod ${keys.n} ＝ ${back}`), h("td", {}, A[Number(back) - 1]));
        });
        // 1行目だけ、途中の計算を見せる（^ と mod の意味が分かるように）
        const m0 = BigInt(A.indexOf(letters[0]) + 1);
        const pow0 = m0 ** keys.e;
        const times = keys.e <= 5n ? `${Array.from({ length: Number(keys.e) }, () => `${m0}`).join(" × ")} ＝ ${pow0}` : `${m0} を ${keys.e} 回かけると ${pow0}`;
        encOut.replaceChildren(
          explainCard(
            "記号の読み方",
            h(
              "div",
              {},
              h("p", { style: "margin:0" }, "「", h("span", { class: "mono" }, "8^3"), "」は「8 の 3 乗」で、8 × 8 × 8 のこと。「", h("span", { class: "mono" }, "mod 391"), "」は「391 でわったあまり」のことです。"),
              h("p", { style: "margin:6px 0 0" }, `1文字目「${letters[0]}」（${m0}）の場合: ${times}。${pow0} ÷ ${keys.n} ＝ ${pow0 / keys.n} あまり ${pow0 % keys.n}。だから暗号は ${pow0 % keys.n} です。`),
            ),
          ),
          h("div", { class: "table-wrap" }, h("table", { class: "data" }, h("thead", {}, h("tr", {}, h("th", {}, "文字"), h("th", {}, "数にする"), h("th", {}, "公開鍵で暗号化"), h("th", {}, "秘密鍵で復号"), h("th", {}, "元の文字"))), h("tbody", {}, rows))),
          explainCard(
            "なぜ安全なの？",
            `秘密鍵 d を計算するには、n ＝ ${keys.n} を素数 p と q のかけ算に分けます（素因数分解）。小さな数ならすぐですが、実際の n は600けた以上あり、分解できません。`,
          ),
          explainCard("注意", "ここでは、1文字ずつ暗号にしています。同じ文字は同じ数になるので、これは<strong>しくみを見るための小さな模型</strong>です。", "warn"),
        );
        c.done();
      };
      pSel.addEventListener("change", makeKeys);
      qSel.addEventListener("change", makeKeys);
      c.body.append(
        h("p", {}, "ここは、やれる人だけの発展です。RSAは「かけ算は簡単、その逆（素因数分解）は難しい」ことを使います。小さな素数でたどってみよう。"),
        h("div", { class: "field-row" }, h("div", { class: "field" }, h("label", { for: "rsa-p" }, "素数 p"), pSel), h("div", { class: "field" }, h("label", { for: "rsa-q" }, "素数 q"), qSel)),
        keyOut,
        h("div", { class: "field" }, h("label", { for: "rsa-msg" }, "暗号にする言葉（英字10文字まで）"), msgIn),
        h("div", { class: "btn-row" }, h("button", { class: "btn", type: "button", onclick: encrypt }, "公開鍵で暗号化して、秘密鍵で戻す")),
        encOut,
      );
      makeKeys();
      // 発展なので、ふだんは折りたたんでおく（ページを短くするため）。最初の説明だけ見せる
      const [intro, ...rest] = [...c.body.childNodes];
      c.body.replaceChildren(intro, h("details", { class: "advanced-body" }, h("summary", {}, "ひらいて挑戦する（やれる人だけ）"), ...rest));
    }

    cards[6].body.append(reflectionBox(ID, "インターネットで公開鍵暗号が必要なのは、なぜだと思う？ 一言で書こう。", () => cards[6].done()));
    const sessionBreak = h(
      "div",
      { class: "session-break", role: "note", style: "margin:18px 0;padding:12px 14px;border:2px dashed var(--ef-accent);border-radius:12px;background:var(--ef-accent-soft);text-align:center" },
      h("strong", { style: "display:block;font-size:1.05rem" }, `ここまでで1回目。次の時間はステップ${breakIdx + 2}から`),
      h("span", { class: "hint" }, "進み具合はこの端末に残っています。次の時間は、左のメニューの「暗号ラボ」を開いて、この下から始めよう。"),
    );
    root.append(...cards.slice(0, breakIdx + 1).map((c) => c.el), sessionBreak, ...cards.slice(breakIdx + 1).map((c) => c.el), adv.el);
  },
};

// 素因数分解チャレンジ: 小さい n は手で分解できるが、けたが増えると大変になることを体験。
// 1問正解するか、2回ためしてから答えを見たら onDone
const FACTOR_PROBLEMS = [143, 323, 899, 3233];
function smallestFactor(n) {
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return d;
  return n;
}
function factorChallenge(onDone) {
  const fb = h("div", { "aria-live": "polite" });
  const sel = h("select", { id: "factor-n" }, FACTOR_PROBLEMS.map((n) => h("option", { value: n }, n)));
  const input = h("input", { type: "text", inputmode: "numeric", id: "factor-guess", autocomplete: "off", placeholder: "わり切れる素数" });
  const showBtn = h("button", { class: "btn small secondary", type: "button", hidden: true }, "答えを見る");
  let misses = 0;
  const check = () => {
    const n = Number(sel.value);
    const r = judgeFactor(n, input.value);
    fb.replaceChildren(explainCard(r.ok ? "正解！" : r.title, r.text, r.ok ? "good" : "warn"));
    if (r.ok) onDone && onDone();
    else if (++misses >= 2) showBtn.hidden = false;
  };
  showBtn.addEventListener("click", () => {
    const n = Number(sel.value);
    const d = smallestFactor(n);
    fb.replaceChildren(explainCard("答え", `${n} ＝ ${d} × ${n / d}。けたが増えると、さがすのがぐんと大変になったよね。それが公開鍵暗号を守っています。`, "info"));
    onDone && onDone();
  });
  sel.addEventListener("change", () => {
    misses = 0;
    showBtn.hidden = true;
    fb.replaceChildren();
  });
  input.addEventListener("keydown", (e) => e.key === "Enter" && !e.isComposing && check());
  return h(
    "div",
    { style: "margin-top:12px" },
    h("p", {}, h("strong", {}, "チャレンジ: "), "n を2つの素数のかけ算に分けられるかな？ 電卓を使ってもいいよ。けたが増えるほど大変になることを体感しよう。"),
    h("div", { class: "field-row" }, h("div", { class: "field" }, h("label", { for: "factor-n" }, "n"), sel), h("div", { class: "field" }, h("label", { for: "factor-guess" }, "わり切れる数"), input)),
    h("div", { class: "btn-row" }, h("button", { class: "btn small", type: "button", onclick: check }, "たしかめる"), showBtn),
    fb,
  );
}
