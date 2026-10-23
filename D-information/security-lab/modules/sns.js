// モジュール⑥: SNS投稿の個人情報チェック
// 写真は架空のイラスト（SVG）。地名・学校名もすべて架空（「ほしぞら台駅」「ほしぞら台中」は実在しない名前として選んだ）。
import { h, explainCard, stepCard, reflectionBox, threeSteps } from "../js/ui.js";

const ID = "sns";
const STEPS = [
  { id: "photo", title: "写真と文章から、手がかりを探そう" },
  { id: "combine", title: "1つ1つは小さな情報でも…" },
  { id: "fix", title: "安全な投稿に直そう" },
  { id: "reflect", title: "ふりかえり" },
];

// 写真の中の手がかり（x, y, w, h は 0〜100 の％）
const PHOTO_CLUES = [
  { id: "sign", x: 52, y: 8, w: 40, h: 13, suspicious: true, label: "駅の看板", explain: "駅名から、よく行く場所や家の近くの駅が分かります。" },
  { id: "pole", x: 3, y: 32, w: 18, h: 20, suspicious: true, label: "電柱の住所表示", explain: "電柱や塀の住所表示から、町名や番地まで分かることがあります。" },
  { id: "emblem", x: 41, y: 49, w: 11, h: 11, suspicious: true, label: "制服の校章", explain: "制服や校章、ジャージから学校が特定されます。" },
  { id: "shadow", x: 50, y: 85, w: 43, h: 11, suspicious: true, label: "長い影", explain: "影の長さや向きから、だいたいの時刻や方角が推測できます。投稿の時刻と合わせると、毎日の行動が分かってしまいます。" },
  { id: "sky", x: 4, y: 4, w: 30, h: 22, suspicious: false, label: "空と雲", explain: "空や雲だけでは、場所はほとんど分かりません。" },
];
const TEXT_CLUES = [
  { id: "routine", text: "部活終わり〜！毎日この時間にここ通るよ🚶", suspicious: true, explain: "「毎日この時間にここ」は、待ちぶせできる情報です。" },
  { id: "tag", text: "#ほしぞら台中 #2年3組 #陸上部", suspicious: true, explain: "学校名・クラス・部活のハッシュタグで、本人をしぼりこめます。" },
  { id: "geo", text: "📍 位置情報: ほしぞら台駅 付近", suspicious: true, explain: "写真や投稿に付いた位置情報で、場所がそのまま分かります。スマホのカメラの設定で、写真に位置情報が記録されることもあります。" },
  { id: "likes", text: "♡ 12", suspicious: false, explain: "いいねの数は、個人の特定にはつながりにくい情報です。" },
];

// ステップ3の直し方。weight は「特定されやすさ」のメーターの減り方。
// essential: これを全部選ばないと「◎ 低い」にならない（公開範囲は、おまけ）
export const SNS_FIXES = [
  { id: "geo", text: "位置情報をオフにする", weight: 25, blur: [], essential: true },
  { id: "blur", text: "看板・電柱・校章をぼかす（または写らないように撮る）", weight: 30, blur: ["sign", "pole", "emblem"], essential: true },
  { id: "tag", text: "学校名・クラスのハッシュタグを消す", weight: 20, blur: [], essential: true },
  { id: "time", text: "「毎日この時間」を消し、投稿は家に帰ってから時間をずらしてする", weight: 20, blur: ["shadow"], essential: true },
  { id: "scope", text: "公開範囲を「知っている友達だけ」にする", weight: 5, blur: [], essential: false },
];

// 選んだ直し方から、特定されやすさを決める（画面に依存しない）
// 「毎日この時間」などの手がかりが1つでも残っていれば「◎ 低い」にはしない
export function snsFixLevel(chosenIds) {
  const chosen = new Set(chosenIds);
  const risk = 100 - SNS_FIXES.filter((f) => chosen.has(f.id)).reduce((a, f) => a + f.weight, 0);
  const allEssential = SNS_FIXES.every((f) => !f.essential || chosen.has(f.id));
  const level = allEssential ? "good" : risk > 60 ? "bad" : "warn";
  return { risk, level, routineLeft: !chosen.has("time") };
}

function photoSvg(blurred = new Set()) {
  const b = (id) => (blurred.has(id) ? ' filter="url(#blur)"' : "");
  return `<svg viewBox="0 0 400 300" role="img" aria-label="駅前で制服の生徒が立っている写真のイラスト。背景に駅の看板と電柱があり、足元から長い影がのびている。">
  <defs><filter id="blur"><feGaussianBlur stdDeviation="6"/></filter></defs>
  <rect width="400" height="300" fill="#bfe0f7"/>
  <g${b("sky")}><ellipse cx="60" cy="40" rx="34" ry="12" fill="#fff"/><ellipse cx="95" cy="50" rx="26" ry="10" fill="#fff"/></g>
  <rect x="190" y="50" width="200" height="150" fill="#d9d2c3"/>
  <rect x="200" y="120" width="40" height="80" fill="#8e8778"/><rect x="330" y="120" width="40" height="80" fill="#8e8778"/>
  <g${b("sign")}><rect x="210" y="24" width="160" height="38" rx="4" fill="#1d5b9e"/><text x="290" y="50" text-anchor="middle" font-size="20" font-weight="700" fill="#fff" font-family="sans-serif">ほしぞら台駅</text></g>
  <rect x="40" y="40" width="10" height="210" fill="#7a7468"/>
  <g${b("pole")}><rect x="14" y="100" width="70" height="52" fill="#2f6f3e"/><text x="49" y="121" text-anchor="middle" font-size="13" fill="#fff" font-family="sans-serif">ほしぞら台</text><text x="49" y="142" text-anchor="middle" font-size="14" fill="#fff" font-family="sans-serif">3丁目5</text></g>
  <rect y="230" width="400" height="70" fill="#a9a59b"/>
  <g${b("shadow")}><polygon points="200,262 370,270 370,282 200,272" fill="#6d6a62" opacity="0.6"/></g>
  <circle cx="190" cy="120" r="22" fill="#f1c9a5"/><path d="M168 112 q22 -30 44 0" fill="#2b2b2b"/>
  <rect x="164" y="142" width="52" height="80" rx="10" fill="#22324f"/>
  <g${b("emblem")}><circle cx="186" cy="166" r="10" fill="#e9c347"/><text x="186" y="170" text-anchor="middle" font-size="11" font-weight="700" fill="#22324f" font-family="sans-serif">星</text></g>
  <rect x="170" y="222" width="14" height="40" fill="#22324f"/><rect x="196" y="222" width="14" height="40" fill="#22324f"/>
</svg>`;
}

export const snsModule = {
  id: ID,
  minutes: "15分",
  lead: "何気ない写真や一言から、分かってしまうことがあります。住んでいる場所や学校、毎日の行動などです。投稿を「見る人の目」でチェックしてみよう。",
  steps: STEPS,
  async render(root) {
    const cards = STEPS.map((s, i) => stepCard(ID, s, i));

    // ステップ1: 手がかり探し
    {
      const c = cards[0];
      const picked = new Set();
      let checked = false;
      const all = [...PHOTO_CLUES, ...TEXT_CLUES];
      const els = new Map();
      const toggle = (clue, el) => {
        if (checked) return;
        picked.has(clue.id) ? picked.delete(clue.id) : picked.add(clue.id);
        el.classList.toggle("picked", picked.has(clue.id));
        el.setAttribute("aria-pressed", picked.has(clue.id) ? "true" : "false");
      };
      const photo = h("div", { class: "sns-photo", html: photoSvg() });
      for (const clue of PHOTO_CLUES) {
        const el = h("button", { type: "button", class: "photo-hs", "aria-pressed": "false", "aria-label": clue.label, style: `left:${clue.x}%;top:${clue.y}%;width:${clue.w}%;height:${clue.h}%` });
        el.addEventListener("click", () => toggle(clue, el));
        els.set(clue.id, el);
        photo.append(el);
      }
      const textEls = TEXT_CLUES.map((clue) => {
        const el = h("button", { type: "button", class: "hs", "aria-pressed": "false" }, clue.text);
        el.addEventListener("click", () => toggle(clue, el));
        els.set(clue.id, el);
        return el;
      });
      const result = h("div");
      const checkBtn = h("button", { class: "btn", type: "button" }, "答え合わせ");
      // 答え合わせのあと、もう一度さがせるようにする（SEC-68）
      const retryBtn = h("button", { class: "btn secondary", type: "button", hidden: true }, "もう一度やる");
      retryBtn.addEventListener("click", () => {
        checked = false;
        picked.clear();
        for (const el of els.values()) {
          el.classList.remove("picked", "found", "missed", "false-pick");
          el.setAttribute("aria-pressed", "false");
        }
        result.replaceChildren();
        checkBtn.disabled = false;
        retryBtn.hidden = true;
        checkBtn.focus();
      });
      checkBtn.addEventListener("click", () => {
        checked = true;
        checkBtn.disabled = true;
        retryBtn.hidden = false;
        const found = all.filter((x) => x.suspicious && picked.has(x.id));
        const total = all.filter((x) => x.suspicious).length;
        for (const x of all) {
          const el = els.get(x.id);
          el.classList.remove("picked");
          if (x.suspicious) el.classList.add(picked.has(x.id) ? "found" : "missed");
          else if (picked.has(x.id)) el.classList.add("false-pick");
        }
        result.replaceChildren(
          explainCard(`手がかり ${total} 個のうち ${found.length} 個を見つけました`, "この投稿から、学校・クラス・部活、よく通る駅、帰る時間まで分かってしまいます。", found.length === total ? "good" : "warn"),
          h("ul", { class: "feedback-list" }, all.map((x) => h("li", { class: x.suspicious ? (picked.has(x.id) ? "found" : "missed") : picked.has(x.id) ? "false-pick" : "" }, h("span", { class: "tag" }, x.suspicious ? (picked.has(x.id) ? "✓ 見つけた" : "！ 見のがし") : "・"), h("strong", {}, x.label || x.text), h("br"), x.explain))),
        );
        c.done();
      });
      c.body.append(
        h("p", {}, "クラスメイトが、こんな投稿をしようとしています。だれでも見られる設定です。住んでいる場所や本人が分かる手がかりを、写真と文章からすべて選ぼう。"),
        h("p", { class: "hint" }, "写真の中の点線の枠や、文章を、タップ（クリック）して選ぼう。選んだところはオレンジの枠になります。もう一度押すと、選ぶのをやめます。"),
        h("div", { class: "mock sns-post" }, h("div", { class: "mock-bar" }, h("span", {}, "👤 @runner_example")), photo, h("div", { class: "mock-body" }, textEls)),
        h("div", { class: "btn-row", style: "justify-content:center" }, checkBtn, retryBtn),
        result,
      );
    }

    // ステップ2: 組み合わせ
    {
      const c = cards[1];
      const posts = ["🎂 今日で14歳！家族でケーキ食べた（10月11日）", "🐕 うちの犬と、毎朝7時に川の土手を散歩するのが日課", "🚲 新しい自転車！家から学校まで15分になった"];
      const infer = [
        { text: "誕生日と年齢", ok: true },
        { text: "毎朝の行動の時間と場所", ok: true },
        { text: "家と学校のだいたいの距離", ok: true },
        { text: "好きな食べ物の作り方", ok: false },
      ];
      const boxes = infer.map((it, i) => h("label", { class: "check-item" }, h("input", { type: "checkbox", id: `infer-${i}` }), h("span", {}, it.text)));
      const fb = h("div", { "aria-live": "polite" });
      c.body.append(
        h("p", {}, "同じ人が、別々の日にこんな投稿をしました。1つずつなら、よくある投稿です。"),
        h("ul", { class: "feedback-list" }, posts.map((p) => h("li", {}, p))),
        h("p", {}, h("strong", {}, "3つを組み合わせると、知らない人にも分かってしまうことはどれ？（あてはまるものすべて）")),
        h("div", { class: "check-list" }, boxes),
        h(
          "div",
          { class: "btn-row" },
          h(
            "button",
            {
              class: "btn",
              type: "button",
              onclick: () => {
                const ok = infer.every((it, i) => boxes[i].querySelector("input").checked === it.ok);
                fb.replaceChildren(explainCard(ok ? "そのとおり！" : "答え", "誕生日、毎朝7時に土手にいること、家が学校から自転車で15分。小さな情報も、組み合わせると本人が特定されます。過去の投稿も見られます。", ok ? "good" : "warn"));
                c.done();
              },
            },
            "答え合わせ",
          ),
        ),
        fb,
      );
    }

    // ステップ3: 投稿を直す
    {
      const c = cards[2];
      const fixes = SNS_FIXES;
      const chosen = new Set();
      const photo = h("div", { class: "sns-photo", html: photoSvg() });
      const meter = h("div");
      const draw = () => {
        const blurred = new Set(fixes.filter((f) => chosen.has(f.id)).flatMap((f) => f.blur));
        photo.innerHTML = photoSvg(blurred);
        const { risk, level, routineLeft } = snsFixLevel(chosen);
        meter.replaceChildren(
          h("p", {}, "特定されやすさ: ", h("span", { class: `status ${level}` }, level === "bad" ? "× 高い" : level === "warn" ? "△ まだある" : "◎ 低い")),
          h("div", { class: "bar", role: "meter", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": risk, "aria-label": "特定されやすさ" }, h("span", { style: `width:${risk}%;background:var(--${level})` })),
          routineLeft && chosen.size > 0 ? h("p", { class: "hint" }, "「毎日この時間にここ」は、待ちぶせに使われることがある情報です。消そう。") : "",
        );
        if (level === "good") c.done();
      };
      const list = fixes.map((f) =>
        h(
          "label",
          { class: "check-item" },
          h("input", {
            type: "checkbox",
            onchange: (e) => {
              e.target.checked ? chosen.add(f.id) : chosen.delete(f.id);
              draw();
            },
          }),
          h("span", {}, f.text),
        ),
      );
      c.body.append(h("p", {}, "この投稿を安全にするには、どう直せばいい？ 直し方を選ぶと、写真が変わります。"), h("div", { class: "field-row" }, h("div", { class: "check-list" }, list), h("div", {}, photo, meter)), h("p", { class: "hint" }, "顔がはっきり写っていると、知らない人にも本人だと分かります。顔は写さないか、スタンプでかくそう。"), explainCard("公開範囲だけでは足りない", "「友達だけ」にしても、スクリーンショットで外に広がることがあります。だれに見られても困らない投稿にすることが基本です。", "warn"), threeSteps({ stop: "投稿ボタンの前で止まる", check: "写りこみ・位置情報・文章を確認", ask: "迷ったら家族に見てもらう" }));
      draw();
    }

    cards[3].body.append(reflectionBox(ID, "投稿する前に何を確かめる？ それはなぜ？", () => cards[3].done()));
    root.append(...cards.map((c) => c.el));
  },
};
