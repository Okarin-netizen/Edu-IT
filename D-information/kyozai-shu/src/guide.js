// 教材集の中で開いたときだけ、ページの下に「つぎはこれ」の案内を出す。
// 教材の中の順番（steps）と、さいごのページ（end）で次の教材へ進む案内を出す。
// NW-18: ほかの教材の案内（bridge.js）から移ってきたときは、ページの上と下に「← もとの教材にもどる」を出す。
//   どこから来たかは、教材集（shell.js）が window.kyozaiBack.set({ id, title, hash }) で教える。
// 元の教材ファイルは変えず、教材集を作るときにこのスクリプトを足している。
(function () {
  if (window.parent === window) return;
  var G = __GUIDE__;
  var view = document.getElementById("view");
  if (!view) return;
  var steps = G.steps || [];
  var back = null;
  // 先生が「振り返りを隠す」設定にしたとき（shared/eduit-frame.js の EduitFrame.furikaeri）は、
  // 案内の「ふりかえり・記録」を「記録」にし、ふりかえりを書くよう言う文を変える（textNoReflect があればそれ）
  var fkOff = Boolean(window.EduitFrame && window.EduitFrame.furikaeri === false);
  function label(s) {
    return fkOff ? String(s.label).replace("ふりかえり・記録", "記録") : s.label;
  }
  function text(s) {
    if (!fkOff || !s.text || s.text.indexOf("ふりかえり") < 0) return s.text;
    if (typeof s.textNoReflect === "string") return s.textNoReflect;
    return s.hash === "#/records" ? "記録を確かめて、書き出そう。" : s.text;
  }

  function current() {
    var h = location.hash || "#/";
    return h === "#" ? "#/" : h;
  }
  function matches(step, h) {
    if (h === step.hash || (step.also || []).indexOf(h) >= 0) return true;
    return step.hash !== "#/" && h.indexOf(step.hash + "/") === 0;
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function build() {
    var h = current();
    var idx = -1;
    for (var i = 0; i < steps.length; i++) if (matches(steps[i], h)) idx = i;
    var atEnd = G.end && (h === G.end || h.indexOf(G.end + "/") === 0);
    if (idx < 0 && !atEnd) return null;
    var box = el("aside", "kyozai-next");
    box.setAttribute("aria-label", "つぎにやること");
    box.append(el("span", "kyozai-next-label", "つぎはこれ"));
    var next = idx >= 0 && idx < steps.length - 1 ? steps[idx + 1] : null;
    // 教材に同じ行き先の「次へ」ボタンがもうあるときは出さない
    if (next && !atEnd && view.querySelector('a.btn[href="' + next.hash + '"]')) return null;
    if (next && !atEnd) {
      if (text(next)) box.append(el("p", "", text(next)));
      var a = el("a", "btn", label(next) + " →");
      a.href = next.hash;
      // 教材集の中（srcdoc）では href だけだと移れないので、自分で移る
      a.addEventListener("click", function (e) {
        e.preventDefault();
        location.hash = next.hash;
        window.scrollTo(0, 0);
      });
      box.append(a);
    } else {
      var p = el("p", "", G.nextMaterial ? "この教材はここまでです。記録を書き出したら、つぎの教材に進みましょう。" : "これで教材集の教材はぜんぶです。おつかれさまでした。");
      var b = el("button", "btn", G.nextMaterial ? "つぎの教材「" + G.nextMaterial.title + "」を開く →" : "教材集のメニューにもどる");
      b.type = "button";
      b.addEventListener("click", function () {
        window.parent.postMessage(G.nextMaterial ? { type: "kyozai-open", id: G.nextMaterial.id } : { type: "kyozai-home" }, "*");
      });
      box.append(p, b);
    }
    return box;
  }

  function buildBack(where) {
    var box = el("div", "kyozai-back kyozai-back-" + where);
    var b = el("button", "btn secondary", "← " + back.title + "にもどる");
    b.type = "button";
    b.addEventListener("click", function () {
      var to = back;
      back = null;
      apply();
      window.parent.postMessage({ type: "kyozai-open", id: to.id, hash: to.hash, returning: true }, "*");
    });
    box.append(b);
    return box;
  }

  var busy = false;
  function apply() {
    if (busy) return;
    busy = true;
    var old = view.querySelectorAll(".kyozai-next, .kyozai-back");
    for (var i = 0; i < old.length; i++) old[i].remove();
    var box = build();
    if (box) view.append(box);
    if (back) {
      view.prepend(buildBack("top"));
      view.append(buildBack("bottom"));
    }
    // 自分で足した分の変化は無視する
    obs.takeRecords();
    busy = false;
  }
  function ours(n) {
    return n.nodeType === 1 && (n.classList.contains("kyozai-next") || n.classList.contains("kyozai-back"));
  }
  var obs = new MutationObserver(function (list) {
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      for (var j = 0; j < m.addedNodes.length; j++) if (!ours(m.addedNodes[j])) return apply();
      for (var k = 0; k < m.removedNodes.length; k++) if (ours(m.removedNodes[k])) return apply();
    }
  });
  window.kyozaiBack = {
    set: function (info) {
      back = info && info.id && info.title ? { id: String(info.id), title: String(info.title), hash: String(info.hash || "") } : null;
      apply();
    },
  };
  obs.observe(view, { childList: true });
  window.addEventListener("hashchange", function () { setTimeout(apply, 0); });
  apply();
})();
