// こまったときの相談先（SEC-63）。中身は data/consult.json（先生が年度ごとに直せる）
import { h } from "./ui.js";
import { loadData } from "./data.js";

// 相談先のカード。データが読めないときも「先生や家の人に相談しよう」は必ず出す
export async function consultCard() {
  let d = {};
  try {
    d = (await loadData("consult")) || {};
  } catch {
    d = {};
  }
  const lines = Array.isArray(d.lines) ? d.lines.filter((x) => x && x.name) : [];
  return h(
    "div",
    { class: "consult", role: "note" },
    h("h4", {}, d.title || "こまったときの相談先"),
    h("p", {}, h("strong", {}, d.school || "学校の先生や家の人にも相談しよう。")),
    d.lead ? h("p", {}, d.lead) : "",
    lines.length ? h("ul", {}, lines.map((x) => h("li", {}, h("strong", {}, x.name), x.tel ? h("span", { class: "tel" }, x.tel) : "", x.hours ? h("span", { class: "hint" }, x.hours) : "", x.who ? h("span", { class: "who" }, `（${x.who}）`) : ""))) : "",
    d.emergency ? h("p", { class: "hint" }, d.emergency) : "",
  );
}
