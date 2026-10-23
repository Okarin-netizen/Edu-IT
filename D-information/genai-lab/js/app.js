// 生成AIのしくみラボ: 画面
(function () {
  'use strict';
  var D = GenaiData, LM = GenaiLM, IM = GenaiImg;
  // 振り返りを隠す設定(先生用。shared/eduit-frame.js)。隠すときは、③の振り返り欄・記録の振り返りを出さない
  var FK_OFF = !!(window.EduitFrame && EduitFrame.furikaeri === false);
  var T_QUIZ = FK_OFF ? 'クイズ' : 'クイズとふりかえり';
  var T_REC = FK_OFF ? '記録' : 'ふりかえり・記録';

  if (window.EDUIT_INFO) {
    EDUIT_INFO.app = EDUIT_INFO.app || { name: '生成AIのしくみラボ' };
    EDUIT_INFO.app.safety = [
      '生成AIのしくみラボの「AI」は、ブラウザの中で動く小さな模型です。本物の生成AIのサービスにはつながらず、入力した文はどこにも送りません。',
      '個人情報の体験で使う名前・学校・電話番号・住所は、すべて架空のものです。えらぶだけで、本物の情報を入力する場所はありません。'
    ];
  }

  // ---- 端末の中だけの保存(使えなくても動く) ----
  var KEY = 'eduit-genai-lab';
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { saved = {}; }
  // こわれたデータ(オブジェクトでないもの)が入っていても動くように
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
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
    '生成': 'せいせい', '学習': 'がくしゅう', '模型': 'もけい', '予想': 'よそう', '割合': 'わりあい', '拡散': 'かくさん',
    '著作権': 'ちょさくけん', '著作物': 'ちょさくぶつ', '架空': 'かくう', '司書': 'ししょ', '不正': 'ふせい', '個人情報': 'こじんじょうほう',
    '記録': 'きろく', '実在': 'じつざい', '事実': 'じじつ', '判定': 'はんてい', '候補': 'こうほ', '自然': 'しぜん', '登録': 'とうろく',
    '世界文化遺産': 'せかいぶんかいさん', '信濃川': 'しなのがわ', '琵琶湖': 'びわこ', '鳥取県': 'とっとりけん', '香川県': 'かがわけん',
    '都道府県': 'とどうふけん', '人口': 'じんこう', '千曲川': 'ちくまがわ', '有名人': 'ゆうめいじん', '許可': 'きょか', '違反': 'いはん',
    '提出': 'ていしゅつ', '端末': 'たんまつ', '保存': 'ほぞん', '番号': 'ばんごう', '計算': 'けいさん', '練習': 'れんしゅう', '段階': 'だんかい',
    '設定': 'せってい', '体験': 'たいけん', '入力': 'にゅうりょく', '情報': 'じょうほう', '文章': 'ぶんしょう', '画像': 'がぞう',
    '選択肢': 'せんたくし', '正解': 'せいかい', '授業': 'じゅぎょう', '顔写真': 'かおじゃしん', '写真': 'しゃしん', '電話番号': 'でんわばんごう',
    '住所': 'じゅうしょ', '会社': 'かいしゃ', '事故': 'じこ', '自動': 'じどう', '経過': 'けいか', '判断': 'はんだん', '辞書': 'じしょ',
    '検索': 'けんさく', '複数': 'ふくすう', '公式': 'こうしき', '図鑑': 'ずかん', '確': 'たし', '指示': 'しじ', '架': 'か', '覚': 'おぼ',
    '富士山': 'ふじさん', '沖縄県': 'おきなわけん', '北海道': 'ほっかいどう', '東京都': 'とうきょうと', '湖': 'みずうみ', '競走': 'きょうそう',
    '遺産': 'いさん', '暗号': 'あんごう', '流出': 'りゅうしゅつ', '利用': 'りよう', '組': 'くみ', '自由研究': 'じゆうけんきゅう'
  };
  var RUBY_KEYS = Object.keys(RUBY).filter(function (k) { return k.length > 1; }).sort(function (a, b) { return b.length - a.length; });
  var RUBY_RE = new RegExp(RUBY_KEYS.join('|'), 'g');
  function applyRuby(root) {
    if (!saved.furigana) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode;
        if (!p || p.closest('ruby, textarea, select, option, script, style, .no-ruby, .ids, .ef-footer')) return NodeFilter.FILTER_REJECT;
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
  function pct(x) { return Math.round(x * 100) + '%'; }
  function point(title) {
    var kids = Array.prototype.slice.call(arguments, 1);
    return h('div', { class: 'point explain' }, h('p', { class: 'point-title explain-label', text: title }), kids);
  }
  function card(title) {
    var kids = Array.prototype.slice.call(arguments, 1);
    return h('section', { class: 'panel card' }, title ? h('h2', { class: 'panel-title' }, title) : null, kids);
  }
  // 振り返りを隠す設定のとき出さない要素の印
  function reflectOnly(e) { e.setAttribute('data-ef-reflect', ''); return e; }
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
  function chips(tokens, cls) {
    return h('span', { class: 'chips ' + (cls || '') }, tokens.map(function (t, i) { return h('span', { class: 'chip c' + (i % 4), text: t }); }));
  }
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 言葉の一覧(トークン分けに使う)
  var allWords = [];
  Object.keys(D.corpora).forEach(function (k) {
    D.corpora[k].sentences.forEach(function (s) { allWords = allWords.concat(LM.splitSentence(s)); });
  });
  D.chatBase.forEach(function (s) { allWords = allWords.concat(LM.splitSentence(s)); });
  var vocab = LM.makeVocab(allWords.concat(D.extraWords).concat(D.pictureWords));

  // ---- 絵をかく ----
  var tmp = document.createElement('canvas');
  tmp.width = tmp.height = IM.SIZE;
  function paint(canvas, x) {
    var ctx = tmp.getContext('2d');
    var img = ctx.createImageData(IM.SIZE, IM.SIZE);
    img.data.set(IM.toRGBA(x));
    ctx.putImageData(img, 0, 0);
    var c = canvas.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.drawImage(tmp, 0, 0, canvas.width, canvas.height);
  }
  function pixCanvas(px, x, label) {
    var c = h('canvas', { width: px, height: px, class: 'pix', role: 'img', 'aria-label': label || '絵' });
    if (x) paint(c, x);
    return c;
  }
  var pictures = D.pictures.map(function (p) { return { id: p.id, word: p.word, label: p.label, x: IM.decode(p.rows) }; });

  // ---- ページ ----
  var timers = [];
  function clearTimers() { timers.forEach(clearInterval); timers = []; }

  var SECTIONS = [
    { id: 'intro', group: '', no: '', icon: '⌂', title: 'はじめに', render: renderIntro },
    { id: 'halluc', group: '気をつけて使う(基本)', no: '1', min: '15分', title: 'もっともらしいまちがい', desc: 'AIがすらすらとまちがえる(ハルシネーション)しくみをたしかめる', render: renderHalluc },
    { id: 'privacy', group: '気をつけて使う(基本)', no: '2', min: '15分', title: '個人情報が出てしまう？', desc: '入れた個人情報が、ほかの人への答えに出てしまうしくみを見る', render: renderPrivacy },
    { id: 'quiz', group: '気をつけて使う(基本)', no: '3', min: '10分', title: T_QUIZ, recTitle: 'クイズとふりかえり', desc: FK_OFF ? 'クイズで体験をたしかめる' : 'クイズで体験をふりかえり、考えたことを書く', render: renderQuiz },
    { id: 'guess', group: '文章をつくるAIのしくみ(発展)', no: '4', min: '10分', title: 'つぎの言葉あて', desc: '文のつづきに来る言葉を予想して、AIの予想とくらべる', render: renderGuess },
    { id: 'token', group: '文章をつくるAIのしくみ(発展)', no: '5', min: '5分', title: '言葉のかけら(トークン)', desc: 'AIが文を小さなかけらに分けて、番号にするようすを見る', render: renderToken },
    { id: 'textgen', group: '文章をつくるAIのしくみ(発展)', no: '6', min: '15分', title: 'ミニ文章AIを動かす', desc: 'つぎの言葉を1つずつえらんで文を作る、小さなAIを動かす', render: renderTextgen },
    { id: 'noise', group: '画像をつくるAIのしくみ(発展)', no: '7', min: '10分', title: 'ノイズをまぜる(学習)', desc: '絵にノイズをまぜて、AIが学習するときの問題を体験する', render: renderNoise },
    { id: 'imggen', group: '画像をつくるAIのしくみ(発展)', no: '8', min: '15分', title: 'ノイズから絵をつくる', desc: 'ノイズを少しずつ取りのぞいて、言葉から絵をつくる', render: renderImggen },
    { id: 'records', group: '記録する', no: '', icon: '✎', title: T_REC, render: renderRecordsPage }
  ];
  // 並びと番号: 基本編(①〜③)→ 発展編(④〜⑧)。no は並びの番号、画面には丸数字(label)で出す
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
  // 上のバーの「進み具合」: 8つのステップのうち、ひらいたステップの割合
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
    var fi = focusables().indexOf(document.activeElement);
    draw(current);
    window.scrollTo(0, y);
    if (fi >= 0) {
      // 押したボタンが使えなくなったとき(答えたあとなど)は、そのつぎの使える所へ
      var list = focusables();
      var el = null;
      for (var i = Math.min(fi, list.length - 1); i < list.length && !el; i++) if (!list[i].disabled) el = list[i];
      if (el) try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
    }
    if (afterDraw) { var f = afterDraw; afterDraw = null; f(); }
  }
  var afterDraw = null;
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
    document.title = (s.id === 'intro' ? 'はじめに' : s.title) + ' | 生成AIのしくみラボ';
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
    append(el, [
      h('div', { class: 'module-head' },
        h('h1', { class: 'sec-title', text: '生成AIのしくみラボ' }),
        h('p', { class: 'meta' }, '生成AIは、文章や絵などを「新しく作る」AIです。ブラウザの中で動く、小さな模型のAIを動かしてみよう。どうやって作っているのか、使うときに何に気をつけるのかを確かめよう。'),
        h('p', { class: 'muted author', text: '作成：技術 岡田' })),
      h('section', { class: 'card' },
        h('h2', { text: '生成AIが作るまでの3つの手順' }),
        h('p', { text: '文章をつくるAIも、画像をつくるAIも、次の3つの手順で作ります。どのステップでも、この手順が出てきます。' }),
        h('div', { class: 'flow', role: 'img', 'aria-label': '学習データ、学習、生成の流れ' },
          h('div', { class: 'flow-box' }, h('b', { text: '1. 学習データ' }), h('span', { text: 'たくさんの文章や絵を集める' })),
          h('span', { class: 'flow-arrow', 'aria-hidden': 'true', text: '→' }),
          h('div', { class: 'flow-box' }, h('b', { text: '2. 学習' }), h('span', { text: 'よく出てくる「きまり」を見つけて覚える' })),
          h('span', { class: 'flow-arrow', 'aria-hidden': 'true', text: '→' }),
          h('div', { class: 'flow-box' }, h('b', { text: '3. 生成' }), h('span', { text: '覚えたきまりを使って、新しく作る' }))),
        point('安心して体験できます',
          h('p', { text: 'このラボは、ブラウザの中だけで動きます。本物の生成AIにもつながらず、入力した文はどこにも送りません。出てくる名前・学校・住所などは、すべて架空です。' }))),
      h('section', { class: 'card' },
        h('h2', { text: 'すすめ方' }),
        h('ol', null,
          h('li', { text: '①でもっともらしいまちがい、②で個人情報の注意を体験し、③の' + (FK_OFF ? 'クイズに答える' : 'クイズとふりかえりを書く') + '(ここまでが基本)' }),
          h('li', { text: '発展: ④〜⑥で文章をつくるAI、⑦・⑧で画像をつくるAIのしくみを体験する' }),
          h('li', null, h('a', { href: '#records', text: T_REC }), 'からファイルを書き出して提出する')),
        h('div', { class: 'lesson-plan' },
          h('h3', { text: '2時間で行うときの例' }),
          h('ul', null,
            h('li', null, h('strong', { text: '1時間目' }), '「はじめに・① もっともらしいまちがい・② 個人情報・③ ' + T_QUIZ + '」(基本)'),
            h('li', null, h('strong', { text: '2時間目' }), '「④ つぎの言葉あて・⑤ トークン・⑥ ミニ文章AI・⑦ ノイズをまぜる・⑧ ノイズから絵をつくる」(発展)'),
            h('li', null, h('strong', { text: '発展を少しだけ行うとき' }), 'は、⑥・⑧ を中心にする')),
          h('p', { class: 'muted', text: '次の人に端末をわたすときは、「' + T_REC + '」のいちばん下の「はじめからやり直す」で、この端末の記録を消せます。' }))),
      h('section', { class: 'module-group' },
        h('h2', { text: 'ステップ' }),
        h('div', { class: 'module-grid' }, STEP_SECTIONS.map(function (x) {
          return h('a', { class: 'module-card', href: '#' + x.id },
            h('span', { class: 'mc-num', text: x.group + '・ステップ' + x.label + '・目安 ' + x.min }),
            h('span', { class: 'mc-title', text: x.title }),
            h('span', { class: 'mc-desc', text: x.desc }),
            h('span', { class: 'mc-state' + (visited[x.id] ? ' is-done' : ''), text: visited[x.id] ? '✓ やった' : 'まだ' }));
        }))),
      h('div', { class: 'btn-row home-start' },
        h('a', { class: 'ef-btn-primary', href: '#halluc', text: 'ステップ① もっともらしいまちがいからはじめよう →' }),
        last && last.id !== 'halluc' ? h('a', { class: 'ef-btn', href: '#' + last.id, text: 'つづきから：' + last.title + ' →' }) : null),
      h('details', { class: 'teacher' },
        h('summary', { text: '先生へ' }),
        h('ul', null,
          h('li', { text: 'この教材の文章AIは、前の1〜2語だけを見て続きを選ぶ「n-gram(エヌグラム)」という小さな模型です。本物の生成AIは何十億もの文から学び、ずっと長い前の文を見て予想しますが、「つぎの言葉を確率で選ぶ」という考え方は同じです。' }),
          h('li', { text: '画像AIは、拡散モデルの考え方(ノイズを少しずつ取りのぞく)を、学習した絵6枚だけでまねた模型です。学習データが少ないので、学習した絵とほぼ同じ絵が出やすく、それを「似すぎ・著作権」の話につなげられます。' }),
          h('li', { text: 'つぎの言葉あての割合は、説明のための例です。人名・学校名・住所・電話番号はすべて架空です。' }),
          h('li', { text: '進み具合・ふりかえり・名前などは、この端末のブラウザの中にだけ保存されます。「ふりかえり・記録」から JSON・CSV で書き出せます。ふりがな・文字の大きさの設定は「はじめからやり直す」でも残ります。' })))
    ]);
  }

  // ================= ④ つぎの言葉あて =================
  var guessState = { i: 0, picked: {} };
  function renderGuess(el) {
    var st = guessState;
    var item = D.guessGame[st.i];
    var PERMS = [[2, 0, 3, 1], [1, 3, 0, 2], [3, 1, 2, 0], [0, 2, 1, 3], [2, 3, 0, 1], [1, 0, 3, 2]];
    var shown = PERMS[st.i % PERMS.length];
    var picked = st.picked[st.i];
    var top = item.options[0][0];

    append(el, h('p', { class: 'lead', text: '文のつづきに来る言葉を予想してください。生成AIも、これと同じことをくり返して文を作っています。' }));
    var box = card(null,
      h('p', { class: 'muted', text: '問題 ' + (st.i + 1) + ' / ' + D.guessGame.length }),
      h('p', { class: 'big-sentence' }, item.prompt, h('span', { class: 'blank', text: picked ? picked : '？' })),
      h('div', { class: 'choices' }, shown.map(function (k) {
        var w = item.options[k][0];
        return h('button', { type: 'button', class: 'choice' + (picked === w ? ' is-picked' : ''), disabled: !!picked,
          on: { click: function () { st.picked[st.i] = w; go('guess'); } } }, w);
      })));
    el.appendChild(box);

    if (picked) {
      var sum = item.options.reduce(function (s, o) { return s + o[1]; }, 0);
      var rows = item.options.map(function (o) { return [o[0], o[1] / 100]; }).concat([['そのほかの言葉', Math.max(0, 100 - sum) / 100]]);
      box.appendChild(h('div', { class: 'result ' + (picked === top ? 'ok' : 'info') },
        picked === top ? 'AIと同じ予想です。' : 'AIなら、いちばん多い「' + top + '」をえらびやすくなります。'));
      box.appendChild(h('p', { class: 'small-title', text: 'たくさんの文章では、このあとにこう続くことが多い' }));
      box.appendChild(h('p', { class: 'note-example', text: '※ 割合は、説明のために作った例です。本物のAIが調べた数ではありません。' }));
      box.appendChild(h('table', { class: 'prob' }, h('tbody', null, rows.map(function (r) {
        return h('tr', { class: r[0] === picked ? 'is-you' : '' },
          h('th', { scope: 'row', text: r[0] + (r[0] === picked ? '(あなた)' : '') }),
          h('td', null, bar(r[1])), h('td', { class: 'num', text: pct(r[1]) }));
      }))));
      var nav2 = h('div', { class: 'row' });
      if (st.i > 0) nav2.appendChild(btn('◀ 前の問題', function () { st.i--; go('guess'); }));
      if (st.i < D.guessGame.length - 1) nav2.appendChild(btn('つぎの問題 ▶', function () { st.i++; go('guess'); }, 'ef-btn-primary'));
      box.appendChild(nav2);
    }
    var done = Object.keys(st.picked).length;
    if (done === D.guessGame.length) {
      var same = D.guessGame.filter(function (it, i) { return st.picked[i] === it.options[0][0]; }).length;
      el.appendChild(h('div', { class: 'result ok' }, 'AIと同じ予想: ' + same + ' / ' + D.guessGame.length + ' 問'));
      el.appendChild(btn('もう一度やる', function () { st.i = 0; st.picked = {}; go('guess'); }));
    }
    el.appendChild(point('ここがポイント',
      h('p', null, '生成AIは、意味がわかって書いているのではありません。たくさんの文章から「この言葉のあとに、どの言葉が何%来るか」を覚え、続きやすい言葉をえらんでいます。')));
  }

  // ================= ⑤ トークン =================
  var tokenState = { text: '今日は天気がいいので、友だちと公園でサッカーをしました。' };
  function renderToken(el) {
    append(el, h('p', { class: 'lead', text: '生成AIは、文字のままでは計算できません。文章を「トークン」という小さなかけらに分けます。1つずつ番号(数)にしてから計算します。' }));
    var out = h('div', { class: 'token-out', 'aria-live': 'polite' });
    var ta = h('textarea', { id: 'token-input', rows: 3, class: 'input', 'aria-label': 'トークンに分ける文' });
    ta.value = tokenState.text;
    function update() {
      tokenState.text = ta.value;
      var toks = LM.tokenize(ta.value, vocab);
      out.textContent = '';
      var chars = Array.from(ta.value.replace(/\s/g, '')).length;
      out.appendChild(h('p', { class: 'stats' }, '文字の数 ', h('b', { text: String(chars) }), '　→　トークンの数 ', h('b', { text: String(toks.length) })));
      out.appendChild(h('div', { class: 'tok-grid' }, toks.map(function (t, i) {
        return h('span', { class: 'tok c' + (i % 4) + (t.known ? '' : ' unknown') },
          h('span', { class: 'tok-t', text: t.text }), h('span', { class: 'tok-id', text: String(t.id) }));
      })));
      out.appendChild(h('p', { class: 'small-title', text: 'AIにわたされる数のならび' }));
      out.appendChild(h('p', { class: 'ids', text: '[ ' + toks.map(function (t) { return t.id; }).join(', ') + ' ]' }));
    }
    ta.addEventListener('input', update);
    var samples = ['今日は天気がいいので、友だちと公園でサッカーをしました。', 'むかしむかし、ある村におじいさんとおばあさんがいました。', 'I like soccer and music.', 'ぴよぴよぽんぽこりん'];
    el.appendChild(card('文を入れてみよう',
      ta,
      h('div', { class: 'row' }, h('span', { class: 'muted', text: '例:' }), samples.map(function (s) {
        return btn(s.length > 14 ? s.slice(0, 14) + '…' : s, function () { ta.value = s; update(); });
      })),
      out));
    update();
    el.appendChild(point('ここがポイント',
      h('ul', null,
        h('li', { text: 'よく出てくる言葉(「です」「学校」など)は、1つのかけらになります。下の番号がそのかけらの番号です。' }),
        h('li', { text: 'あまり出てこない言葉は、1文字ずつなど細かく分かれます(点線のかけら)。この教材では、知らないかけらに 5000 より大きい番号をつけています。' }),
        h('li', { text: '本物のAIは、どんな文字でも、さらに細かいかけらに分けて番号にできます。だから、知らない言葉でも読めます。' }),
        h('li', { text: 'AIは、この番号のならびを使って「つぎに来る番号(言葉)」を計算します。この教材の分け方は、本物のAIより簡単にしたものです。' }))));
  }

  // ================= ⑥ ミニ文章AI =================
  var tg = { corpus: 'mukashi', order: 2, temp: 1, start: '', hist: [], added: {}, made: [], running: false };
  // いろいろな文になりやすい「はじめの言葉」(そこから作れる文の数が多い上位3つ)
  function recommendedStarters(model, starts) {
    function count(hist, depth) {
      var c = LM.candidates(model, hist, tg.order);
      if (!c.list.length || depth > 14 || LM.isEnd(hist[hist.length - 1])) return 1;
      var n = 0;
      for (var i = 0; i < c.list.length && n < 60; i++) n += count(hist.concat([c.list[i].word]), depth + 1);
      return n;
    }
    return starts.map(function (w) { return { w: w, n: count([w], 1) }; })
      .sort(function (a, b) { return b.n - a.n; }).slice(0, 3).filter(function (x) { return x.n > 1; }).map(function (x) { return x.w; });
  }
  function textModel(key) {
    return LM.buildModel(D.corpora[key].sentences.concat(tg.added[key] || []));
  }
  function renderTextgen(el) {
    var model = textModel(tg.corpus);
    var ended = tg.hist.length > 0 && LM.isEnd(tg.hist[tg.hist.length - 1]);
    var cand = LM.candidates(model, tg.hist, tg.order);
    var list = LM.withTemperature(cand.list, tg.temp);

    append(el, h('p', { class: 'lead', text: '学習データの文から、「この言葉のあとに来た言葉」を数えたAIです。つぎの言葉を1つずつえらんで、文を作ってみましょう。' }));

    var corpusSel = h('select', { id: 'tg-corpus', class: 'input', on: { change: function () { clearTimers(); tg.running = false; tg.corpus = corpusSel.value; tg.hist = []; tg.start = ''; go('textgen'); } } },
      Object.keys(D.corpora).map(function (k) { return h('option', { value: k, selected: k === tg.corpus, text: D.corpora[k].name + '(' + D.corpora[k].note + ')' }); }));
    var tempIn = h('input', { id: 'tg-temp', type: 'range', min: '0.1', max: '2', step: '0.1', value: String(tg.temp), 'aria-label': 'ランダムさ' });
    var tempOut = h('output', { text: tempLabel(tg.temp) });
    tempIn.addEventListener('input', function () { tg.temp = Number(tempIn.value); tempOut.textContent = tempLabel(tg.temp); });
    tempIn.addEventListener('change', function () { go('textgen'); });
    el.appendChild(h('div', { class: 'controls' },
      h('label', { class: 'ctl' }, h('span', { class: 'ctl-label', text: '学習データ' }), corpusSel),
      h('div', { class: 'ctl' }, h('span', { class: 'ctl-label', text: '前の言葉をいくつ見る？' }),
        segmented([[1, '1語'], [2, '2語']], tg.order, function (v) { tg.order = v; go('textgen'); }, '前の言葉をいくつ見るか')),
      h('label', { class: 'ctl' }, h('span', { class: 'ctl-label', text: 'ランダムさ' }), h('span', { class: 'range' }, tempIn, tempOut))));

    var starts = LM.starters(model);
    var good = recommendedStarters(model, starts);
    var sentence = h('div', { class: 'sentence', 'aria-live': 'polite' },
      tg.hist.length ? chips(tg.hist) : h('span', { class: 'muted', text: 'まず、はじめの言葉をえらんでください。' }),
      ended ? null : h('span', { class: 'cursor', text: '？' }));
    var startRow = h('div', { class: 'start-row' }, h('p', { class: 'small-title', text: 'はじめの言葉(★はいろいろな文になりやすい言葉)' }),
      h('div', { class: 'row' }, starts.map(function (w) {
        return btn((good.indexOf(w) >= 0 ? '★ ' : '') + w, function () { tg.hist = [w]; go('textgen'); }, good.indexOf(w) >= 0 ? 'ef-btn star' : 'ef-btn');
      })),
      h('div', { class: 'row' }, btn('🎲 はじめの言葉もサイコロで', function () {
        var c0 = LM.withTemperature(LM.candidates(model, [], tg.order).list, tg.temp);
        tg.hist = [LM.pick(c0, Math.random)]; go('textgen');
      })));

    var busy = tg.running;
    var actions = h('div', { class: 'row' },
      btn('いちばん多いものをえらぶ', function () { if (!busy && list.length) { tg.hist.push(list[0].word); finishCheck(model); go('textgen'); } }, 'ef-btn'),
      btn('🎲 サイコロでえらぶ', function () { if (!busy && list.length) { tg.hist.push(LM.pick(list, Math.random)); finishCheck(model); go('textgen'); } }, 'ef-btn'),
      btn('文のおわりまで自動(1語ずつ)', function () {
        if (busy) return;
        tg.running = true;
        var t = setInterval(function () {
          var c = LM.candidates(model, tg.hist, tg.order);
          var done = !c.list.length || tg.hist.length >= 30;
          if (!done) { tg.hist.push(LM.pick(LM.withTemperature(c.list, tg.temp), Math.random)); finishCheck(model); }
          if (done || LM.isEnd(tg.hist[tg.hist.length - 1])) { clearInterval(t); tg.running = false; }
          go('textgen');
        }, reduceMotion ? 60 : 450);
        timers.push(t);
        go('textgen');
      }, 'ef-btn-primary'),
      btn('はじめから', function () { clearTimers(); tg.running = false; tg.hist = []; go('textgen'); }, 'ef-btn'));
    if (busy) Array.prototype.forEach.call(actions.querySelectorAll('button'), function (b2, i) { if (i < 3) b2.disabled = true; });

    var candBox;
    var tempRows = [];
    if (ended) {
      var isOld = LM.inData(model, tg.hist);
      candBox = h('div', { class: 'result ' + (isOld ? 'info' : 'warn') },
        isOld ? '学習データにある文と同じ文ができました。' : '学習データにない、新しい文ができました！ 言葉のつながりは学習データのとおりなのに、文としては新しい文です。');
    } else if (!tg.hist.length) {
      candBox = null;
    } else {
      var ctx = '「' + cand.context.join(' ') + '」のあと';
      candBox = h('div', null,
        h('p', { class: 'small-title' }, 'つぎの言葉の候補(' + ctx + 'に来た言葉)', cand.used && cand.used < tg.order ? h('span', { class: 'muted', text: '　※2語の組み合わせがないので1語で見ています' }) : null),
        h('p', { class: 'how' }, '学習データで出てきた回数', h('span', { class: 'arrow', text: ' → ' }), 'ランダムさをかける', h('span', { class: 'arrow', text: ' → ' }), 'えらばれる割合', h('span', { class: 'muted', text: '(ランダムさ 1.0 のときは、回数の割合と同じ)' })),
        list.length ? h('table', { class: 'prob' },
          h('thead', null, h('tr', null, h('th', { text: '言葉(おすとえらべる)' }), h('th', { class: 'num', text: '学習データで' }), h('th', { text: 'えらばれる割合' }), h('th', { class: 'num', text: '' }))),
          h('tbody', null, list.slice(0, 10).map(function (c) {
            var fill = bar(c.q);
            var pc = h('td', { class: 'num', text: pct(c.q) });
            tempRows.push({ word: c.word, fill: fill.firstChild, pc: pc });
            return h('tr', null,
              h('th', { scope: 'row' }, h('button', { type: 'button', class: 'word-btn', disabled: busy, on: { click: function () { tg.hist.push(c.word); finishCheck(model); go('textgen'); } } }, c.word)),
              h('td', { class: 'num', text: c.count + '回' }), h('td', null, fill), pc);
          }))) : h('p', { class: 'muted', text: '候補がありません。' }),
        list.length > 10 ? h('p', { class: 'muted', text: 'ほかに ' + (list.length - 10) + ' こ' }) : null);
    }
    // スライダーを動かしているあいだも、えらばれる割合を変える
    tempIn.addEventListener('input', function () {
      var q = LM.withTemperature(cand.list, tg.temp);
      tempRows.forEach(function (r) {
        var it = q.filter(function (x) { return x.word === r.word; })[0];
        if (!it) return;
        r.fill.style.width = (it.q * 100).toFixed(1) + '%';
        r.pc.textContent = pct(it.q);
      });
    });

    el.appendChild(card('文を作る', sentence, tg.hist.length ? null : startRow, tg.hist.length ? actions : null, candBox));

    if (tg.made.length) {
      el.appendChild(card('作った文',
        h('ul', { class: 'made' }, tg.made.slice().reverse().map(function (m) {
          return h('li', null, h('span', { class: 'badge ' + (m.old ? 'gray' : 'orange'), text: m.old ? '学習データと同じ' : '新しい文' }), m.text);
        }))));
    }

    var addIn = h('input', { id: 'tg-add', type: 'text', class: 'input', placeholder: '例: おばあさんは山でたけのこを見つけました。', 'aria-label': '学習データに足す文' });
    var addMsg = h('p', { class: 'muted', 'aria-live': 'polite' });
    el.appendChild(h('details', { class: 'panel more' },
      h('summary', { text: '学習データを見る・文を足す(' + model.sentences.length + '本)' }),
      h('ol', { class: 'data-list' }, model.sentences.map(function (s) { return h('li', { text: s.join(' ') }); })),
      h('div', { class: 'row' }, addIn, btn('学習データに足す', function () {
        var toks = LM.tokenize(addIn.value, vocab).map(function (t) { return t.text; });
        if (!toks.length) { addMsg.textContent = '文を入れてください。'; return; }
        if (!LM.isEnd(toks[toks.length - 1])) toks.push('。');
        (tg.added[tg.corpus] = tg.added[tg.corpus] || []).push(toks);
        tg.hist = [];
        go('textgen');
      })),
      addMsg,
      h('p', { class: 'muted', text: '足した文はトークンに分けてから学習します。ページを読みこみ直すと消えます。名前など本当の個人情報は入れないでください。' })));

    el.appendChild(point('ためしてみよう',
      h('ul', null,
        h('li', { text: 'ランダムさを小さく(0.1)すると、いつも同じ文になります。大きく(2.0)すると、どうなる？' }),
        h('li', { text: '「1語」と「2語」で、文の自然さはどう変わる？ 本物の生成AIは、前の何千語も見て予想します。' }),
        h('li', { text: '学習データを「昔話」から「学校生活」に変えると、作る文はどう変わる？ AIは学習データにない話し方はできません。' }))));
  }
  function tempLabel(t) { return t.toFixed(1) + (t <= 0.3 ? '(ひかえめ)' : t >= 1.6 ? '(でたらめ)' : '(ふつう)'); }
  function finishCheck(model) {
    if (tg.hist.length && LM.isEnd(tg.hist[tg.hist.length - 1])) {
      tg.made.push({ text: tg.hist.join(''), old: LM.inData(model, tg.hist) });
      if (tg.made.length > 12) tg.made.shift();
    }
  }

  // ================= ① もっともらしいまちがい =================
  var hs = { results: [], judged: {}, marks: {}, revealed: {} };
  function renderHalluc(el) {
    var model = LM.buildModel(D.corpora.ichiban.sentences);
    append(el, h('p', { class: 'lead' }, '生成AIは、本当のことのように見えるまちがいを答えることがあります。これを',
      h('b', { text: 'ハルシネーション' }), '(もっともらしいまちがい)といいます。なぜ起きるのかを、ミニ文章AIでたしかめます。ミニ文章AIは、学習した文から、つぎに来そうな言葉を1つずつえらんで文をつくる小さなAIです(しくみは発展の ⑥ でくわしく体験できます)。'));

    // A: ミニAIで(学習データと同じ文を2本まで、新しい文を3本。5本とも判定する)
    // 判定するまでは「学習データと同じ／新しい文」の印を出さない(印を見ると答えがわかってしまうため)
    var nAll = hs.results.length;
    var nJudged = Object.keys(hs.judged).length;
    var allJudged = nAll > 0 && nJudged >= nAll;
    var resList = h('ul', { class: 'gen-list' }, hs.results.map(function (r, i) {
      var j = hs.judged[i];
      var row = h('li', { class: 'gen-row' },
        j ? h('span', { class: 'badge ' + (r.old ? 'gray' : 'orange'), text: r.old ? '学習データと同じ' : '新しい文' }) : null,
        h('span', { class: 'gen-text', text: r.text }));
      if (!j) {
        row.appendChild(h('span', { class: 'judge' }, h('span', { class: 'muted', text: 'この文は' }),
          btn('本当', function () { hs.judged[i] = 'true'; go('halluc'); }), btn('まちがい', function () { hs.judged[i] = 'false'; go('halluc'); })));
      } else {
        // 学習データと同じ文は本当(学習データは事実だけ)、新しい文は事実ではない
        var right = r.old ? j === 'true' : j === 'false';
        var msg = r.old
          ? (right ? '○ そのとおり。学習データと同じ、本当の文です' : '× じつは学習データと同じ、本当の文です')
          : (right ? '○ そのとおり。事実ではありません' : '× じつは事実ではありません');
        row.appendChild(h('span', { class: 'judge-res ' + (right ? 'ok' : 'ng'), text: msg }));
      }
      return row;
    }));
    el.appendChild(card('A ミニ文章AIに「日本のいちばん」を学習させる',
      h('p', { text: '学習データは、本当のこと(事実)だけの8本の文です。' }),
      h('ol', { class: 'data-list' }, model.sentences.map(function (s) { return h('li', { text: s.join(' ') }); })),
      h('div', { class: 'row' }, btn(hs.results.length ? 'もう一度つくる' : 'AIに文を5本つくらせる', function () {
        var olds = [], news = [], seen = {};
        for (var k = 0; k < 400 && (olds.length < 2 || news.length < 3); k++) {
          var t = LM.generate(model, { order: 2, temperature: 1 });
          var text = t.join('');
          if (seen[text]) continue;
          seen[text] = true;
          if (LM.inData(model, t)) { if (olds.length < 2) olds.push({ text: text, old: true }); }
          else if (news.length < 3) news.push({ text: text, old: false });
        }
        hs.results = olds.concat(news).sort(function () { return Math.random() - 0.5; });
        hs.judged = {};
        go('halluc');
      }, 'ef-btn-primary')),
      hs.results.length ? resList : null,
      hs.results.length && !allJudged ? h('p', { class: 'hint' }, 'それぞれの文が本当かまちがいか、自分で考えてからボタンをおしてください。(のこり ' + (nAll - nJudged) + ' 本)') : null));
    if (allJudged) {
      el.appendChild(h('div', { class: 'result warn' },
        (hs.results.some(function (r) { return r.old; }) ? '「学習データと同じ」文は本当でした。でも、' : '') + '学習データは本当のことだけなのに、データにない「新しい文」は、どれも事実ではありませんでした。AIは言葉のつながりを覚えているだけなので、自然に読めるまちがいの文ができます。'));
    }

    // B: AIの答えチェック
    var B = card('B AIの答えをチェックしよう',
      h('p', { text: 'AIチャットの答え(の例)です。あやしいと思う文をおしてから、「答え合わせ」をおそう。(もう一度おすと印が消えます)' }));
    D.answerCheck.forEach(function (item, qi) {
      var rev = hs.revealed[qi];
      var chat = h('div', { class: 'chat' },
        h('p', { class: 'bubble me' }, h('span', { class: 'who', text: 'あなた' }), item.q),
        h('div', { class: 'bubble ai' }, h('span', { class: 'who', text: 'AI(例)' }),
          item.lines.map(function (ln, li) {
            var key = qi + '-' + li;
            var marked = !!hs.marks[key];
            var cls = 'line' + (marked ? ' marked' : '') + (rev ? (ln.ok ? ' ok' : ' ng') : '');
            return h('span', { class: 'line-wrap' },
              h('button', { type: 'button', class: cls, 'aria-pressed': String(marked), disabled: !!rev,
                on: { click: function () { hs.marks[key] = !marked; go('halluc'); } } },
                rev ? null : h('span', { class: 'mark', 'aria-hidden': 'true', text: marked ? '⚠ あやしい' : '☐' }), ln.t),
              rev ? h('span', { class: 'line-note ' + (ln.ok ? 'ok' : 'ng'), text: (ln.ok ? '○ ' : '× ') + ln.note }) : null);
          })));
      B.appendChild(chat);
      if (!rev) B.appendChild(h('div', { class: 'row' }, btn('答え合わせ', function () { hs.revealed[qi] = true; go('halluc'); }, 'ef-btn-primary')));
      else {
        var right = item.lines.every(function (ln, li) { return !!hs.marks[qi + '-' + li] === !ln.ok; });
        B.appendChild(h('div', { class: 'result ' + (right ? 'ok' : 'info'), text: right ? 'まちがいを全部見つけました。' : 'まちがいの文は赤で示した文です。' }));
      }
    });
    el.appendChild(B);

    el.appendChild(point('ここがポイント',
      h('ul', null,
        h('li', { text: 'AIは「本当かどうか」を調べて、文を作っているのではありません。「続きやすい言葉のならび」を作っています。だから、すらすら読める文でも、まちがっていることがあります。' }),
        h('li', { text: 'とくに、数字・年・人名・本や記事の名前・URL はまちがいやすい所です。' }),
        h('li', { text: 'たしかめ方: 教科書・図鑑・辞書、公式のサイトなど、もとの情報で調べる。何か所かでくらべる。わからなければ先生や大人に聞く。' }))));
  }

  // ================= ⑦ ノイズをまぜる =================
  var ns = { pic: 0, level: 40, seed: 7, game: null };
  function renderNoise(el) {
    var z = IM.noise(LM.seeded(ns.seed));
    var p = pictures[ns.pic];
    append(el, h('p', { class: 'lead', text: '画像をつくるAIは、学習のときに当てっこの練習を何億回もします。「絵にノイズ(ざらざら)をまぜたもの」から「もとの絵」を当てるのです。まずは、絵にノイズをまぜてみましょう。' }));

    var big = pixCanvas(200, IM.addNoise(p.x, z, sigmaOf(ns.level)), p.label + 'にノイズをまぜた絵');
    var slider = h('input', { id: 'noise-level', type: 'range', min: '0', max: '100', step: '1', value: String(ns.level), 'aria-label': 'ノイズの量' });
    var out = h('output', { text: ns.level + '%' });
    slider.addEventListener('input', function () {
      ns.level = Number(slider.value);
      out.textContent = ns.level + '%';
      paint(big, IM.addNoise(p.x, z, sigmaOf(ns.level)));
    });
    var levels = [0, 25, 50, 75, 100];
    el.appendChild(card('絵をえらんで、ノイズの量を変える',
      h('div', { class: 'thumbs' }, pictures.map(function (q, i) {
        return h('button', { type: 'button', class: 'thumb', 'aria-pressed': String(i === ns.pic), on: { click: function () { ns.pic = i; go('noise'); } } },
          pixCanvas(64, q.x, q.label), h('span', { text: q.label }));
      })),
      h('div', { class: 'noise-main' }, big,
        h('div', { class: 'noise-side' },
          h('label', { class: 'ctl' }, h('span', { class: 'ctl-label', text: 'ノイズの量' }), h('span', { class: 'range' }, slider, out)),
          btn('ノイズの模様を変える', function () { ns.seed = (ns.seed * 7 + 13) % 997 + 1; go('noise'); }),
          h('p', { class: 'muted', text: '100%にすると、もとの絵はほとんど見えなくなります。' }))),
      h('p', { class: 'small-title', text: 'ノイズの段階' }),
      h('div', { class: 'strip' }, levels.map(function (lv) {
        return h('figure', null, pixCanvas(72, IM.addNoise(p.x, z, sigmaOf(lv)), lv + '%'), h('figcaption', { text: lv + '%' }));
      }))));

    // AIになってみよう
    var g = ns.game;
    var gameCard = card('AIになって練習してみよう');
    if (!g) {
      gameCard.appendChild(h('p', { text: 'ノイズまじりの絵を見て、もとの絵がどれかを当てます。学習中のAIがしている練習と同じです。' }));
      gameCard.appendChild(btn('練習をはじめる', function () { ns.game = newRound(0, 0); go('noise'); }, 'ef-btn-primary'));
    } else {
      var rz = IM.noise(LM.seeded(g.seed));
      gameCard.appendChild(h('p', { class: 'muted', text: '第 ' + (g.round + 1) + ' 問 / 5　ノイズの量 ' + g.level + '%　正解 ' + g.score }));
      gameCard.appendChild(h('div', { class: 'noise-main' }, pixCanvas(192, IM.addNoise(pictures[g.answer].x, rz, sigmaOf(g.level)), 'ノイズまじりの問題の絵'),
        h('div', { class: 'thumbs small' }, pictures.map(function (q, i) {
          var cls = 'thumb' + (g.chosen != null ? (i === g.answer ? ' right' : i === g.chosen ? ' wrong' : '') : '');
          return h('button', { type: 'button', class: cls, disabled: g.chosen != null, on: { click: function () { g.chosen = i; if (i === g.answer) g.score++; go('noise'); } } },
            pixCanvas(56, q.x, q.label), h('span', { text: q.label }));
        }))));
      if (g.chosen != null) {
        gameCard.appendChild(h('div', { class: 'result ' + (g.chosen === g.answer ? 'ok' : 'info'), text: g.chosen === g.answer ? '正解！' : '正解は「' + pictures[g.answer].label + '」でした。' }));
        if (g.round < 4) gameCard.appendChild(btn('つぎの問題(ノイズが多くなる) ▶', function () { ns.game = newRound(g.round + 1, g.score); go('noise'); }, 'ef-btn-primary'));
        else gameCard.appendChild(h('div', { class: 'row' }, h('b', { text: '5問中 ' + g.score + ' 問正解' }), btn('もう一度', function () { ns.game = newRound(0, 0); go('noise'); })));
      }
    }
    el.appendChild(gameCard);
    el.appendChild(point('ここがポイント',
      h('p', { text: 'AIは、「もとの絵はこうだったはず」と予想する練習をくり返します。ノイズが少しのときも、多いときも練習します。これができるようになると、ノイズだけの画面からでも、少しずつ絵を作れます(つぎのステップ)。' })));
  }
  function sigmaOf(level) { return 1.6 * level / 100; }
  function newRound(round, score) {
    var r = LM.seeded(round * 31 + score * 7 + Date.now() % 1000);
    return { round: round, score: score, answer: Math.floor(r() * pictures.length), seed: Math.floor(r() * 9999) + 1, level: [50, 70, 85, 95, 100][round], chosen: null };
  }

  // ================= ⑧ ノイズから絵をつくる =================
  var STEPS = 20;
  var gs = { word: 'ねこ', word2: '', mix: 0.5, k: 0, x: null, x0: null, weights: null, sched: IM.schedule(STEPS, 1.6, 0.04), rnd: null, running: false };
  function resetGen() {
    // 自動で進めている途中なら止める(止めないと、新しいノイズの絵を古いタイマーが進めてしまう)
    clearTimers();
    gs.rnd = LM.seeded(Math.floor(Math.random() * 1e9) + 1);
    gs.k = 0;
    gs.x = IM.addNoise(new Float32Array(IM.DIM), IM.noise(gs.rnd), gs.sched[0]);
    gs.x0 = null; gs.weights = null; gs.running = false;
  }
  function mixOf() {
    var m = {};
    if (!gs.word) { m['*'] = 1; return m; }
    if (gs.word2 && gs.word2 !== gs.word) { m[gs.word] = 1 - gs.mix; m[gs.word2] = gs.mix; } else m[gs.word] = 1;
    return m;
  }
  function genStep() {
    if (gs.k >= STEPS) return false;
    var s = gs.sched[gs.k], sn = gs.sched[gs.k + 1];
    var d = IM.denoise(gs.x, s, pictures, mixOf());
    gs.x0 = d.x0; gs.weights = d.weights;
    gs.x = IM.step(gs.x, s, sn, d.x0, IM.noise(gs.rnd), 0.6);
    gs.k++;
    return true;
  }
  function renderImggen(el) {
    if (!gs.x) resetGen();
    append(el, h('p', { class: 'lead', text: 'ノイズだけの画面から、AIが少しずつノイズを取りのぞいて絵にします。「こうなるはず」と予想しながら取りのぞきます。どんな絵にするかは「ことば(プロンプト)」で決めます。' }));

    var promptWords = gs.word ? (gs.word2 && gs.word2 !== gs.word ? [gs.word, gs.word2] : [gs.word]) : [];
    var wordsRow = h('div', { class: 'ctl' }, h('span', { class: 'ctl-label', text: 'ことば(プロンプト)' }),
      segmented(D.pictureWords.map(function (w) { return [w, w]; }).concat([['', 'ことばなし']]), gs.word, function (v) { gs.word = v; if (!v) gs.word2 = ''; resetGen(); go('imggen'); }, 'ことば'));
    var mixRow = h('div', { class: 'ctl' }, h('span', { class: 'ctl-label', text: 'もう1つまぜる' }),
      segmented([['', 'まぜない']].concat(D.pictureWords.filter(function (w) { return w !== gs.word; }).map(function (w) { return [w, w]; })), gs.word2, function (v) { gs.word2 = v; resetGen(); go('imggen'); }, 'もう1つのことば'));
    var mixIn = h('input', { id: 'mix', type: 'range', min: '0.1', max: '0.9', step: '0.1', value: String(gs.mix), 'aria-label': 'まぜる割合' });
    mixIn.addEventListener('change', function () { gs.mix = Number(mixIn.value); resetGen(); go('imggen'); });

    var canvasNow = pixCanvas(256, gs.x, 'いまの絵');
    var blank = new Float32Array(IM.DIM).fill(0.9);
    var canvasPred = pixCanvas(128, gs.x0 || blank, 'AIの予想');
    var predCap = h('figcaption');
    var stepBtn = btn('1ステップ進める', function () { genStep(); refresh(); });
    var runBtn = btn('最後まで自動 ▶', function () { run(); }, 'ef-btn-primary');
    var stepOut = h('p', { class: 'stats' });
    var weightsBox = h('div', { class: 'weights' });
    var msg = h('div', { 'aria-live': 'polite' });

    function refresh() {
      paint(canvasNow, gs.x);
      paint(canvasPred, gs.x0 || blank);
      predCap.textContent = gs.x0 ? 'AIの予想(ノイズを全部取ったら、こうなるはず)' : 'AIの予想: まだありません(「1ステップ進める」をおすと出ます)';
      stepBtn.disabled = gs.k >= STEPS || gs.running;
      runBtn.disabled = gs.running;
      runBtn.textContent = gs.k >= STEPS ? 'もう一度、新しいノイズから ▶' : '最後まで自動 ▶';
      stepOut.textContent = 'ステップ ' + gs.k + ' / ' + STEPS + '　のこりのノイズ ' + Math.round(gs.sched[gs.k] / gs.sched[0] * 100) + '%';
      weightsBox.textContent = '';
      pictures.forEach(function (p, i) {
        var w = gs.weights ? gs.weights[i] : 0;
        weightsBox.appendChild(h('div', { class: 'wrow' }, pixCanvas(40, p.x, p.label), h('span', { class: 'wlabel', text: p.label }), bar(w), h('span', { class: 'num', text: pct(w) })));
      });
      msg.textContent = '';
      if (gs.k >= STEPS) {
        var best = 0;
        gs.weights.forEach(function (w, i) { if (w > gs.weights[best]) best = i; });
        var d = Math.sqrt(IM.dist2(gs.x, pictures[best].x) / IM.DIM);
        var mixed = gs.word && gs.word2 && gs.word2 !== gs.word;
        if (mixed) msg.appendChild(h('div', { class: 'result info', text: '「' + gs.word + '」' + Math.round((1 - gs.mix) * 100) + '%と「' + gs.word2 + '」' + Math.round(gs.mix * 100) + '%をまぜた、学習データにない絵ができました。学習していない組み合わせをたのむと、ふしぎな絵になることがあります。これが画像のハルシネーションです。' }));
        else if (d < 0.08) msg.appendChild(h('div', { class: 'result warn', text: '学習した「' + pictures[best].label + '」とほとんど同じ絵ができました。学習した絵が少ないと、学習データをそのまま出してしまうことがあります。だれかの作品にそっくりな絵は、勝手に使えません(著作権)。' }));
        else msg.appendChild(h('div', { class: 'result info', text: '学習データにない、新しい絵ができました。いちばん近いのは「' + pictures[best].label + '」です。いくつかの絵がまざると、ふしぎな絵になることもあります(画像のハルシネーション)。' }));
        msg.appendChild(h('p', { class: 'muted', text: 'できあがりました。もう一度作るときは「新しいノイズから」をおします。' }));
      }
      applyRuby(msg);
      applyRuby(predCap);
    }
    function run() {
      if (gs.running) return;
      if (gs.k >= STEPS) { resetGen(); }
      gs.running = true;
      refresh();
      var t = setInterval(function () {
        if (!genStep() || gs.k >= STEPS) { clearInterval(t); gs.running = false; }
        refresh();
      }, reduceMotion ? 30 : 140);
      timers.push(t);
    }

    el.appendChild(h('div', { class: 'controls' }, wordsRow, gs.word ? mixRow : null,
      gs.word2 && gs.word ? h('label', { class: 'ctl' }, h('span', { class: 'ctl-label', text: gs.word + ' ↔ ' + gs.word2 }), mixIn) : null));
    el.appendChild(h('p', { class: 'muted' }, 'ことば(プロンプト)も、', h('a', { href: '#token' }, 'ステップ⑤のトークン'),
      'と同じように番号にしてAIにわたします: ',
      promptWords.length ? promptWords.map(function (w) { return w + ' → ' + LM.tokenize(w, vocab)[0].id; }).join('、') : '(ことばなし)'));

    el.appendChild(card(null,
      h('div', { class: 'gen-grid' },
        h('figure', { class: 'gen-now' }, canvasNow, h('figcaption', { text: 'いまの絵' })),
        h('div', { class: 'gen-side' },
          h('figure', null, canvasPred, predCap),
          stepOut,
          h('div', { class: 'row' }, stepBtn, runBtn,
            btn('新しいノイズから', function () { resetGen(); refresh(); })))),
      msg,
      h('p', { class: 'small-title', text: 'AIがお手本にしている学習した絵(いまの絵に近いほど重く見る)' }),
      weightsBox));
    refresh();

    el.appendChild(point('ためしてみよう',
      h('ul', null,
        h('li', { text: '同じ「ねこ」でも、茶とら・グレーのどちらになるかは変わります。「新しいノイズから」をおすたびに変わります。はじめのノイズで決まります。' }),
        h('li', { text: '「ねこ」と「家」をまぜると、どんな絵になる？ 本物の画像AIも、ふしぎな絵(指が6本の手など)を作ることがあります。学習していない組み合わせをたのんだときです。' }),
        h('li', { text: 'この模型が学習した絵は6枚だけです。本物の画像AIは、何億枚もの絵から学ぶので、いろいろな絵を作れます。でも、学習した作品に似た絵が出ることもあります。' }))));
  }

  // ================= ② 個人情報 =================
  var ps = { pick: { name: 0, school: -1, phone: 0, address: -1 }, sent: false, out: null, sendJudge: {} };
  function privacySentences() {
    return D.privacyChoices.filter(function (c) { return ps.pick[c.key] >= 0; }).map(function (c) {
      return c.template.replace('{v}', c.values[ps.pick[c.key]]);
    });
  }
  function renderPrivacy(el) {
    append(el, h('p', { class: 'lead', text: '生成AIのサービスによっては、入力した内容が記録に残ります。AIの学習に使われることもあります。そのとき何が起きるかを、ミニ文章AIでたしかめます。' }));

    var step1 = card('① Aさんになって、AIに話しかける',
      h('p', { class: 'muted', text: '入れる情報をえらびます(どれも架空のものです)。' }),
      h('div', { class: 'pi-grid' }, D.privacyChoices.map(function (c) {
        var sel = h('select', { id: 'pi-' + c.key, class: 'input', disabled: ps.sent, on: { change: function () { ps.pick[c.key] = Number(sel.value); go('privacy'); } } },
          [h('option', { value: '-1', text: '入れない', selected: ps.pick[c.key] === -1 })].concat(c.values.map(function (v, i) {
            return h('option', { value: String(i), text: v, selected: ps.pick[c.key] === i });
          })));
        return h('label', { class: 'ctl' }, h('span', { class: 'ctl-label', text: c.label }), sel);
      })),
      h('div', { class: 'chat' }, privacySentences().map(function (s) {
        return h('p', { class: 'bubble me' }, h('span', { class: 'who', text: 'Aさん' }), s.replace(/ /g, ''));
      })),
      ps.sent ? h('div', { class: 'result info' }, '送りました。この会話は、AIの学習データに入りました(という設定です)。つぎは下の②へ進みます。')
        : h('div', { class: 'row' }, btn('AIに送る', function () {
          ps.sent = true; ps.out = null;
          afterDraw = function () { var s2 = document.getElementById('privacy-step2'); if (s2) s2.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }); };
          go('privacy');
        }, 'ef-btn-primary')),
      ps.sent ? h('div', { class: 'row' }, btn('入れる情報を変える', function () { ps.sent = false; ps.out = null; go('privacy'); })) : null);
    el.appendChild(step1);

    if (ps.sent) {
      var model = LM.buildModel(D.chatBase.concat(privacySentences()));
      var prompts = [['name', ['わたし', 'の', '名前', 'は']], ['phone', ['わたし', 'の', '電話番号', 'は']], ['address', ['わたし', 'の', '住所', 'は']],
        ['school', ['わたし', 'の', '学校', 'は']], ['', ['わたし', 'の', '好きな']]];
      var step2 = card('② 後日、Bさんが同じAIを使うと…',
        h('span', { id: 'privacy-step2', class: 'anchor' }),
        h('p', { class: 'muted', text: 'Bさんが書きはじめた文の続きを、AIが作ります。' }),
        h('div', { class: 'row' }, prompts.map(function (pp) {
          var p = pp[1];
          return btn(p.join('') + '…', function () {
            var toks = LM.generate(model, { start: p, order: 2, temperature: 1 });
            var cand = LM.candidates(model, p, 2);
            ps.out = { key: pp[0], prompt: p, toks: toks, cand: cand.list, used: cand.used };
            go('privacy');
          });
        })));
      if (ps.out) {
        var text = ps.out.toks.join('');
        step2.appendChild(h('div', { class: 'chat' },
          h('p', { class: 'bubble me' }, h('span', { class: 'who', text: 'Bさん' }), ps.out.prompt.join('') + '…'),
          h('p', { class: 'bubble ai' }, h('span', { class: 'who', text: 'AI' }), text)));
        step2.appendChild(h('p', { class: 'small-title', text: '「' + ps.out.prompt.slice(ps.out.used === 1 ? -1 : -2).join(' ') + '」のあとに来た言葉' }));
        step2.appendChild(h('table', { class: 'prob' }, h('tbody', null, ps.out.cand.map(function (c) {
          return h('tr', null, h('th', { scope: 'row', text: c.word }), h('td', null, bar(c.p)), h('td', { class: 'num', text: pct(c.p) }));
        }))));
        var entered = ps.out.key && ps.pick[ps.out.key] >= 0;
        var leaked = entered && privacySentences().some(function (x) { return x.replace(/ /g, '') === text; });
        if (leaked) step2.appendChild(h('div', { class: 'result ng', text: 'Aさんの情報が、Bさんへの答えにそのまま出てきました！ 学習データに1回しか出てこない文は、AIがそのまま覚えてしまいやすいのです。' }));
        else if (ps.out.key && !entered) step2.appendChild(h('div', { class: 'result ok', text: 'Aさんはこの情報を入れなかったので、Aさんの情報は出てきません。そのかわりAIは、よく出てくる言葉でそれらしくうめました。これもハルシネーションです。' }));
        else step2.appendChild(h('div', { class: 'result info', text: 'みんながよく入れる言葉から、続きが作られました。' }));
      }
      el.appendChild(step2);
    }

    var step3 = card('③ 送る前チェック',
      h('p', { text: 'つぎの文をAIに送ってもよいか、えらんでください。' }),
      h('ul', { class: 'send-list' }, D.sendCheck.map(function (s, i) {
        var j = ps.sendJudge[i];
        return h('li', { class: 'send-row' },
          h('span', { class: 'send-text', text: s.t }),
          j == null ? h('span', { class: 'judge' }, btn('送ってOK', function () { ps.sendJudge[i] = true; go('privacy'); }), btn('送らない(直す)', function () { ps.sendJudge[i] = false; go('privacy'); }))
            : h('span', { class: 'judge-res ' + (j === s.ok ? 'ok' : 'ng') },
              (j === s.ok ? '○ ' : '× ') + s.why + (s.fix ? '　直した例: 「' + s.fix + '」' : '')));
      })));
    el.appendChild(step3);

    el.appendChild(point('生成AIに入れないもの',
      h('ul', null,
        h('li', { text: '自分や友だち・家族の名前、住所、電話番号、メールアドレス、学校名やクラス' }),
        h('li', { text: '顔写真(とくに友だちの写真)、パスワード、ほかの人のひみつ' })),
      h('p', { text: '入れた内容は、会社のサーバーに記録として残ることがあります。まちがいや不正アクセスで、会話の記録がほかの人に見えてしまう事故も起きています。入れる前に「だれに見られても大丈夫？」と考えます。' })));
  }

  // ================= ③ クイズとふりかえり(基本の内容だけ) =================
  var qs = { ans: {} };
  function renderQuiz(el) {
    var score = D.quiz.filter(function (q, i) { return qs.ans[i] === q.c; }).length;
    var answered = Object.keys(qs.ans).length;
    el.appendChild(h('p', { class: 'lead', text: '① もっともらしいまちがい・② 個人情報の体験をふりかえるクイズです(6問)。答えたあとの説明も読もう。' }));
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
      el.appendChild(btn('クイズをやり直す', function () { qs.ans = {}; go('quiz'); }));
    }

    var refl = saved.refl || {};
    var qsR = [
      ['r1', '文章をつくるAIと、画像をつくるAIは、それぞれどうやって作っていましたか。'],
      ['r2', 'ハルシネーションや個人情報について、生成AIを使うときに気をつけたいことは何ですか。'],
      ['r3', '生成AIを、どんな場面で、どのように使ってみたいですか。']
    ];
    var status = h('p', { class: 'muted', 'aria-live': 'polite', text: '書いた内容は、この端末のブラウザの中だけに保存されます。' });
    el.appendChild(reflectOnly(card('ふりかえり', qsR.map(function (r) {
      var ta = h('textarea', { id: 'refl-' + r[0], class: 'input', rows: 3 });
      ta.value = refl[r[0]] || '';
      ta.addEventListener('input', function () { refl[r[0]] = ta.value; save('refl', refl); status.textContent = '保存しました(この端末の中だけ)。'; });
      return h('label', { class: 'refl' }, h('span', { class: 'ctl-label', text: r[1] }), ta);
    }), status)));

    el.appendChild(h('p', { class: 'hint', 'data-ef-reflect': '' }, '書きおわったら、', h('a', { href: '#records', text: T_REC }), 'でファイルに書き出して先生に出そう。'));
  }

  // ---- 記録の書き出し(端末の中でファイルを作るだけ。送信はしない) ----
  function buildRecord() {
    var st = saved.student || {};
    var visited = saved.visited || {};
    var refl = saved.refl || {};
    return {
      app: '生成AIのしくみラボ',
      exportedAt: new Date().toISOString(),
      student: { cls: st.cls || '', num: st.num || '', name: st.name || '' },
      steps: SECTIONS.filter(function (x) { return x.no; }).map(function (x) { return { no: x.label, title: x.recTitle || x.title, opened: !!visited[x.id] }; }),
      guess: { answered: Object.keys(guessState.picked).length, sameAsAI: D.guessGame.filter(function (it, i) { return guessState.picked[i] === it.options[0][0]; }).length },
      quiz: { answered: Object.keys(qs.ans).length, correct: D.quiz.filter(function (q, i) { return qs.ans[i] === q.c; }).length, total: D.quiz.length },
      reflection: { r1: refl.r1 || '', r2: refl.r2 || '', r3: refl.r3 || '' }
    };
  }
  function recordCsv(r) {
    // 表計算ソフトで式として読まれないように、= + - @ などで始まる文には ' を付ける(ネット詐欺 追体験ラボと同じ)
    var cell = function (v) {
      var s = String(v == null ? '' : v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };
    var head = ['組', '番号', '名前', 'ひらいたステップ', 'つぎの言葉あて(AIと同じ)', 'クイズ正解', 'ふりかえり1', 'ふりかえり2', 'ふりかえり3'];
    var row = [r.student.cls, r.student.num, r.student.name,
      r.steps.filter(function (x) { return x.opened; }).length + ' / ' + r.steps.length,
      r.guess.sameAsAI + ' / ' + D.guessGame.length, r.quiz.correct + ' / ' + r.quiz.total,
      r.reflection.r1, r.reflection.r2, r.reflection.r3];
    return '\ufeff' + head.map(cell).join(',') + '\r\n' + row.map(cell).join(',');
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
      return ('生成AIのしくみラボ_' + who + '.' + ext).replace(/[\\/:*?"<>|]/g, '_');
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
    var score = { guess: r.guess.answered ? 'AIと同じ予想 ' + r.guess.sameAsAI + ' / ' + D.guessGame.length + '(答えた ' + r.guess.answered + '問)' : '',
      quiz: r.quiz.answered ? r.quiz.correct + ' / ' + r.quiz.total + ' 問正解' : '' };
    append(el, [
      h('div', { class: 'module-head' },
        h('h1', { class: 'sec-title', text: T_REC }),
        h('p', { class: 'meta', text: (FK_OFF ? '進み具合' : '進み具合とふりかえり') + 'は、この端末のブラウザの中にだけ保存されています。提出するときは、ファイルに書き出してください。' })),
      card('名前',
        h('p', { class: 'muted', text: '名前は、先生の指示がないときは入れなくてかまいません。' }),
        h('div', { class: 'field-row' }, field('rec-cls', '組', 'cls', 4), field('rec-num', '番号', 'num', 4), field('rec-name', '名前(なくてもよい)', 'name', 12))),
      card(FK_OFF ? '進み具合' : '進み具合とふりかえり',
        h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
          h('thead', null, h('tr', null, h('th', { text: 'ステップ' }), h('th', { text: 'ひらいた' }), h('th', { text: '記録' }))),
          h('tbody', null, STEP_SECTIONS.map(function (x) {
            return h('tr', null, h('td', { text: x.label + ' ' + x.title }), h('td', { text: visited[x.id] ? '✓' : '' }), h('td', { text: score[x.id] || '' }));
          })))),
        h('ul', { class: 'refl-list', 'data-ef-reflect': '' }, [['r1', 'ふりかえり1(しくみ)'], ['r2', 'ふりかえり2(気をつけたいこと)'], ['r3', 'ふりかえり3(使ってみたい場面)']].map(function (q) {
          return h('li', null, h('b', { text: q[1] + ': ' }), refl[q[0]] ? h('span', { text: refl[q[0]] }) : h('span', { class: 'muted', text: '(まだ書いていません)' }));
        })),
        h('p', { class: 'muted', 'data-ef-reflect': '' }, 'ふりかえりは「', h('a', { href: '#quiz', text: '③ クイズとふりかえり' }), '」で書きます。')),
      card('書き出す',
        h('p', null, h('strong', { text: '先生に出すのは JSON のファイルです。' }), 'CSV は、表計算ソフトで見るときに使います。ファイルができないときは「記録をコピーする」を使います。'),
        h('div', { class: 'btn-row' },
          btn('記録を書き出す(JSON・提出用)', function () { download('json'); }, 'ef-btn-primary'),
          btn('CSVで書き出す(表計算用)', function () { download('csv'); }),
          btn('記録をコピーする', copy)),
        note,
        point('書き出す中身', h('p', { text: '入るのは、組・番号・名前、ひらいたステップ、ふりかえりの文章です。つぎの言葉あてとクイズの結果も入ります。ミニ文章AIで作った文などは入りません。' }))),
      renderReset()
    ]);
  }

  // ---- はじめからやり直す(データリセット) ----
  // 確認は画面の中で行う(ブラウザの確認ダイアログが出ない環境でも使えるように)。
  // ふりがな・文字の大きさは表示の設定なので消さない(体験教材集の「はじめからやり直す」と同じ)。
  var resetAsk = false;
  var resetMsg = '';
  function renderReset() {
    var box = card('はじめからやり直す',
      h('p', { text: 'この端末に保存したもの(名前・進み具合・ふりかえり・答えなど)を、すべて消します。次の人にわたすときや、やり直すときに使います。' }));
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
    [[guessState, 'guessState'], [tokenState, 'tokenState'], [tg, 'tg'], [hs, 'hs'], [ns, 'ns'], [gs, 'gs'], [ps, 'ps'], [qs, 'qs']].forEach(function (o) {
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
    // 続けて出したときに、前のタイマーで早く消えないようにする
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.classList.remove('show'); }, 2500);
  }

  // ---- 表示の切りかえ(ふりがな・大きな文字) ----
  function setupToggles() {
    var tools = document.getElementById('display-toggles');
    [['furigana', 'ふりがな', 'show-ruby'], ['big', '大きな文字', 'big-text']].forEach(function (t) {
      var on = !!saved[t[0]];
      document.documentElement.classList.toggle(t[2], on);
      // ふりがなは ✓ の付く切りかえ(.ef-toggle)、文字の大きさは4分野共通の「文字 中/大」ボタン(.ef-size)
      var b = t[0] === 'big'
        ? h('button', { type: 'button', class: 'ef-btn ef-size', 'data-kz-label': '大きな文字', 'aria-label': '文字の大きさ(大きな文字)', 'aria-pressed': String(on) }, '文字 ', h('span', { class: 'ef-size-v' }))
        : h('button', { type: 'button', class: 'toggle ef-btn ef-toggle', 'aria-pressed': String(on) }, t[1]);
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

  // 作った文・足した文・クイズの答えなども、この端末の中に残す(読みこみ直しても消えない)
  function persist() {
    save('state', {
      guess: guessState.picked, tg: { corpus: tg.corpus, order: tg.order, temp: tg.temp, added: tg.added, made: tg.made },
      quiz: qs.ans, send: ps.sendJudge
    });
  }
  var INITIAL = JSON.stringify({ guessState: guessState, tokenState: tokenState, tg: tg, hs: hs, ns: ns, gs: gs, ps: ps, qs: qs });
  (function restore() {
    var st = saved.state;
    if (!st) return;
    try {
      if (st.guess) guessState.picked = st.guess;
      if (st.tg) {
        if (D.corpora[st.tg.corpus]) tg.corpus = st.tg.corpus;
        if (st.tg.order === 1 || st.tg.order === 2) tg.order = st.tg.order;
        if (typeof st.tg.temp === 'number') tg.temp = st.tg.temp;
        tg.added = st.tg.added || {};
        tg.made = st.tg.made || [];
      }
      if (st.quiz) qs.ans = st.quiz;
      if (st.send) ps.sendJudge = st.send;
    } catch (e) { /* 読めなければ最初から */ }
  })();

  buildNav();
  setupToggles();
  window.addEventListener('hashchange', route);
  route();
})();
