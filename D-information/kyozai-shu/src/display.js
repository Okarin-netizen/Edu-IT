// 教材集の中で開いたときだけ、上のバーの「ふりがな」「大きな文字」を教材にかける。
// ・教材にもともと同じボタン（「大きな文字」、情報セキュリティ体験ラボの「ふりがな」）があるときは、
//   そのボタンを教材集のボタンに合わせて押す（ふりがなが二重にならないように）。教材のボタンは教材集の中ではかくす。
// ・ないときは、ここで文字を大きくし（html.large-text）、ruby.js のしくみでふりがなを付ける。
// 元の教材ファイルは変えず、教材集を作るときにこのスクリプトを足している。
(function () {
  if (window.parent === window) return;
  var CFG = __DISPLAY__;
  var PREFS_KEY = "kyozai.prefs.v1";
  var state = { ruby: false, largeText: false };
  try {
    var saved = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
    state.ruby = Boolean(saved && saved.ruby);
    state.largeText = Boolean(saved && saved.largeText);
  } catch (e) {}
  var engine = CFG.ownRuby ? null : kyozaiRuby(document, CFG.words, CFG.skip);

  // ボタンの名前（ふりがなの読みは数えない）
  function labelOf(el) {
    var s = "";
    var tw = document.createTreeWalker(el, 4);
    while (tw.nextNode()) if (!tw.currentNode.parentNode.closest("rt, rp")) s += tw.currentNode.nodeValue;
    return s.replace(/\s+/g, "");
  }
  function findToggle(label) {
    var bs = document.querySelectorAll("header button, .display-toggles button");
    // 「文字 中/大」の形のボタンは data-kz-label="大きな文字" で見分ける
    for (var i = 0; i < bs.length; i++) if ((bs[i].getAttribute("data-kz-label") || labelOf(bs[i])) === label) return bs[i];
    return null;
  }
  // 教材のボタンを、教材集の設定に合わせる。押したのにまだ切りかわっていないボタンは、もう一度押さない
  var pressed = new WeakMap();
  var presses = [];
  function drive(label, want) {
    var b = findToggle(label);
    if (!b) return false;
    b.setAttribute("data-kz-driven", "");
    var now = b.getAttribute("aria-pressed");
    if ((now === "true") === want) return true;
    if (pressed.get(b) === now) return true;
    // 万一、教材のボタンが切りかわらないときに押しつづけないように（2秒に4回まで）
    var t = Date.now();
    presses = presses.filter(function (x) {
      return t - x < 2000;
    });
    if (presses.length >= 4) return true;
    presses.push(t);
    pressed.set(b, now);
    b.click();
    return true;
  }

  function sync() {
    if (!drive("大きな文字", state.largeText)) document.documentElement.classList.toggle("large-text", state.largeText);
    // 教材が自分の「ふりがな」を持っているときは、そちらを使う（ここのふりがなは外す）
    var own = drive("ふりがな", state.ruby);
    if (engine && document.body) engine.set(own ? false : state.ruby, document.body);
    // 教材の表示の切りかえが、ぜんぶ教材集のボタンにまとまったら、その場所ごとかくす
    var groups = document.querySelectorAll(".display-toggles");
    for (var i = 0; i < groups.length; i++) {
      var bs = groups[i].querySelectorAll("button");
      var n = 0;
      for (var j = 0; j < bs.length; j++) if (bs[j].hasAttribute("data-kz-driven")) n++;
      groups[i].toggleAttribute("data-kz-empty", bs.length > 0 && n === bs.length);
    }
  }

  // 教材が上のバーを書きかえたら（ボタンが出てきたら）合わせ直す
  var queued = false;
  function queue() {
    if (queued) return;
    queued = true;
    Promise.resolve().then(function () {
      queued = false;
      sync();
    });
  }
  function watch() {
    new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var t = list[i].target;
        if (t.nodeType === 1 && (t.closest("header, .display-toggles") || t.querySelector("header, .display-toggles"))) return queue();
      }
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-pressed"] });
    sync();
  }
  if (document.body) watch();
  else document.addEventListener("DOMContentLoaded", watch);

  // 教材集の上のバーから呼ばれる
  window.kyozaiDisplay = {
    set: function (p) {
      state.ruby = Boolean(p && p.ruby);
      state.largeText = Boolean(p && p.largeText);
      sync();
    },
  };
})();
