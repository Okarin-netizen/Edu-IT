// 教材集の中（iframe の srcdoc）では、<a href="#/..."> を押すと、ブラウザが親のファイル（教材集）の URL へ
// 移ろうとして「開けない」画面になる。そこで、# で始まるページ内リンクは、ここで location.hash を書きかえて移る。
// 元の教材ファイルは変えず、教材集を作るときにすべての教材の末尾にこのスクリプトを足している。
(function () {
  if (window.parent === window) return;
  var PLAIN = __PLAIN__;
  window.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a || a.target || a.hasAttribute("download")) return;
    var href = a.getAttribute("href");
    if (!href || href.charAt(0) !== "#") return;
    e.preventDefault();
    if (href === "#") return;
    if (href.charAt(1) !== "/") {
      // 「本文へ移動」などのページ内の場所へのリンク
      var t = null;
      try { t = document.getElementById(decodeURIComponent(href.slice(1))); } catch (err) { /* % のまちがった書き方は、そのままにする */ }
      if (t) {
        t.scrollIntoView();
        if (t.focus) t.focus();
        return;
      }
      // 生成AI・ネット詐欺・ハッシュ化のラボは、ページを #guess のように「/」なしで切りかえる（materials.json の plainHash）
      if (!PLAIN || !/^#[\w-]+$/.test(href)) return;
    }
    if (location.hash !== href) location.hash = href;
  });
})();
