// 教材集の中で開いたときだけ、重なっている単元に「くわしい教材へ」の案内を出す。
// 元の教材ファイルは変えず、教材集を作るときにこのスクリプトを足している。
// SEC-15: ステップより先に押してしまわないよう、案内はモジュールのさいご（ふりかえりのあと、
// 「次へ」のボタンの前）に、白い控えめなボタンで出す。もどり方も書く。
(function () {
  if (window.parent === window) return;
  var LINKS = __LINKS__;
  var view = document.getElementById("view");
  if (!view) return;
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }
  function ours(c) {
    return c.classList.contains("kyozai-next") || c.classList.contains("kyozai-back") || c.classList.contains("kyozai-link");
  }
  // モジュールのいちばん下の「← 前のモジュール」「次へ」の行（なければ null）
  function bottomNav() {
    for (var c = view.lastElementChild; c; c = c.previousElementSibling) {
      if (ours(c)) continue;
      return c.classList.contains("btn-row") ? c : null;
    }
    return null;
  }
  function apply() {
    var id = location.hash.replace(/^#\/?/, "").split("/")[0];
    var L = LINKS[id];
    if (!L) return;
    if (!view.querySelector(".module-head")) return;
    var box = view.querySelector(".kyozai-link");
    if (!box) {
      box = el("div", "explain kyozai-link");
      var btn = el("button", "btn secondary", "「" + L.title + "」を開く →");
      btn.type = "button";
      btn.addEventListener("click", function () {
        // back: 移った先に「← もとの教材にもどる」を出すための、いまの場所
        window.parent.postMessage({ type: "kyozai-open", id: L.to, hash: L.hash, back: location.hash }, "*");
      });
      box.append(
        el("span", "explain-label", "もっとくわしく学びたいとき"),
        el("p", "", L.text),
        btn,
        el("p", "kyozai-link-hint", "開いた教材の上と下にある「← " + L.fromTitle + "にもどる」を押すと、このページにもどれます。"),
      );
    }
    // 置く場所: さいごの「次へ」の行の前。その行がないときは、モジュールのさいご
    var nav = bottomNav();
    if (nav) {
      if (box.nextElementSibling !== nav) nav.before(box);
    } else if (!box.parentNode) {
      var last = view.lastElementChild;
      while (last && ours(last)) last = last.previousElementSibling;
      if (last) last.after(box);
      else view.append(box);
    }
  }
  new MutationObserver(apply).observe(view, { childList: true });
  apply();
})();
