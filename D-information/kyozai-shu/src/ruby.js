// 教材集の「ふりがな」: 言葉と読みの一覧（src/ruby-words.json ＋ 情報セキュリティ体験ラボの data/ruby.json）をもとに、
// 画面の文字に <ruby> を付ける／外す。長い言葉を先にあてはめる（「暗号化」は「暗号」より先）。
// 教材集のメニューと、ふりがなのしくみを持たない5つの教材で使う（ビルドのときに足す）。
// ふりがなを付けないところ: 入力欄・選択肢・コード・図（SVG）・書きかえられる場所・プログラムを書く場所（skip で指定）。
function kyozaiRuby(doc, words, skip) {
  var keys = Object.keys(words)
    .filter(function (k) {
      return k && k.charAt(0) !== "_" && typeof words[k] === "string";
    })
    .sort(function (a, b) {
      return b.length - a.length;
    });
  if (!keys.length) return { set: function () {}, isOn: function () { return false; } };
  var source = keys
    .map(function (k) {
      return k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("|");
  var any = new RegExp(source);
  var SKIP = [
    "script", "style", "noscript", "template", "textarea", "input", "select", "option", "optgroup",
    "code", "pre", "kbd", "samp", "var", "ruby", "rt", "rp", "canvas", "math", "svg", "iframe", "title",
    '[contenteditable]:not([contenteditable="false"])', ".no-ruby", ".mono", ".cipher-text",
  ]
    .concat(skip || [])
    .join(",");
  var on = false;
  var obs = null;

  function skipped(el) {
    if (!el || el.nodeType !== 1) return true;
    if (el.closest(SKIP)) return true;
    return Boolean(el.isContentEditable);
  }

  // 1つの文字のかたまり（テキストノード）に、ふりがなを付ける
  function wrapText(node) {
    var text = node.nodeValue;
    if (!text || !any.test(text)) return;
    var rx = new RegExp(source, "g");
    var frag = doc.createDocumentFragment();
    var last = 0;
    var m;
    while ((m = rx.exec(text))) {
      if (m.index > last) frag.append(text.slice(last, m.index));
      var r = doc.createElement("ruby");
      r.className = "kz-ruby";
      r.append(m[0]);
      var rt = doc.createElement("rt");
      rt.textContent = words[m[0]];
      r.append(rt);
      frag.append(r);
      last = m.index + m[0].length;
    }
    if (last < text.length) frag.append(text.slice(last));
    node.replaceWith(frag);
  }

  function walk(root) {
    if (root.nodeType === 3) {
      if (root.parentNode && !skipped(root.parentNode)) wrapText(root);
      return;
    }
    if (root.nodeType !== 1 && root.nodeType !== 11) return;
    if (root.nodeType === 1 && skipped(root)) return;
    var tw = doc.createTreeWalker(root, 1 | 4, {
      acceptNode: function (n) {
        if (n.nodeType === 1) return n.matches(SKIP) || n.isContentEditable ? 2 : 3; // 2: 中を見ない 3: 中だけ見る
        return 1;
      },
    });
    var list = [];
    while (tw.nextNode()) list.push(tw.currentNode);
    for (var i = 0; i < list.length; i++) wrapText(list[i]);
  }

  function unwrapAll() {
    var rs = doc.querySelectorAll("ruby.kz-ruby");
    var parents = new Set();
    for (var i = 0; i < rs.length; i++) {
      var r = rs[i];
      var base = "";
      for (var c = r.firstChild; c; c = c.nextSibling) if (c.nodeType === 3) base += c.nodeValue;
      if (r.parentNode) parents.add(r.parentNode);
      r.replaceWith(base);
    }
    parents.forEach(function (p) {
      if (p.isConnected) p.normalize();
    });
  }

  function onMutations(list) {
    for (var i = 0; i < list.length; i++) {
      var added = list[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        var n = added[j];
        if (!n.isConnected || (n.nodeType === 1 && n.classList.contains("kz-ruby"))) continue;
        walk(n);
      }
    }
    // 自分で付けたふりがなの分の変化は、もう一度見ない（くり返しにならないように）
    obs.takeRecords();
  }

  function set(want, root) {
    want = Boolean(want);
    root = root || doc.body;
    if (want === on) return;
    on = want;
    if (on) {
      walk(root);
      obs = new MutationObserver(onMutations);
      obs.observe(root, { childList: true, subtree: true });
    } else {
      if (obs) obs.disconnect();
      obs = null;
      unwrapAll();
    }
  }
  return {
    set: set,
    isOn: function () {
      return on;
    },
  };
}
