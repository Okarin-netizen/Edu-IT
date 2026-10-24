// 教材集の中で開いたときだけ、ふりがな・文字の大きさを教材にかける。
// ふりがな・文字の大きさは全教材で共通の設定(shared/eduit-frame.js の EduitFrame.prefs。localStorage 'eduit.prefs')。
// 教材集の上のバーで変えると、同じページの iframe の中の教材にも、そのまま伝わる(storage のしらせ)。
// ・教材の上のバーにある同じボタン(data-ef-pref)は、教材集のボタンと二重にならないように印を付けてかくす(assist.css)。
// ・自分のふりがなを持たない教材には、ruby.js のしくみでふりがなを付ける(自分のふりがなを持つ教材は、教材が EduitFrame.prefs を見て付ける)。
// 元の教材ファイルは変えず、教材集を作るときにこのスクリプトを足している。
(function () {
  if (window.parent === window) return;
  var CFG = __DISPLAY__;
  var prefs = window.EduitFrame && window.EduitFrame.prefs;
  if (!prefs) return;
  prefs.use();
  var engine = CFG.ownRuby ? null : kyozaiRuby(document, CFG.words, CFG.skip);

  function sync() {
    var bs = document.querySelectorAll("header [data-ef-pref], .display-toggles [data-ef-pref]");
    for (var i = 0; i < bs.length; i++) bs[i].setAttribute("data-kz-driven", "");
    // 教材の表示の切りかえが、ぜんぶ教材集のボタンにまとまったら、その場所ごとかくす
    var groups = document.querySelectorAll(".display-toggles");
    for (var g = 0; g < groups.length; g++) {
      var all = groups[g].querySelectorAll("button");
      var n = groups[g].querySelectorAll("button[data-kz-driven]").length;
      groups[g].toggleAttribute("data-kz-empty", all.length > 0 && n === all.length);
    }
  }
  function ruby() {
    if (engine && document.body) engine.set(prefs.get("ruby"), document.body);
  }
  prefs.on(function (key) {
    if (key === "ruby") ruby();
  });

  // 教材が上のバーを書きかえたら(ボタンが出てきたら)印を付け直す
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
    }).observe(document.body, { childList: true, subtree: true });
    sync();
    ruby();
  }
  if (document.body) watch();
  else document.addEventListener("DOMContentLoaded", watch);
})();
