// ハッシュ化体験ラボ: 画面
(function () {
  'use strict';
  var D = HashData, HL = HashLab;
  var APP = 'ハッシュ化体験ラボ';

  if (window.EDUIT_INFO) {
    EDUIT_INFO.app = EDUIT_INFO.app || { name: APP };
    EDUIT_INFO.app.safety = [
      'ハッシュ化体験ラボのハッシュ値は、このブラウザの中だけで計算します。入力した文はどこにも送らず、保存もしません(ふりかえりの文と組・番号・名前だけを、この端末の中に保存します)。',
      '会員表・ユーザー名・パスワード・お知らせの文は、すべて説明用に作った架空のものです。本物のパスワードは入力しないでください。'
    ];
  }

  // ---- 端末の中だけの保存(使えなくても動く) ----
  var KEY = 'eduit-hash-lab';
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { saved = {}; }
  function save(k, v) {
    saved[k] = v;
    try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) { /* 保存できなくても続ける */ }
  }

  // ---- 小さな部品 ----
  function h(tag, props) {
    var e = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'on') Object.keys(v).forEach(function (ev) { e.addEventListener(ev, v[ev]); });
      else if (k === 'style') e.setAttribute('style', v);
      else if (k in e && typeof v !== 'string') e[k] = v;
      else e.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) append(e, arguments[i]);
    return e;
  }
  function append(e, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(e, x); }); return; }
    e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  // ふりがな: 表示したあとの画面の文字に、RUBY の言葉があれば <ruby> を付ける(長い言葉が先)
  var RUBY = {
    '関数': 'かんすう', '性質': 'せいしつ', '衝突': 'しょうとつ', '一方向': 'いちほうこう', '総当': 'そうあ', '暗証番号': 'あんしょうばんごう',
    '改ざん': 'かいざん', '辞書': 'じしょ', '会員': 'かいいん', '保存': 'ほぞん', '記録': 'きろく', '端末': 'たんまつ', '入力': 'にゅうりょく',
    '体験': 'たいけん', '番号': 'ばんごう', '計算': 'けいさん', '進数': 'しんすう', '照合': 'しょうごう', '推測': 'すいそく', '記号': 'きごう',
    '英小文字': 'えいこもじ', '英大文字': 'えいおおもじ', '提出': 'ていしゅつ', '架空': 'かくう', '校外学習': 'こうがいがくしゅう', '効果': 'こうか',
    '指紋': 'しもん', '登録': 'とうろく', '正解': 'せいかい', '授業': 'じゅぎょう', '公式': 'こうしき', '流出': 'りゅうしゅつ', '情報': 'じょうほう',
    '文字': 'もじ', '余り': 'あまり', '種類': 'しゅるい', '値': 'あたい', '利用者': 'りようしゃ', '確認': 'かくにん', '配布': 'はいふ',
    '組': 'くみ', '安全': 'あんぜん', '設定': 'せってい', '画面': 'がめん', '表示': 'ひょうじ', '比': 'くら', '偽': 'にせ', '本物': 'ほんもの'
  };
  var RUBY_KEYS = Object.keys(RUBY).filter(function (k) { return k.length > 1 || k === '値'; }).sort(function (a, b) { return b.length - a.length; });
  var RUBY_RE = new RegExp(RUBY_KEYS.join('|'), 'g');
  function applyRuby(root) {
    if (!saved.furigana) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode;
        if (!p || p.closest('ruby, textarea, select, option, script, style, .no-ruby, .hex, .ef-footer')) return NodeFilter.FILTER_REJECT;
        RUBY_RE.lastIndex = 0;
        return RUBY_RE.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (n) {
      var text = n.nodeValue, frag = document.createDocumentFragment(), last = 0, m;
      RUBY_RE.lastIndex = 0;
      while ((m = RUBY_RE.exec(text))) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        frag.appendChild(h('ruby', null, m[0], h('rt', { text: RUBY[m[0]] })));
        last = m.index + m[0].length;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      n.parentNode.replaceChild(frag, n);
    });
  }
  function btn(label, onClick, cls) { return h('button', { type: 'button', class: cls || 'ef-btn', on: { click: onClick } }, label); }
  function point(title) {
    var kids = Array.prototype.slice.call(arguments, 1);
    return h('div', { class: 'point explain' }, h('p', { class: 'point-title explain-label', text: title }), kids);
  }
  function card(title) {
    var kids = Array.prototype.slice.call(arguments, 1);
    return h('section', { class: 'panel card' }, title ? h('h2', { class: 'panel-title' }, title) : null, kids);
  }
  function segmented(options, value, onChange, label) {
    return h('div', { class: 'seg', role: 'group', 'aria-label': label },
      options.map(function (o) {
        return h('button', { type: 'button', class: 'ef-btn', 'aria-pressed': String(o[0] === value),
          on: { click: function () { onChange(o[0]); } } }, o[1]);
      }));
  }
  function bar(p, cls) {
    return h('span', { class: 'bar ' + (cls || '') }, h('span', { class: 'bar-fill', style: 'width:' + Math.max(0, Math.min(100, p * 100)).toFixed(1) + '%' }));
  }
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- ハッシュ値の見せ方 ----
  // 16進数64文字を8文字ずつに区切る。other があれば、ちがう文字に印を付ける
  function hexView(hex, other, label) {
    var groups = [];
    for (var i = 0; i < hex.length; i += 8) {
      var g = h('span', { class: 'hex-g' });
      for (var k = i; k < i + 8; k++) {
        var diff = other && other[k] !== hex[k];
        g.appendChild(diff ? h('mark', { text: hex[k] }) : document.createTextNode(hex[k]));
      }
      groups.push(g);
    }
    return h('code', { class: 'hex', 'aria-label': (label || 'ハッシュ値') + ' ' + hex }, groups);
  }
  // ハッシュ値の「色の模様」: 2文字(1バイト)ずつ色にする(8×4のます)。ちがいが目で見て分かるように
  function pattern(hex, small) {
    var cells = [];
    for (var i = 0; i < 64; i += 2) {
      var b = parseInt(hex.substr(i, 2), 16);
      cells.push(h('span', { style: 'background:hsl(' + Math.round(b / 256 * 360) + ',70%,' + (42 + (b % 4) * 9) + '%)' }));
    }
    return h('span', { class: 'pattern' + (small ? ' small' : ''), role: 'img', 'aria-label': 'ハッシュ値を色にした模様' }, cells);
  }
  function shortHex(hex) { return hex.slice(0, 16) + '…'; }

  // ---- チャレンジ(各ステップの課題。できたら ✓) ----
  var MISSIONS = [
    { id: 'hash', step: 'make', title: '短い文と長い文(30文字以上)をふくめて、ちがう文を3つ以上ハッシュ化する' },
    { id: 'avalanche', step: 'avalanche', title: '文Bを1文字だけ変えて、ハッシュ値がどれだけ変わるか調べる' },
    { id: 'collision', step: 'toy', title: '手作りハッシュで、ちがう文なのに同じハッシュ値になる2つの文を見つける' },
    { id: 'crack', step: 'oneway', title: 'ハッシュ値から、元の3けたの暗証番号を見つける' },
    { id: 'leak', step: 'password', title: 'もれた会員表から、同じパスワードを使っている2人を見つける' },
    { id: 'tamper', step: 'tamper', title: '配られた3つのファイルが、本物か書きかえられたものかを見分ける' }
  ];
  function missionOf(step) { return MISSIONS.filter(function (m) { return m.step === step; })[0]; }
  function cleared(id) { return !!(saved.missions || {})[id]; }
  function clear(id) {
    if (cleared(id)) return false;
    var m = saved.missions || {};
    m[id] = { at: new Date().toISOString() };
    save('missions', m);
    toast('チャレンジ達成！');
    return true;
  }
  function missionBox(step, extra) {
    var m = missionOf(step);
    var done = cleared(m.id);
    return h('div', { class: 'mission' + (done ? ' is-done' : '') },
      h('p', { class: 'mission-label' }, h('span', { class: 'badge ' + (done ? 'ok' : 'gray'), text: done ? '✓ 達成' : 'チャレンジ' }), m.title),
      extra || null);
  }

  // ---- ページ ----
  var timers = [];
  function clearTimers() { timers.forEach(clearInterval); timers = []; }

  var SECTIONS = [
    { id: 'intro', group: '', no: '', icon: '⌂', title: 'はじめに', render: renderIntro },
    { id: 'make', group: 'ハッシュ関数の性質', no: '1', min: '10分', title: 'ハッシュ値を作ってみよう', desc: '文をハッシュ関数に入れて、出てくるハッシュ値を観察する', render: renderMake },
    { id: 'avalanche', group: 'ハッシュ関数の性質', no: '2', min: '10分', title: '1文字だけ変えると？', desc: '少しだけちがう2つの文のハッシュ値をくらべる(なだれ効果)', render: renderAvalanche },
    { id: 'toy', group: 'ハッシュ関数の性質', no: '3', min: '10分', title: '手作りハッシュの弱点', desc: 'かんたんなハッシュ関数を作り、同じ値になる組(衝突)をさがす', render: renderToy },
    { id: 'oneway', group: 'ハッシュ関数の性質', no: '4', min: '15分', title: 'もとにもどせる？', desc: 'ハッシュ値から暗証番号を当てる。総当たりにかかる時間を調べる', render: renderOneway },
    { id: 'password', group: 'くらしの中のハッシュ', no: '5', min: '15分', title: 'パスワードの守り方', desc: 'サイトはパスワードをどう保存する？ もれたときに何が起きる？', render: renderPassword },
    { id: 'tamper', group: 'くらしの中のハッシュ', no: '6', min: '10分', title: '改ざんを見つける', desc: 'ハッシュ値をくらべて、書きかえられたファイルを見分ける', render: renderTamper },
    { id: 'quiz', group: 'まとめ', no: '7', min: '10分', title: 'クイズとふりかえり', desc: 'クイズで体験をふりかえり、考えたことを書く', render: renderQuiz },
    { id: 'records', group: '記録する', no: '', icon: '✎', title: 'ふりかえり・記録', render: renderRecordsPage }
  ];
  // 画面に出す番号は丸数字(label)。no は並びの番号(ステップかどうかの印にも使う)
  SECTIONS.forEach(function (x) { x.label = x.no ? '①②③④⑤⑥⑦⑧⑨'.charAt(Number(x.no) - 1) : ''; });
  var STEP_SECTIONS = SECTIONS.filter(function (x) { return x.no; });
  var view = document.getElementById('view');
  var nav = document.getElementById('nav');
  var current = null;

  // 左のメニュー(ほかの情報の教材と同じ形: 番号の丸・まとまりの見出し・やったら ✓)
  function buildNav() {
    var ol = h('ol');
    var group = null;
    SECTIONS.forEach(function (s) {
      if (s.group !== group) {
        group = s.group;
        if (group) ol.appendChild(h('li', { class: 'nav-group', 'aria-hidden': 'true', text: group }));
      }
      ol.appendChild(h('li', { 'data-li': s.id }, h('a', { href: '#' + s.id, class: 'nav-link', 'data-id': s.id },
        h('span', { class: 'num', 'aria-hidden': 'true', text: s.no || s.icon }),
        h('span', null, s.title, s.no ? h('span', { class: 'visually-hidden nav-done', hidden: true, text: '(やった)' }) : null))));
    });
    nav.textContent = '';
    nav.appendChild(h('nav', { 'aria-label': 'ステップ' }, ol));
  }
  // 上のバーの「進み具合」: ステップのうち、ひらいたステップの割合
  function renderOverall() {
    var visited = saved.visited || {};
    var done = STEP_SECTIONS.filter(function (x) { return visited[x.id]; }).length;
    var p = Math.round(done / STEP_SECTIONS.length * 100);
    var el = document.getElementById('overall-progress');
    if (!el) return;
    el.textContent = '';
    append(el, [h('span', { text: '進み具合' }),
      h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(p), 'aria-label': '全体の進み具合' },
        h('span', { class: 'bar-fill', style: 'width:' + p + '%' })),
      h('span', { text: p + '%' })]);
  }

  // 同じページの中の操作(ボタンなど)では、スクロールの位置とキーボードの位置を保ったまま描き直す。
  // ちがうページへ移るときだけ、いちばん上から見せる。
  function focusables() { return Array.prototype.slice.call(view.querySelectorAll('button, input, select, textarea, a[href]')); }
  function go(id) {
    if (current && id === current.id) { rerender(); return; }
    show(id);
  }
  function rerender() {
    var y = window.scrollY;
    var active = document.activeElement;
    var fi = focusables().indexOf(active);
    var activeId = active && active.id;
    draw(current);
    window.scrollTo(0, y);
    var el = activeId ? document.getElementById(activeId) : null;
    if (!el && fi >= 0) {
      // 押したボタンが使えなくなったとき(答えたあとなど)は、そのつぎの使える所へ
      var list = focusables();
      for (var i = Math.min(fi, list.length - 1); i < list.length && !el; i++) if (!list[i].disabled) el = list[i];
    }
    if (el && (activeId || fi >= 0)) try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  }
  function show(id) {
    var s = SECTIONS.filter(function (x) { return x.id === id; })[0] || SECTIONS[0];
    clearTimers();
    current = s;
    draw(s);
    save('last', s.id);
    if (s.no) save('lastStep', s.id);
    var visited = saved.visited || {};
    visited[s.id] = true;
    save('visited', visited);
    markNav();
    window.scrollTo(0, 0);
    document.title = (s.id === 'intro' ? 'はじめに' : s.title) + ' | ' + APP;
  }
  function markNav() {
    var visited = saved.visited || {};
    Array.prototype.forEach.call(nav.querySelectorAll('.nav-link'), function (a) {
      var id = a.getAttribute('data-id');
      var sec = SECTIONS.filter(function (x) { return x.id === id; })[0];
      var done = !!(sec && sec.no && visited[id]);
      a.classList.toggle('is-visited', done);
      a.parentNode.classList.toggle('done', done);
      a.querySelector('.num').textContent = done ? '✓' : (sec.no || sec.icon);
      var hid = a.querySelector('.nav-done');
      if (hid) hid.hidden = !done;
    });
    renderOverall();
  }
  function draw(s) {
    Array.prototype.forEach.call(nav.querySelectorAll('.nav-link'), function (a) {
      if (a.getAttribute('data-id') === s.id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    view.textContent = '';
    var idx = SECTIONS.indexOf(s);
    if (s.no) {
      view.appendChild(h('header', { class: 'module-head sec-head' },
        h('p', { class: 'meta', text: s.group + '・ステップ' + s.label + '・目安 ' + s.min }),
        h('h1', { class: 'sec-title', text: s.title })));
    }
    var body = h('div', { class: 'sec-body' });
    view.appendChild(body);
    s.render(body);
    var prev = SECTIONS[idx - 1];
    var next = SECTIONS[idx + 1];
    if (s.id !== 'intro') {
      view.appendChild(h('nav', { class: 'pager btn-row', 'aria-label': 'ページの移動' },
        prev ? h('a', { class: 'ef-btn', href: '#' + prev.id }, prev.no ? '← 前のステップ' : '← ' + prev.title) : null,
        next ? h('a', { class: 'ef-btn-primary', href: '#' + next.id }, '次へ：' + next.title + ' →') : null));
    }
    applyRuby(view);
    persist();
  }
  function route() {
    var id = (location.hash || '').replace('#', '');
    if (!id) id = saved.last || 'intro';
    show(id);
  }

  // ================= はじめに =================
  function renderIntro(el) {
    var visited = saved.visited || {};
    var last = SECTIONS.filter(function (x) { return x.no && x.id === saved.lastStep; })[0];
    var sample = HL.sha256('こんにちは');
    append(el, [
      h('div', { class: 'module-head' },
        h('h1', { class: 'sec-title', text: APP }),
        h('p', { class: 'meta' }, 'ハッシュ関数は、どんなデータからも決まった長さの「ハッシュ値」を作る計算です。ハッシュ値は「データの指紋」のようなもので、パスワードを守ったり、書きかえ(改ざん)を見つけたりするのに使われています。自分で動かして、そのしくみを確かめよう。'),
        h('p', { class: 'muted author', text: '作成：技術 岡田' })),
      h('section', { class: 'card' },
        h('h2', { text: 'ハッシュ化とは' }),
        h('div', { class: 'flow', role: 'img', 'aria-label': '文をハッシュ関数に入れると、ハッシュ値が出てくる' },
          h('div', { class: 'flow-box' }, h('b', { text: '元のデータ' }), h('span', { text: 'こんにちは' })),
          h('span', { class: 'flow-arrow', 'aria-hidden': 'true', text: '→' }),
          h('div', { class: 'flow-box accent' }, h('b', { text: 'ハッシュ関数' }), h('span', { text: 'SHA-256 という計算で、データをまぜあわせる' })),
          h('span', { class: 'flow-arrow', 'aria-hidden': 'true', text: '→' }),
          h('div', { class: 'flow-box' }, h('b', { text: 'ハッシュ値' }), h('span', { class: 'hex-mini no-ruby', text: shortHex(sample) }))),
        h('p', { text: 'データをハッシュ関数に通して、ハッシュ値に変えることを「ハッシュ化」といいます。このラボでは、ハッシュ関数の4つの性質を体験したあと、くらしの中でどう役に立っているかを確かめます。' }),
        point('安心して体験できます',
          h('p', { text: 'このラボはすべてこのブラウザの中だけで動き、インターネットには一切つながりません。入力した文はどこにも送りません。出てくる会員表・ユーザー名・パスワードはすべて架空のものです。本物のパスワードは入力しないでください。' }))),
      h('section', { class: 'card' },
        h('h2', { text: 'すすめ方' }),
        h('ol', null,
          h('li', { text: '①〜④でハッシュ関数の性質を体験する(各ステップの「チャレンジ」に取り組もう)' }),
          h('li', { text: '⑤・⑥でパスワードの保存と、改ざんの見つけ方を体験する' }),
          h('li', { text: '⑦でクイズとふりかえりを書く' }),
          h('li', null, h('a', { href: '#records', text: 'ふりかえり・記録' }), 'からファイルを書き出して提出する')),
        h('div', { class: 'lesson-plan' },
          h('h3', { text: '授業で行うときの例' }),
          h('ul', null,
            h('li', null, h('strong', { text: '1時間目' }), '「はじめに・① ハッシュ値を作る・② 1文字だけ変える・③ 手作りハッシュ・④ もとにもどせる？」'),
            h('li', null, h('strong', { text: '2時間目' }), '「⑤ パスワードの守り方・⑥ 改ざんを見つける・⑦ クイズとふりかえり」'),
            h('li', null, h('strong', { text: '1時間で行うとき' }), 'は、①・②・④・⑤・⑦ を中心にする')),
          h('p', { class: 'muted', text: '次の人に端末をわたすときは、「ふりかえり・記録」のいちばん下の「はじめからやり直す」で、この端末の記録を消せます。' }))),
      h('section', { class: 'module-group' },
        h('h2', { text: 'ステップ' }),
        h('div', { class: 'module-grid' }, STEP_SECTIONS.map(function (x) {
          var m = missionOf(x.id);
          var state = m && cleared(m.id) ? '✓ チャレンジ達成' : visited[x.id] ? '✓ やった' : 'まだ';
          return h('a', { class: 'module-card', href: '#' + x.id },
            h('span', { class: 'mc-num', text: x.group + '・ステップ' + x.label + '・目安 ' + x.min }),
            h('span', { class: 'mc-title', text: x.title }),
            h('span', { class: 'mc-desc', text: x.desc }),
            h('span', { class: 'mc-state' + (visited[x.id] ? ' is-done' : ''), text: state }));
        }))),
      h('div', { class: 'btn-row home-start' },
        h('a', { class: 'ef-btn-primary', href: '#make', text: 'ステップ① ハッシュ値を作ってみようからはじめよう →' }),
        last && last.id !== 'make' ? h('a', { class: 'ef-btn', href: '#' + last.id, text: 'つづきから：' + last.title + ' →' }) : null),
      h('details', { class: 'teacher' },
        h('summary', { text: '先生へ' }),
        h('ul', null,
          h('li', { text: '学習指導要領の D「情報の技術」(1) 情報のデジタル化・情報セキュリティのしくみ、および (4) 情報モラル・安全な利用 にかかわる内容です。' }),
          h('li', { text: 'ハッシュ値の計算は本物の SHA-256 です(ブラウザの中で計算。外部の機能は使いません)。同じ文を他の SHA-256 の計算ツールに入れると同じ値になります(文字は UTF-8 で数えます)。' }),
          h('li', { text: '「手作りハッシュ」は、文字コードの合計を100でわった余りです。衝突(ちがう文で同じ値)が起きやすいことを体験させ、本物のハッシュ関数との差に気づかせるための模型です。' }),
          h('li', { text: '総当たりの時間は「1秒に100億回ためせるコンピュータ」として計算した目安です。実際の速さは機械やハッシュ関数の種類で変わります(パスワード保存には、わざと計算をおそくした専用の方式が使われます)。' }),
          h('li', { text: '暗号化(かぎで元にもどせる)と、ハッシュ化(元にもどせない)のちがいにふれると、情報セキュリティ体験ラボやネットワーク通信シミュレータの暗号化の学習とつながります。' }),
          h('li', { text: '進み具合・チャレンジ・ふりかえり・名前などは、この端末のブラウザの中にだけ保存されます。「ふりかえり・記録」から JSON・CSV で書き出せ、JSON は「振り返り一覧(先生用)」で読みこめます。ふりがな・文字の大きさの設定は「はじめからやり直す」でも残ります。' })))
    ]);
  }

  // ================= 1 ハッシュ値を作ってみよう =================
  var s1 = { text: 'こんにちは', hist: [] };
  function addHist(text) {
    s1.hist = s1.hist.filter(function (x) { return x !== text; });
    s1.hist.unshift(text);
    if (s1.hist.length > 10) s1.hist.length = 10;
    var ok = s1.hist.length >= 3 && s1.hist.some(function (x) { return Array.from(x).length >= 30; }) && s1.hist.some(function (x) { return Array.from(x).length <= 10; });
    if (ok) clear('hash');
  }
  function renderMake(el) {
    var ta = h('textarea', { id: 'make-input', class: 'input', rows: 2, maxlength: '400', 'aria-label': 'ハッシュ化する文' });
    ta.value = s1.text;
    ta.addEventListener('input', function () { s1.text = ta.value; });
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); run(); } });
    function run() { addHist(s1.text); go('make'); }
    var latest = s1.hist.length ? s1.hist[0] : null;
    var hx = latest != null ? HL.sha256(latest) : null;
    append(el, [
      h('p', { class: 'lead', text: '文を入れて「ハッシュ化する」をおそう。出てくるハッシュ値は、0〜9 と a〜f の16種類の文字(16進数)でできています。' }),
      missionBox('make'),
      card('ハッシュ関数(SHA-256)に入れる',
        h('label', { class: 'ctl-label', for: 'make-input', text: '入れる文(本物のパスワードや個人情報は入れない)' }),
        ta,
        h('div', { class: 'btn-row' },
          btn('ハッシュ化する', run, 'ef-btn-primary'),
          h('span', { class: 'muted', text: 'ためしてみる:' }),
          D.presets.map(function (p) {
            var label = Array.from(p).length > 12 ? Array.from(p).slice(0, 10).join('') + '…(長い文)' : p;
            return btn(label, function () { s1.text = p; addHist(p); go('make'); }, 'ef-btn small');
          })),
        hx ? h('div', { class: 'hash-out' },
          h('p', { class: 'small-title' }, '「', h('span', { class: 'quote', text: Array.from(latest).length > 30 ? Array.from(latest).slice(0, 30).join('') + '…' : latest }), '」のハッシュ値'),
          hexView(hx),
          h('div', { class: 'row' }, pattern(hx), h('span', { class: 'muted', text: '元の文: ' + Array.from(latest).length + '文字 → ハッシュ値: ' + hx.length + '文字(256ビット)' })))
          : h('p', { class: 'muted', text: 'まだハッシュ化していません。' })),
      s1.hist.length ? card('これまでにハッシュ化した文',
        h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
          h('thead', null, h('tr', null, h('th', { text: '元の文' }), h('th', { text: '文字数' }), h('th', { text: 'ハッシュ値(はじめの16文字)' }), h('th', { text: '長さ' }))),
          h('tbody', null, s1.hist.map(function (t) {
            var x = HL.sha256(t);
            return h('tr', null,
              h('td', { class: 'cut', text: Array.from(t).length > 24 ? Array.from(t).slice(0, 24).join('') + '…' : (t || '(からっぽ)') }),
              h('td', { class: 'num', text: Array.from(t).length }),
              h('td', null, h('code', { class: 'hex small', text: shortHex(x) })),
              h('td', { class: 'num', text: x.length + '文字' }));
          })))),
        h('p', { class: 'muted', text: '同じ文をもう一度ハッシュ化しても、同じ行にまとまります(同じ文 → いつも同じハッシュ値)。' })) : null,
      point('わかったこと',
        h('ul', null,
          h('li', null, h('strong', { text: '同じ文からは、いつも同じハッシュ値' }), 'が出る(どのコンピュータで計算しても同じ)'),
          h('li', null, h('strong', { text: '文の長さに関係なく、ハッシュ値の長さはいつも同じ' }), '(SHA-256 は 16進数で64文字 = 256ビット)'),
          h('li', null, '「Hello」と「hello」のように、大文字・小文字がちがうだけでもハッシュ値はまったくちがう')),
        h('p', { text: '人の指紋がその人だけのものであるように、ハッシュ値はデータの「指紋」として使われます。' }))
    ]);
  }

  // ================= 2 1文字だけ変えると？ =================
  var s2 = { a: D.pairStart[0], b: D.pairStart[0] };
  function renderAvalanche(el) {
    var ha = HL.sha256(s2.a), hb = HL.sha256(s2.b);
    var dc = HL.diffChars(ha, hb), db = HL.diffBits(ha, hb);
    var out = h('div', { class: 'pair-out', 'aria-live': 'polite' });
    function inp(id, key) {
      var i = h('input', { id: id, type: 'text', class: 'input', maxlength: '200' });
      i.value = s2[key];
      i.addEventListener('input', function () {
        s2[key] = i.value;
        if (HL.oneCharApart(s2.a, s2.b)) { if (clear('avalanche')) { rerender(); return; } }
        fill();
      });
      return i;
    }
    function fill() {
      ha = HL.sha256(s2.a); hb = HL.sha256(s2.b);
      dc = HL.diffChars(ha, hb); db = HL.diffBits(ha, hb);
      out.textContent = '';
      append(out, [
        h('div', { class: 'pair-row' }, h('span', { class: 'badge gray', text: 'Aのハッシュ値' }), hexView(ha, null, 'Aのハッシュ値'), pattern(ha, true)),
        h('div', { class: 'pair-row' }, h('span', { class: 'badge gray', text: 'Bのハッシュ値' }), hexView(hb, ha, 'Bのハッシュ値'), pattern(hb, true)),
        s2.a === s2.b
          ? h('div', { class: 'result info', text: 'AとBは同じ文なので、ハッシュ値もまったく同じです。Bを1文字だけ変えてみよう(「8時」を「9時」にする など)。' })
          : h('div', { class: 'result ' + (HL.oneCharApart(s2.a, s2.b) ? 'ok' : 'info') },
            h('p', null, 'ちがう文字: ', h('b', { text: '64文字中 ' + dc + '文字' }), '(黄色の所)　ちがうビット: ', h('b', { text: '256ビット中 ' + db + 'ビット(' + Math.round(db / 256 * 100) + '%)' })),
            h('div', { class: 'diff-bar' }, bar(db / 256), h('span', { class: 'muted', text: '半分(50%)くらいが変わるのがふつう' })),
            HL.oneCharApart(s2.a, s2.b) ? h('p', { text: '元の文は1文字しかちがわないのに、ハッシュ値は全体が変わりました。' }) : h('p', { class: 'muted', text: 'チャレンジは「1文字だけ」変えることです。' }))
      ]);
      applyRuby(out);
    }
    append(el, [
      h('p', { class: 'lead', text: '文Aと文Bのハッシュ値をくらべます。はじめは同じ文です。Bを少しだけ変えると、ハッシュ値はどれくらい変わるでしょうか。予想してからためそう。' }),
      missionBox('avalanche'),
      card('2つの文をくらべる',
        h('div', { class: 'field-row' },
          h('div', { class: 'field' }, h('label', { for: 'av-a', text: '文A' }), inp('av-a', 'a')),
          h('div', { class: 'field' }, h('label', { for: 'av-b', text: '文B(ここを変える)' }), inp('av-b', 'b'))),
        h('div', { class: 'btn-row' }, btn('BをAと同じにもどす', function () { s2.b = s2.a; go('avalanche'); }, 'ef-btn small')),
        out),
      point('なだれ効果',
        h('p', { text: '元のデータがほんの少しちがうだけで、ハッシュ値は全体がばらばらに変わります。雪山の小さな雪のかたまりが大きななだれになるようすにたとえて「なだれ効果」といいます。' }),
        h('p', { text: 'だから、ハッシュ値が似ているかどうかを見ても、元の文が似ているかは分かりません。また、たった1文字の書きかえでも、ハッシュ値をくらべればすぐに見つかります(ステップ6)。' }))
    ]);
    fill();
  }

  // ================= 3 手作りハッシュの弱点 =================
  var s3 = { a: D.toyStart[0], b: D.toyStart[1] };
  function toyCalc(text) {
    var parts = HL.toyParts(text);
    var sum = HL.toySum(text);
    return h('div', { class: 'toy-calc' },
      parts.length ? h('div', { class: 'toy-chars' }, parts.slice(0, 12).map(function (p) {
        return h('span', { class: 'toy-ch' }, h('b', { text: p.ch === ' ' ? '␣' : p.ch }), h('small', { text: p.code }));
      }), parts.length > 12 ? h('span', { class: 'muted', text: '…' }) : null) : h('p', { class: 'muted', text: '(文を入れてください)' }),
      h('p', { class: 'toy-sum' }, '番号の合計 ', h('b', { text: sum.toLocaleString('ja-JP') }), ' ÷ 100 の余り → ハッシュ値 ', h('b', { class: 'toy-val', text: HL.toyHash(text) })));
  }
  function renderToy(el) {
    var out = h('div', { 'aria-live': 'polite' });
    function inp(id, key) {
      var i = h('input', { id: id, type: 'text', class: 'input', maxlength: '40' });
      i.value = s3[key];
      i.addEventListener('input', function () {
        s3[key] = i.value;
        if (s3.a && s3.b && s3.a !== s3.b && HL.toyHash(s3.a) === HL.toyHash(s3.b)) { if (clear('collision')) { rerender(); return; } }
        fill();
      });
      return i;
    }
    function fill() {
      var same = s3.a !== s3.b && HL.toyHash(s3.a) === HL.toyHash(s3.b);
      var ha = HL.sha256(s3.a), hb = HL.sha256(s3.b);
      out.textContent = '';
      append(out, [
        h('div', { class: 'two' },
          h('div', { class: 'toy-box' }, h('p', { class: 'small-title', text: '文A' }), toyCalc(s3.a)),
          h('div', { class: 'toy-box' }, h('p', { class: 'small-title', text: '文B' }), toyCalc(s3.b))),
        s3.a === s3.b ? h('div', { class: 'result info', text: 'AとBが同じ文です。ちがう文で、同じハッシュ値になる組をさがそう。' })
          : same ? h('div', { class: 'result ng' },
            h('p', { text: '衝突！ ちがう文なのに、手作りハッシュの値が同じ「' + HL.toyHash(s3.a) + '」になりました。' }),
            h('p', { text: 'これでは、ハッシュ値が同じでも「同じデータ」とは言えません。' }))
            : h('div', { class: 'result info', text: '手作りハッシュの値はちがいます(' + HL.toyHash(s3.a) + ' と ' + HL.toyHash(s3.b) + ')。同じになる組をさがそう。' }),
        h('div', { class: 'compare-real' },
          h('p', { class: 'small-title', text: '同じ2つの文を、本物のハッシュ関数(SHA-256)に入れると' }),
          h('div', { class: 'pair-row' }, h('span', { class: 'badge gray', text: 'A' }), hexView(ha, null, 'AのSHA-256')),
          h('div', { class: 'pair-row' }, h('span', { class: 'badge gray', text: 'B' }), hexView(hb, ha, 'BのSHA-256')),
          h('p', { class: 'muted', text: s3.a === s3.b ? '同じ文なので同じ値です。' : '本物のハッシュ関数では、ちがう値になります。' }))
      ]);
      applyRuby(out);
    }
    append(el, [
      h('p', { class: 'lead', text: 'ハッシュ関数を自分でも作ってみます。「手作りハッシュ」は、文字の番号(文字コード)をすべてたして、100でわった余りをハッシュ値にします。' }),
      missionBox('toy', h('p', { class: 'muted', text: 'ヒント: 同じ文字を使って、順番だけを入れかえると？' })),
      card('手作りハッシュ',
        h('div', { class: 'field-row' },
          h('div', { class: 'field' }, h('label', { for: 'toy-a', text: '文A' }), inp('toy-a', 'a')),
          h('div', { class: 'field' }, h('label', { for: 'toy-b', text: '文B' }), inp('toy-b', 'b'))),
        out),
      point('本物のハッシュ関数との差',
        h('ul', null,
          h('li', null, '手作りハッシュの値は ', h('b', { text: '00〜99 の100通り' }), 'しかない。101個の文があれば、必ずどこかで同じ値(衝突)が出る'),
          h('li', null, '文字の順番を変えても合計は同じなので、衝突がかんたんに作れてしまう'),
          h('li', null, '本物の SHA-256 の値は ', h('b', { text: '2の256乗(約1.2×10の77乗)通り' }), '。文字の順番や位置もこまかくまぜあわせるので、衝突する2つの文を見つけることは、今のコンピュータでは事実上できない')),
        h('p', { text: 'よいハッシュ関数は「同じ値になる組を、わざと作れない」ように作られています。' }))
    ]);
    fill();
  }

  // ================= 4 もとにもどせる？ =================
  function newPin() { return ('00' + Math.floor(Math.random() * 1000)).slice(-3); }
  var s4 = { pin: '', guess: '', tries: [], running: false, scan: 0, found: '', by: '', kinds: 'num', len: 4 };
  function renderOneway(el) {
    if (!s4.pin) s4.pin = newPin();
    var target = HL.sha256(s4.pin);
    var gi = h('input', { id: 'pin-guess', type: 'text', inputmode: 'numeric', class: 'input pin', maxlength: '3', autocomplete: 'off', 'aria-label': '3けたの番号' });
    gi.value = s4.guess;
    gi.addEventListener('input', function () { s4.guess = gi.value.replace(/[^0-9０-９]/g, ''); });
    gi.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); tryGuess(); } });
    function tryGuess() {
      var g = (s4.guess || '').replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xfee0); });
      if (!/^\d{3}$/.test(g) || s4.found) return;
      s4.tries.unshift(g);
      if (g === s4.pin) { s4.found = g; s4.by = 'あなた'; clear('crack'); }
      s4.guess = '';
      go('oneway');
    }
    var live = h('div', { class: 'scan', 'aria-live': 'off' });
    function scanView() {
      live.textContent = '';
      var n = s4.scan;
      var cur = ('00' + Math.max(0, n - 1)).slice(-3);
      append(live, [
        h('p', null, 'ためした数: ', h('b', { class: 'scan-n', text: n + ' / 1000' })),
        bar(n / 1000),
        n ? h('p', { class: 'scan-now' }, h('span', { text: cur + ' → ' }), h('code', { class: 'hex small', text: shortHex(HL.sha256(cur)) })) : null
      ]);
    }
    function brute() {
      if (s4.running || s4.found) return;
      s4.running = true;
      s4.scan = 0;
      var t0 = Date.now();
      var per = reduceMotion ? 1000 : 9;
      go('oneway');
      var id = setInterval(function () {
        for (var k = 0; k < per && !s4.found; k++) {
          var c = ('00' + s4.scan).slice(-3);
          s4.scan++;
          if (HL.sha256(c) === target) { s4.found = c; s4.by = 'コンピュータ'; }
        }
        scanView();
        if (s4.found || s4.scan >= 1000) {
          clearInterval(id);
          s4.running = false;
          s4.ms = Date.now() - t0;
          clear('crack');
          rerender();
        }
      }, 16);
      timers.push(id);
    }
    function again() { s4.pin = newPin(); s4.tries = []; s4.found = ''; s4.by = ''; s4.scan = 0; s4.guess = ''; go('oneway'); }
    scanView();

    var kinds = D.charKinds.filter(function (k) { return k.id === s4.kinds; })[0] || D.charKinds[0];
    var total = HL.combos(kinds.n, s4.len);
    var lenIn = h('input', { id: 'len', type: 'range', min: '1', max: '16', value: String(s4.len), 'aria-label': 'パスワードの長さ' });
    lenIn.addEventListener('input', function () { s4.len = Number(lenIn.value); go('oneway'); });

    append(el, [
      h('p', { class: 'lead', text: 'ハッシュ値から元のデータを計算でもどせるでしょうか。ある人の3けたの暗証番号(000〜999)を、ハッシュ値だけを手がかりに当ててみよう。' }),
      missionBox('oneway'),
      card('暗証番号を当てる',
        h('p', null, '暗証番号のハッシュ値:'),
        hexView(target, null, '暗証番号のハッシュ値'),
        s4.found ? h('div', { class: 'result ok' },
          h('p', { text: '見つかりました！ 暗証番号は「' + s4.found + '」。' + (s4.by === 'コンピュータ' ? 'コンピュータが ' + s4.scan + '回ためして見つけました(およそ ' + Math.max(1, s4.ms || 0) + 'ミリ秒)。' : 'あなたが ' + s4.tries.length + '回目で当てました。') }),
          h('p', { text: 'ハッシュ値をもとにもどす計算をしたのではなく、「000」から順番にハッシュ化して、同じハッシュ値になるものをさがしただけです(総当たり)。' }),
          btn('別の暗証番号でもう一度', again, 'ef-btn small')) : null,
        !s4.found ? h('div', { class: 'two' },
          h('div', { class: 'try-box' },
            h('p', { class: 'small-title', text: '① 自分で予想する' }),
            h('div', { class: 'row' }, gi, btn('ハッシュ化してくらべる', tryGuess, 'ef-btn-primary')),
            s4.tries.length ? h('ul', { class: 'try-list' }, s4.tries.slice(0, 6).map(function (g) {
              return h('li', null, h('b', { text: g }), ' → ', h('code', { class: 'hex small', text: shortHex(HL.sha256(g)) }), h('span', { class: 'ng-text', text: ' ちがう' }));
            })) : null,
            s4.tries.length ? h('p', { class: 'muted', text: s4.tries.length + '回ためしました。ハッシュ値が「近い」かどうかもヒントになりません。' }) : null),
          h('div', { class: 'try-box' },
            h('p', { class: 'small-title', text: '② コンピュータに総当たりさせる' }),
            h('p', { class: 'muted', text: '000, 001, 002 … と順番にハッシュ化して、同じハッシュ値をさがします。' }),
            btn(s4.running ? 'さがしています…' : '総当たりをはじめる', brute, 'ef-btn-primary'),
            s4.running || s4.scan ? live : null)) : null),
      card('パスワードが長いと？',
        h('p', { text: '総当たりで全部ためすのにかかる時間は、文字の種類と長さで決まります。1秒に100億回ためせるコンピュータ(例)で計算してみよう。自分のパスワードは入れずに、種類と長さだけをえらびます。' }),
        h('div', { class: 'controls' },
          h('div', { class: 'ctl' }, h('span', { class: 'ctl-label', text: '使う文字の種類' }),
            segmented(D.charKinds.map(function (k) { return [k.id, k.label]; }), s4.kinds, function (v) { s4.kinds = v; go('oneway'); }, '使う文字の種類')),
          h('div', { class: 'ctl' }, h('label', { class: 'ctl-label', for: 'len', text: '長さ(文字数)' }),
            h('div', { class: 'range' }, lenIn, h('output', { for: 'len', text: s4.len + '文字' })))),
        h('div', { class: 'stat-row' },
          h('div', { class: 'stat' }, h('span', { text: 'ありうる組み合わせ' }), h('b', { text: HL.bigNumber(total) + '通り' }), h('small', { class: 'muted', text: kinds.n + 'の' + s4.len + '乗' })),
          h('div', { class: 'stat' + (total / D.triesPerSec > 3600 * 24 * 365 * 100 ? ' good' : total / D.triesPerSec < 3600 * 24 ? ' bad' : '') },
            h('span', { text: '全部ためすのにかかる時間(最大)' }), h('b', { text: HL.duration(total / D.triesPerSec) }))),
        h('table', { class: 'data compact' },
          h('thead', null, h('tr', null, h('th', { text: '例' }), h('th', { text: '組み合わせ' }), h('th', { text: '時間(最大)' }))),
          h('tbody', null, [['数字4けた', 10, 4], ['英小文字8文字', 26, 8], ['英大文字・小文字+数字 8文字', 62, 8], ['英大文字・小文字+数字+記号 12文字', 94, 12]].map(function (r) {
            var c = HL.combos(r[1], r[2]);
            return h('tr', null, h('td', { text: r[0] }), h('td', { class: 'num', text: HL.bigNumber(c) }), h('td', { class: 'num', text: HL.duration(c / D.triesPerSec) }));
          })))),
      point('一方向性(もとにもどせない)',
        h('p', { text: 'ハッシュ関数は、ハッシュ値から元のデータを計算でもどせない「一方向」の計算です。元を知るには、ありうるものを片っぱしから試す(総当たり)しかありません。' }),
        h('p', { text: '3けたの番号のように組み合わせが少ないと、総当たりですぐ見つかります。長く、いろいろな種類の文字を使ったパスワードほど、見つけるのに時間がかかります。' }))
    ]);
  }

  // ================= 5 パスワードの守り方 =================
  var s5 = { login: '', loginRes: null, picked: [], dict: false, salt: false };
  var userHash = {};
  function hashOf(u, salt) {
    var k = u.id + (salt ? ':s' : '');
    if (!userHash[k]) userHash[k] = HL.sha256((salt ? u.salt : '') + u.password);
    return userHash[k];
  }
  function renderPassword(el) {
    var demo = D.loginDemo;
    var stored = HL.sha256(demo.password);
    var li = h('input', { id: 'login-pass', type: 'text', class: 'input', maxlength: '40', autocomplete: 'off', 'aria-label': 'パスワード(練習用)' });
    li.value = s5.login;
    li.addEventListener('input', function () { s5.login = li.value; });
    li.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); login(); } });
    function login() { s5.loginRes = HL.sha256(s5.login); go('password'); }

    var dictHash = {};
    D.dictionary.forEach(function (w) { dictHash[HL.sha256(w)] = w; });
    var pickedOk = s5.picked.length === 2 && hashOf(D.users.filter(function (u) { return u.id === s5.picked[0]; })[0], false) === hashOf(D.users.filter(function (u) { return u.id === s5.picked[1]; })[0], false);
    function pick(id) {
      if (s5.salt) return;
      var i = s5.picked.indexOf(id);
      if (i >= 0) s5.picked.splice(i, 1);
      else { s5.picked.push(id); if (s5.picked.length > 2) s5.picked.shift(); }
      if (s5.picked.length === 2) {
        var a = D.users.filter(function (u) { return u.id === s5.picked[0]; })[0], b = D.users.filter(function (u) { return u.id === s5.picked[1]; })[0];
        if (hashOf(a, false) === hashOf(b, false)) clear('leak');
      }
      go('password');
    }
    var cracked = D.users.filter(function (u) { return dictHash[hashOf(u, s5.salt)]; }).length;

    append(el, [
      h('p', { class: 'lead', text: 'ログインのあるサイトは、みんなのパスワードをどのように保存しているのでしょうか。架空のサイト「みなみ図書ネット」で確かめよう。' }),
      card('① サイトはパスワードを「ハッシュ値」で保存する',
        h('p', null, '練習用のアカウント ', h('b', { class: 'no-ruby', text: demo.user }), ' のパスワードは ', h('b', { class: 'no-ruby', text: demo.password }), ' です。サイトの会員表には、パスワードそのものではなく、ハッシュ値だけが保存されています。'),
        h('div', { class: 'db-row' }, h('span', { class: 'badge gray', text: '会員表に保存されている値' }), hexView(stored, null, '保存されているハッシュ値')),
        h('div', { class: 'row' }, h('label', { for: 'login-pass', class: 'ctl-label', text: 'パスワード(練習用)' }), li, btn('ログイン', login, 'ef-btn-primary')),
        s5.loginRes ? h('div', { class: 'login-res' },
          h('div', { class: 'db-row' }, h('span', { class: 'badge gray', text: '入れたパスワードのハッシュ値' }), hexView(s5.loginRes, stored, '入れたパスワードのハッシュ値')),
          s5.loginRes === stored ? h('div', { class: 'result ok', text: 'ハッシュ値が一致したので、ログインできました。サイトは、パスワードそのものを知らなくても、正しいかどうかを確かめられます。' })
            : h('div', { class: 'result ng', text: 'ハッシュ値が一致しないので、ログインできません。(わざとまちがえたり、正しく入れたりしてくらべよう)' })) : null),
      missionBox('password'),
      card('② 会員表がもれてしまった！',
        h('p', { text: '不正アクセスで、会員表が外にもれてしまいました。パスワードはハッシュ化されているので、そのままでは見えません。でも、表をよく見ると…' }),
        h('div', { class: 'btn-row' },
          btn(s5.salt ? 'ソルトを外す(ハッシュ化だけ)' : 'ソルトを付けて保存する', function () { s5.salt = !s5.salt; go('password'); }, 'ef-btn' + (s5.salt ? ' is-on' : '')),
          !s5.dict ? btn('だます人の「よく使われるパスワード辞書」とくらべる', function () { s5.dict = true; go('password'); }, 'ef-btn-primary')
            : btn('辞書とくらべるのをやめる', function () { s5.dict = false; go('password'); })),
        h('div', { class: 'table-wrap' }, h('table', { class: 'data users' },
          h('thead', null, h('tr', null, h('th', { text: 'ユーザー名' }), s5.salt ? h('th', { text: 'ソルト' }) : null, h('th', { text: '保存されているハッシュ値' }), s5.dict ? h('th', { text: '辞書とくらべると' }) : null)),
          h('tbody', null, D.users.map(function (u) {
            var hx = hashOf(u, s5.salt);
            var on = s5.picked.indexOf(u.id) >= 0;
            var hit = s5.dict && dictHash[hx];
            return h('tr', { class: (on && !s5.salt ? 'is-picked' : '') + (hit ? ' is-cracked' : '') },
              h('td', null, s5.salt ? h('b', { class: 'no-ruby', text: u.id })
                : h('button', { type: 'button', class: 'user-btn', 'aria-pressed': String(on), on: { click: function () { pick(u.id); } } }, u.id)),
              s5.salt ? h('td', null, h('code', { class: 'hex small', text: u.salt })) : null,
              h('td', null, h('code', { class: 'hex small', text: hx.slice(0, 24) + '…' })),
              s5.dict ? h('td', null, hit ? h('span', { class: 'ng-text', text: 'もとのパスワードが見つかった: ' + hit }) : h('span', { class: 'ok-text', text: '見つからない' })) : null);
          })))),
        !s5.salt ? h('p', { class: 'muted', text: '同じハッシュ値の2人をえらぼう(ユーザー名をおす)。' }) : null,
        pickedOk && !s5.salt ? h('div', { class: 'result warn', text: s5.picked.join(' と ') + ' は、ハッシュ値がまったく同じです。つまり、同じパスワードを使っています。どちらか1人のパスワードが分かれば、もう1人のパスワードも分かってしまいます。' })
          : s5.picked.length === 2 && !s5.salt ? h('div', { class: 'result info', text: 'この2人のハッシュ値はちがいます。もう一度さがそう。' }) : null,
        s5.dict ? h('div', { class: 'result ' + (cracked ? 'ng' : 'ok') },
          h('p', { text: s5.salt
            ? 'ソルトを付けると、だます人が前もって作った辞書のハッシュ値とは1つも一致しません(' + cracked + '人)。同じパスワードの2人も、ハッシュ値がちがって見えます。'
            : '5人のうち ' + cracked + '人のパスワードが分かってしまいました。よく使われるパスワードは、前もってハッシュ値を計算した「辞書」とくらべるだけで見つかります。' }),
          s5.salt ? h('p', { text: 'ただし、だます人がソルトを使って1人ずつ辞書を計算し直せば、弱いパスワードはやはり見つかります。いちばん大事なのは、推測されにくい長いパスワードにすることです。' }) : null) : null),
      point('パスワードを守るために',
        h('ul', null,
          h('li', null, h('b', { text: 'サービスを作る側: ' }), 'パスワードはそのまま保存せず、ソルトを付けてハッシュ化して保存する(計算に時間がかかる専用のハッシュ関数を使う)'),
          h('li', null, h('b', { text: '使う人(自分): ' }), '「123456」や名前・誕生日など推測されやすいものは使わない。長く、いろいろな文字をまぜる。サービスごとにちがうパスワードにする(1つもれても、ほかが守られる)')))
    ]);
  }

  // ================= 6 改ざんを見つける =================
  var s6 = { calc: {}, judge: {}, edit: null };
  var officialHash = HL.sha256(D.original);
  function copyText(c) { return c.text == null ? D.original : c.text; }
  function renderTamper(el) {
    if (s6.edit == null) s6.edit = D.original;
    function judge(id, v) {
      s6.judge[id] = v;
      var all = D.copies.every(function (c) { return s6.judge[c.id] === (HL.sha256(copyText(c)) === officialHash ? 'ok' : 'ng'); });
      if (all) clear('tamper');
      go('tamper');
    }
    var ed = h('textarea', { id: 'tamper-edit', class: 'input', rows: 5, 'aria-label': '自分で書きかえる文' });
    ed.value = s6.edit;
    var edOut = h('div', { 'aria-live': 'polite' });
    function edFill() {
      var x = HL.sha256(s6.edit);
      edOut.textContent = '';
      append(edOut, [
        h('div', { class: 'db-row' }, h('span', { class: 'badge gray', text: '今の文のハッシュ値' }), hexView(x, officialHash, '今の文のハッシュ値')),
        x === officialHash ? h('div', { class: 'result ok', text: '公式のハッシュ値と一致: 書きかえられていません。' })
          : h('div', { class: 'result ng', text: '公式のハッシュ値と一致しません: どこかが書きかえられています(空白1つ・改行1つでも見つかります)。' })
      ]);
      applyRuby(edOut);
    }
    ed.addEventListener('input', function () { s6.edit = ed.value; edFill(); });
    edFill();
    var judgedAll = D.copies.every(function (c) { return s6.judge[c.id]; });
    append(el, [
      h('p', { class: 'lead', text: '学校から「校外学習のお知らせ」のファイルが配られました。でも、いろいろな所からコピーが出回っています。どれが本物か、ハッシュ値で確かめよう。' }),
      missionBox('tamper'),
      card('学校のホームページにのっている、公式のハッシュ値',
        hexView(officialHash, null, '公式のハッシュ値'),
        h('p', { class: 'muted', text: '本物のファイルをハッシュ化すると、この値になります。' })),
      h('div', { class: 'copies' }, D.copies.map(function (c) {
        var text = copyText(c);
        var x = HL.sha256(text);
        var shown = s6.calc[c.id];
        var j = s6.judge[c.id];
        var right = x === officialHash ? 'ok' : 'ng';
        return h('section', { class: 'card copy' },
          h('h2', { class: 'panel-title', text: 'ファイル ' + c.id }),
          h('p', { class: 'muted', text: c.route }),
          h('pre', { class: 'doc', text: text }),
          shown ? h('div', null, h('p', { class: 'small-title', text: 'このファイルのハッシュ値' }), hexView(x, officialHash, 'ファイル' + c.id + 'のハッシュ値'))
            : btn('ハッシュ値を計算する', function () { s6.calc[c.id] = true; go('tamper'); }, 'ef-btn-primary'),
          shown ? h('div', { class: 'judge' },
            h('span', { class: 'ctl-label', text: '判定:' }),
            h('button', { type: 'button', class: 'ef-btn', 'aria-pressed': String(j === 'ok'), on: { click: function () { judge(c.id, 'ok'); } } }, '本物'),
            h('button', { type: 'button', class: 'ef-btn', 'aria-pressed': String(j === 'ng'), on: { click: function () { judge(c.id, 'ng'); } } }, '書きかえられている')) : null,
          j ? h('p', { class: 'judge-res ' + (j === right ? 'ok' : 'ng'), text: j === right ? (right === 'ok' ? '○ 正しい判定。公式のハッシュ値と一致しています。' : '○ 正しい判定。ハッシュ値が一致しません。文をよく見て、どこが変わっているかさがそう。') : '× もう一度、公式のハッシュ値とくらべよう(黄色の文字が、ちがう所)。' }) : null);
      })),
      judgedAll && cleared('tamper') ? h('div', { class: 'result ok', text: 'B は集合時刻(7時30分 → 8時30分)、C は日にち(20日 → 21日)が書きかえられていました。たった1文字のちがいでも、ハッシュ値をくらべればすぐに分かります。' }) : null,
      card('自分で書きかえてみよう',
        h('p', { text: '本物のお知らせの文です。1文字だけ変えたり、空白を足したりして、ハッシュ値がどうなるか見よう。もとにもどすと、また一致します。' }),
        ed,
        h('div', { class: 'btn-row' }, btn('本物の文にもどす', function () { s6.edit = D.original; go('tamper'); }, 'ef-btn small')),
        edOut),
      point('ハッシュ値で改ざんを見つける',
        h('p', { text: 'アプリやソフトウェアを配るサイトでは、ファイルといっしょにハッシュ値をのせていることがあります。ダウンロードしたファイルのハッシュ値が同じなら、とちゅうで書きかえられていない(ウイルスなどを入れられていない)と分かります。' }),
        h('p', { text: 'ほかにも、ブロックチェーン(暗号資産などの記録)や、電子署名、同じファイルをさがす機能など、ハッシュ値は社会のいろいろな所で使われています。' }))
    ]);
  }

  // ================= 7 クイズとふりかえり =================
  var qs = { ans: {} };
  function renderQuiz(el) {
    var score = D.quiz.filter(function (q, i) { return qs.ans[i] === q.c; }).length;
    var answered = Object.keys(qs.ans).length;
    el.appendChild(h('p', { class: 'lead', text: 'ここまでの体験をふりかえるクイズです。' }));
    D.quiz.forEach(function (q, i) {
      var a = qs.ans[i];
      el.appendChild(card('Q' + (i + 1) + '　' + q.q,
        h('div', { class: 'quiz-opts' }, q.a.map(function (t, k) {
          var cls = 'choice' + (a != null ? (k === q.c ? ' right' : k === a ? ' wrong' : '') : '');
          return h('button', { type: 'button', class: cls, disabled: a != null, on: { click: function () { qs.ans[i] = k; go('quiz'); } } }, t);
        })),
        a != null ? h('div', { class: 'result ' + (a === q.c ? 'ok' : 'info'), text: (a === q.c ? '○ 正解。' : '× 正解は「' + q.a[q.c] + '」。') + q.why }) : null));
    });
    if (answered === D.quiz.length) {
      el.appendChild(h('div', { class: 'result ok' }, h('b', { text: D.quiz.length + '問中 ' + score + '問 正解' })));
      el.appendChild(h('div', { class: 'btn-row' }, btn('クイズをやり直す', function () { qs.ans = {}; go('quiz'); })));
    }

    var refl = saved.refl || {};
    var status = h('p', { class: 'muted', 'aria-live': 'polite', text: '書いた内容は、この端末のブラウザの中だけに保存されます。' });
    el.appendChild(card('ふりかえり', D.reflQ.map(function (r) {
      var ta = h('textarea', { id: 'refl-' + r.id, class: 'input', rows: 3, maxlength: '800' });
      ta.value = refl[r.id] || '';
      ta.addEventListener('input', function () { refl[r.id] = ta.value; save('refl', refl); status.textContent = '保存しました(この端末の中だけ)。'; });
      return h('label', { class: 'refl' }, h('span', { class: 'ctl-label', text: r.label }), ta);
    }), status));

    el.appendChild(h('p', { class: 'hint' }, '書きおわったら、', h('a', { href: '#records', text: 'ふりかえり・記録' }), 'でファイルに書き出して先生に出そう。'));
  }

  // ---- 記録の書き出し(端末の中でファイルを作るだけ。送信はしない) ----
  function buildRecord() {
    var st = saved.student || {};
    var visited = saved.visited || {};
    var refl = saved.refl || {};
    var ms = saved.missions || {};
    return {
      app: APP,
      exportedAt: new Date().toISOString(),
      student: { cls: st.cls || '', num: st.num || '', name: st.name || '' },
      steps: STEP_SECTIONS.map(function (x) { return { no: x.label, title: x.title, opened: !!visited[x.id] }; }),
      challenges: MISSIONS.map(function (m) {
        var sec = SECTIONS.filter(function (x) { return x.id === m.step; })[0];
        return { id: m.id, no: sec.label, title: m.title, cleared: !!ms[m.id], at: (ms[m.id] || {}).at || '' };
      }),
      quiz: { answered: Object.keys(qs.ans).length, correct: D.quiz.filter(function (q, i) { return qs.ans[i] === q.c; }).length, total: D.quiz.length },
      reflection: { r1: refl.r1 || '', r2: refl.r2 || '', r3: refl.r3 || '' }
    };
  }
  function recordCsv(r) {
    var cell = function (v) {
      var s = String(v == null ? '' : v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;  // 数式として動かないように
      return '"' + s.replace(/"/g, '""') + '"';
    };
    var head = ['組', '番号', '名前', 'ひらいたステップ', 'チャレンジ達成'].concat(r.challenges.map(function (c) { return 'チャレンジ' + c.no; }))
      .concat(['クイズ正解', 'ふりかえり1', 'ふりかえり2', 'ふりかえり3']);
    var row = [r.student.cls, r.student.num, r.student.name,
      r.steps.filter(function (x) { return x.opened; }).length + ' / ' + r.steps.length,
      r.challenges.filter(function (c) { return c.cleared; }).length + ' / ' + r.challenges.length]
      .concat(r.challenges.map(function (c) { return c.cleared ? '達成' : 'まだ'; }))
      .concat([r.quiz.correct + ' / ' + r.quiz.total, r.reflection.r1, r.reflection.r2, r.reflection.r3]);
    return '﻿' + head.map(cell).join(',') + '\r\n' + row.map(cell).join(',');
  }
  function renderRecordsPage(el) {
    var st = saved.student || {};
    var note = h('p', { class: 'export-note', role: 'status', 'aria-live': 'polite' });
    function field(id, label, key, size) {
      var inp = h('input', { id: id, type: 'text', class: 'input', maxlength: '40', size: size });
      inp.value = st[key] || '';
      inp.addEventListener('input', function () { st[key] = inp.value.trim(); save('student', st); });
      return h('div', { class: 'field' }, h('label', { for: id, text: label }), inp);
    }
    function fileName(ext) {
      var who = [st.cls, st.num, st.name].filter(Boolean).join('_') || '記録';
      return (APP + '_' + who + '.' + ext).replace(/[\\/:*?"<>|\s]/g, '_');
    }
    function ready() {
      if (!String(st.cls || '').trim() || !String(st.num || '').trim()) {
        note.className = 'export-note warn';
        note.textContent = '組と番号を入れてから書き出そう';
        document.getElementById(String(st.cls || '').trim() ? 'rec-num' : 'rec-cls').focus();
        return false;
      }
      return true;
    }
    function download(ext) {
      if (!ready()) return;
      var r = buildRecord();
      var text = ext === 'json' ? JSON.stringify(r, null, 2) : recordCsv(r);
      var name = fileName(ext);
      try {
        var url = URL.createObjectURL(new Blob([text], { type: ext === 'json' ? 'application/json' : 'text/csv' }));
        var a = h('a', { href: url, download: name });
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
        note.className = 'export-note good';
        note.textContent = 'ファイルを保存しました(ファイル名: ' + name + ')。先生に言われた場所に出そう。ファイルができないときは「記録をコピーする」を使います。';
      } catch (e) {
        note.className = 'export-note warn';
        note.textContent = 'ファイルを作れませんでした。「記録をコピーする」を使ってください。';
      }
    }
    function copy() {
      if (!ready()) return;
      var r = buildRecord();
      var text = [r.app, '組: ' + r.student.cls + '　番号: ' + r.student.num + '　名前: ' + r.student.name,
        'チャレンジ: ' + r.challenges.filter(function (c) { return c.cleared; }).length + ' / ' + r.challenges.length + ' 達成',
        'クイズ: ' + r.quiz.correct + ' / ' + r.quiz.total + ' 問正解',
        'ふりかえり1: ' + r.reflection.r1, 'ふりかえり2: ' + r.reflection.r2, 'ふりかえり3: ' + r.reflection.r3].join('\n');
      var done = function () { note.className = 'export-note good'; note.textContent = 'コピーしました。先生に言われた場所(Classroom など)にはりつけよう。'; };
      var fallback = function () {
        var ta = h('textarea', { class: 'input', rows: 6, readonly: true });
        ta.value = text;
        note.textContent = 'コピーできなかったので、下の文を全部えらんでコピーしてください。';
        note.className = 'export-note warn';
        note.appendChild(ta);
        ta.select();
      };
      try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
    }
    var visited = saved.visited || {};
    var r = buildRecord();
    var refl = saved.refl || {};
    append(el, [
      h('div', { class: 'module-head' },
        h('h1', { class: 'sec-title', text: 'ふりかえり・記録' }),
        h('p', { class: 'meta', text: '進み具合・チャレンジ・ふりかえりは、この端末のブラウザの中にだけ保存されています。提出するときは、ファイルに書き出してください。' })),
      card('名前',
        h('p', { class: 'muted', text: '名前は、先生の指示がないときは入れなくてかまいません。' }),
        h('div', { class: 'field-row' }, field('rec-cls', '組', 'cls', 4), field('rec-num', '番号', 'num', 4), field('rec-name', '名前(なくてもよい)', 'name', 12))),
      card('進み具合とふりかえり',
        h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
          h('thead', null, h('tr', null, h('th', { text: 'ステップ' }), h('th', { text: 'ひらいた' }), h('th', { text: 'チャレンジ・記録' }))),
          h('tbody', null, STEP_SECTIONS.map(function (x) {
            var m = missionOf(x.id);
            var rec = m ? (cleared(m.id) ? '✓ 達成' : 'まだ') : (r.quiz.answered ? 'クイズ ' + r.quiz.correct + ' / ' + r.quiz.total + ' 問正解' : '');
            return h('tr', null, h('td', { text: x.label + ' ' + x.title }), h('td', { text: visited[x.id] ? '✓' : '' }), h('td', { text: rec }));
          })))),
        h('ul', { class: 'refl-list' }, D.reflQ.map(function (q, i) {
          return h('li', null, h('b', { text: 'ふりかえり' + (i + 1) + '(' + q.short + '): ' }), refl[q.id] ? h('span', { text: refl[q.id] }) : h('span', { class: 'muted', text: '(まだ書いていません)' }));
        })),
        h('p', { class: 'muted' }, 'ふりかえりは「', h('a', { href: '#quiz', text: '⑦ クイズとふりかえり' }), '」で書きます。')),
      card('書き出す',
        h('p', null, h('strong', { text: '先生に出すのは JSON のファイルです。' }), 'CSV は、表計算ソフトで見るときに使います。ファイルができないときは「記録をコピーする」を使います。'),
        h('div', { class: 'btn-row' },
          btn('記録を書き出す(JSON・提出用)', function () { download('json'); }, 'ef-btn-primary'),
          btn('CSVで書き出す(表計算用)', function () { download('csv'); }),
          btn('記録をコピーする', copy)),
        note,
        point('書き出す中身', h('p', { text: '組・番号・名前、ひらいたステップ、チャレンジとクイズの結果、ふりかえりの文章だけです。ハッシュ化した文などは入りません。' }))),
      renderReset()
    ]);
  }

  // ---- はじめからやり直す(データリセット) ----
  // 確認は画面の中で行う(ブラウザの確認ダイアログが出ない環境でも使えるように)。
  // ふりがな・文字の大きさは表示の設定なので消さない(ほかの情報の教材と同じ)。
  var resetAsk = false;
  var resetMsg = '';
  function renderReset() {
    var box = card('はじめからやり直す',
      h('p', { text: '次の人に端末をわたすときや、最初からやり直したいときに使います。この端末に保存した組・番号・名前、進み具合、チャレンジ、ふりかえり、クイズの答えなどを、すべて消します。ふりがな・文字の大きさの設定は残ります。' }));
    box.id = 'reset';
    box.classList.add('reset-card');
    if (!resetAsk) {
      box.appendChild(h('div', { class: 'btn-row' }, btn('この端末の記録をすべて消す', function () { resetAsk = true; resetMsg = ''; go(current.id); }, 'ef-btn reset-btn')));
    } else {
      box.appendChild(h('div', { class: 'reset-confirm', role: 'alert' },
        h('p', null, h('strong', { text: '本当に消しますか？' }), '消した記録は元にもどせません。提出がまだなら、先に「書き出す」でファイルにしておこう。'),
        h('div', { class: 'btn-row' },
          btn('消す(はじめからやり直す)', function () { resetAll(); }, 'ef-btn-primary danger'),
          btn('やめる', function () { resetAsk = false; go(current.id); }))));
    }
    if (resetMsg) box.appendChild(h('p', { class: 'export-note good', role: 'status', text: resetMsg }));
    return box;
  }
  function resetAll() {
    clearTimers();
    var keep = { furigana: saved.furigana, big: saved.big };
    saved = {};
    try { localStorage.removeItem(KEY); } catch (e) { /* 保存できない環境でも続ける */ }
    if (keep.furigana) save('furigana', true);
    if (keep.big) save('big', true);
    var init = JSON.parse(INITIAL);
    [[s1, 's1'], [s2, 's2'], [s3, 's3'], [s4, 's4'], [s5, 's5'], [s6, 's6'], [qs, 'qs']].forEach(function (o) {
      Object.keys(o[0]).forEach(function (k) { delete o[0][k]; });
      Object.assign(o[0], init[o[1]]);
    });
    resetAsk = false;
    resetMsg = '記録をすべて消しました。はじめから使えます。';
    current = null;
    show('records');
    resetMsg = '';
    markNav();
    toast('記録を消しました');
    var b = document.querySelector('.reset-btn');
    if (b) try { b.focus({ preventScroll: true }); } catch (e) { b.focus(); }
    var r = document.getElementById('reset');
    if (r) r.scrollIntoView({ block: 'center' });
  }
  function toast(msg) {
    var t = document.querySelector('.toast') || document.body.appendChild(h('div', { class: 'toast', role: 'status' }));
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { t.classList.remove('show'); }, 2500);
  }

  // ---- 表示の切りかえ(ふりがな・大きな文字) ----
  function setupToggles() {
    var tools = document.getElementById('display-toggles');
    [['furigana', 'ふりがな', 'show-ruby'], ['big', '大きな文字', 'big-text']].forEach(function (t) {
      var on = !!saved[t[0]];
      document.documentElement.classList.toggle(t[2], on);
      var b = h('button', { type: 'button', class: 'toggle ef-btn', 'aria-pressed': String(on) }, t[1]);
      b.addEventListener('click', function () {
        on = !on;
        save(t[0], on);
        b.setAttribute('aria-pressed', String(on));
        document.documentElement.classList.toggle(t[2], on);
        if (t[0] === 'furigana' && current) rerender();
      });
      tools.appendChild(b);
    });
  }

  // 体験の途中のようす(入れた文・クイズの答えなど)も、この端末の中に残す(読みこみ直しても消えない)
  function persist() {
    save('state', {
      s1: { text: s1.text, hist: s1.hist }, s2: { a: s2.a, b: s2.b }, s3: { a: s3.a, b: s3.b },
      s4: { kinds: s4.kinds, len: s4.len }, s5: { salt: s5.salt, dict: s5.dict, picked: s5.picked },
      s6: { calc: s6.calc, judge: s6.judge }, quiz: qs.ans
    });
  }
  var INITIAL = JSON.stringify({ s1: s1, s2: s2, s3: s3, s4: s4, s5: s5, s6: s6, qs: qs });
  (function restore() {
    var st = saved.state;
    if (!st) return;
    try {
      if (st.s1) { s1.text = String(st.s1.text || ''); s1.hist = Array.isArray(st.s1.hist) ? st.s1.hist.map(String).slice(0, 10) : []; }
      if (st.s2) { s2.a = String(st.s2.a || ''); s2.b = String(st.s2.b || ''); }
      if (st.s3) { s3.a = String(st.s3.a || ''); s3.b = String(st.s3.b || ''); }
      if (st.s4) {
        if (D.charKinds.some(function (k) { return k.id === st.s4.kinds; })) s4.kinds = st.s4.kinds;
        if (st.s4.len >= 1 && st.s4.len <= 16) s4.len = st.s4.len;
      }
      if (st.s5) { s5.salt = !!st.s5.salt; s5.dict = !!st.s5.dict; s5.picked = Array.isArray(st.s5.picked) ? st.s5.picked.slice(0, 2) : []; }
      if (st.s6) { s6.calc = st.s6.calc || {}; s6.judge = st.s6.judge || {}; }
      if (st.quiz) qs.ans = st.quiz;
    } catch (e) { /* 読めなければ最初から */ }
  })();

  buildNav();
  setupToggles();
  window.addEventListener('hashchange', route);
  route();
})();
