// 生成AIのしくみラボ: 画面
(function () {
  'use strict';
  var D = GenaiData, LM = GenaiLM, IM = GenaiImg;

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
  // ふりがな
  function rb(kanji, kana) { return h('ruby', null, kanji, h('rt', { text: kana })); }
  function btn(label, onClick, cls) { return h('button', { type: 'button', class: cls || 'ef-btn', on: { click: onClick } }, label); }
  function pct(x) { return Math.round(x * 100) + '%'; }
  function point(title) {
    var kids = Array.prototype.slice.call(arguments, 1);
    return h('div', { class: 'point' }, h('p', { class: 'point-title', text: title }), kids);
  }
  function card(title) {
    var kids = Array.prototype.slice.call(arguments, 1);
    return h('section', { class: 'panel' }, title ? h('h3', { class: 'panel-title' }, title) : null, kids);
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
    { id: 'intro', group: '', no: '', title: 'はじめに', render: renderIntro },
    { id: 'guess', group: '文章をつくるAI', no: '1', title: 'つぎの言葉あて', render: renderGuess },
    { id: 'token', group: '文章をつくるAI', no: '2', title: '言葉のかけら(トークン)', render: renderToken },
    { id: 'textgen', group: '文章をつくるAI', no: '3', title: 'ミニ文章AIを動かす', render: renderTextgen },
    { id: 'halluc', group: '文章をつくるAI', no: '4', title: 'もっともらしいまちがい', render: renderHalluc },
    { id: 'noise', group: '画像をつくるAI', no: '5', title: 'ノイズをまぜる(学習)', render: renderNoise },
    { id: 'imggen', group: '画像をつくるAI', no: '6', title: 'ノイズから絵をつくる', render: renderImggen },
    { id: 'privacy', group: '安全に使う', no: '7', title: '個人情報が出てしまう？', render: renderPrivacy },
    { id: 'quiz', group: '安全に使う', no: '8', title: 'クイズとふりかえり', render: renderQuiz }
  ];
  var view = document.getElementById('view');
  var nav = document.getElementById('nav');
  var current = null;

  function buildNav() {
    nav.textContent = '';
    var group = null;
    var ul = null;
    SECTIONS.forEach(function (s) {
      if (s.group !== group) {
        group = s.group;
        if (group) nav.appendChild(h('p', { class: 'nav-group', text: group }));
        ul = h('ul', { class: 'nav-list' });
        nav.appendChild(ul);
      }
      ul.appendChild(h('li', null, h('a', { href: '#' + s.id, class: 'nav-link', 'data-id': s.id },
        s.no ? h('span', { class: 'nav-no', text: s.no }) : null, h('span', { text: s.title }))));
    });
  }

  function go(id) {
    var s = SECTIONS.filter(function (x) { return x.id === id; })[0] || SECTIONS[0];
    clearTimers();
    current = s;
    Array.prototype.forEach.call(nav.querySelectorAll('.nav-link'), function (a) {
      if (a.getAttribute('data-id') === s.id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    view.textContent = '';
    var idx = SECTIONS.indexOf(s);
    view.appendChild(h('header', { class: 'sec-head' },
      s.group ? h('p', { class: 'sec-group', text: s.group + (s.no ? '　ステップ ' + s.no : '') }) : null,
      h('h2', { class: 'sec-title', text: s.title })));
    var body = h('div', { class: 'sec-body' });
    view.appendChild(body);
    s.render(body);
    var prev = SECTIONS[idx - 1];
    var next = SECTIONS[idx + 1];
    view.appendChild(h('nav', { class: 'pager', 'aria-label': 'ページの移動' },
      prev ? h('a', { class: 'ef-btn', href: '#' + prev.id }, '◀ ' + prev.title) : h('span'),
      next ? h('a', { class: 'ef-btn-primary', href: '#' + next.id }, 'つぎへ: ' + next.title + ' ▶') : null));
    save('last', s.id);
    window.scrollTo(0, 0);
    var main = document.getElementById('main');
    if (main) main.scrollTop = 0;
  }
  function route() {
    var id = (location.hash || '').replace('#', '');
    if (!id) id = saved.last || 'intro';
    go(id);
  }

  // ================= はじめに =================
  function renderIntro(el) {
    append(el, [
      h('p', { class: 'lead' }, rb('生成', 'せいせい'), 'AIは、文章や絵などを「新しく作る」AIです。このラボでは、ブラウザの中で動く小さな', rb('模型', 'もけい'),
        'のAIを自分で動かして、しくみをたしかめます。インターネットにはつながりません。'),
      h('div', { class: 'flow', role: 'img', 'aria-label': '学習データ、学習、生成の流れ' },
        h('div', { class: 'flow-box' }, h('b', { text: '学習データ' }), h('span', { text: 'たくさんの文章や絵' })),
        h('span', { class: 'flow-arrow', 'aria-hidden': 'true', text: '→' }),
        h('div', { class: 'flow-box' }, h('b', { text: '学習' }), h('span', { text: 'よく出てくる「きまり」を見つけて覚える' })),
        h('span', { class: 'flow-arrow', 'aria-hidden': 'true', text: '→' }),
        h('div', { class: 'flow-box accent' }, h('b', { text: '生成' }), h('span', { text: '覚えたきまりを使って、新しく作る' }))),
      h('div', { class: 'two' },
        card('文章をつくるAI',
          h('p', { text: '「つぎに来そうな言葉」を予想して、1つずつつなげて文を作ります。' }),
          h('p', { class: 'muted', text: 'ステップ1〜4' }),
          h('a', { class: 'ef-btn-primary', href: '#guess' }, 'はじめる ▶')),
        card('画像をつくるAI',
          h('p', { text: 'ざらざらのノイズから、少しずつノイズを取りのぞいて絵にしていきます。' }),
          h('p', { class: 'muted', text: 'ステップ5・6' }),
          h('a', { class: 'ef-btn-primary', href: '#noise' }, 'はじめる ▶'))),
      card('安全に使うために',
        h('p', { text: 'もっともらしいまちがい(ハルシネーション)と、個人情報が出てしまうしくみも体験します。ステップ4・7・8。' })),
      h('details', { class: 'teacher' },
        h('summary', { text: '先生へ(授業の進め方の例)' }),
        h('ul', null,
          h('li', { text: '1時間目(50分): はじめに 5分 → 1 つぎの言葉あて 10分 → 2 トークン 5分 → 3 ミニ文章AI 15分 → 4 もっともらしいまちがい 15分' }),
          h('li', { text: '2時間目(50分): 5 ノイズをまぜる 10分 → 6 ノイズから絵をつくる 15分 → 7 個人情報 15分 → 8 クイズとふりかえり 10分' }),
          h('li', { text: '1時間で行うときは、1・3・4・6・7 を中心にします。' }),
          h('li', { text: 'この教材の文章AIは、前の1〜2語だけを見て続きを選ぶ「n-gram(エヌグラム)」という小さな模型です。本物の生成AIは何十億もの文から学び、ずっと長い前の文を見て予想しますが、「つぎの言葉を確率で選ぶ」という考え方は同じです。' }),
          h('li', { text: '画像AIは、拡散モデルの考え方(ノイズを少しずつ取りのぞく)を、学習した絵6枚だけでまねた模型です。学習データが少ないので、学習した絵とほぼ同じ絵が出やすく、それを「似すぎ・著作権」の話につなげられます。' }),
          h('li', { text: 'つぎの言葉あての割合は、説明のための例です。人名・学校名・住所・電話番号はすべて架空です。' })))
    ]);
  }

  // ================= 1 つぎの言葉あて =================
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
      box.appendChild(h('p', { class: 'small-title', text: 'たくさんの文章では、このあとにこう続くことが多い(割合は例)' }));
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
      h('p', null, 'わたしたちも、生成AIも、「よく見る続き」から予想しています。生成AIは、ものすごくたくさんの文章を読んで、「この言葉のあとには、どの言葉が何%くらい来るか」を',
        rb('学習', 'がくしゅう'), 'しています。意味がわかって書いているのではなく、続きやすい言葉をえらんでいます。')));
  }

  // ================= 2 トークン =================
  var tokenState = { text: '今日は天気がいいので、友だちと公園でサッカーをしました。' };
  function renderToken(el) {
    append(el, h('p', { class: 'lead', text: '生成AIは、文字のままでは計算できません。文章を「トークン」という小さなかけらに分けて、1つずつ番号(数)にしてから計算します。' }));
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
        h('li', { text: 'あまり出てこない言葉は、1文字ずつなど細かく分かれます(点線のかけら)。' }),
        h('li', { text: 'AIは、この番号のならびを使って「つぎに来る番号(言葉)」を計算します。この教材の分け方は、本物のAIより簡単にしたものです。' }))));
  }

  // ================= 3 ミニ文章AI =================
  var tg = { corpus: 'mukashi', order: 2, temp: 1, start: '', hist: [], added: {}, made: [] };
  function textModel(key) {
    return LM.buildModel(D.corpora[key].sentences.concat(tg.added[key] || []));
  }
  function renderTextgen(el) {
    var model = textModel(tg.corpus);
    var ended = tg.hist.length > 0 && LM.isEnd(tg.hist[tg.hist.length - 1]);
    var cand = LM.candidates(model, tg.hist, tg.order);
    var list = LM.withTemperature(cand.list, tg.temp);

    append(el, h('p', { class: 'lead', text: '学習データの文から、「この言葉のあとに来た言葉」を数えたAIです。つぎの言葉を1つずつえらんで、文を作ってみましょう。' }));

    var corpusSel = h('select', { id: 'tg-corpus', class: 'input', on: { change: function () { tg.corpus = corpusSel.value; tg.hist = []; tg.start = ''; go('textgen'); } } },
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
    var sentence = h('div', { class: 'sentence', 'aria-live': 'polite' },
      tg.hist.length ? chips(tg.hist) : h('span', { class: 'muted', text: 'はじめの言葉をえらぶか、下の候補をおしてください。' }),
      ended ? null : h('span', { class: 'cursor', text: '？' }));
    var startRow = h('div', { class: 'row' }, h('span', { class: 'muted', text: 'はじめの言葉:' }),
      starts.map(function (w) { return btn(w, function () { tg.hist = [w]; go('textgen'); }); }));

    var actions = h('div', { class: 'row' },
      btn('いちばん多いものをえらぶ', function () { if (!ended && list.length) { tg.hist.push(list[0].word); finishCheck(model); go('textgen'); } }, 'ef-btn'),
      btn('🎲 サイコロでえらぶ', function () { if (!ended && list.length) { tg.hist.push(LM.pick(list, Math.random)); finishCheck(model); go('textgen'); } }, 'ef-btn'),
      btn('文のおわりまで自動', function () {
        if (ended) return;
        tg.hist = LM.generate(model, { start: tg.hist, order: tg.order, temperature: tg.temp });
        finishCheck(model); go('textgen');
      }, 'ef-btn-primary'),
      btn('はじめから', function () { tg.hist = []; go('textgen'); }, 'ef-btn'));

    var candBox;
    if (ended) {
      var isOld = LM.inData(model, tg.hist);
      candBox = h('div', { class: 'result ' + (isOld ? 'info' : 'warn') },
        isOld ? '学習データにある文と同じ文ができました。' : '学習データにない、新しい文ができました！ 言葉のつながりは学習データのとおりなのに、文としては新しい文です。');
    } else {
      var ctx = cand.context.length ? '「' + cand.context.join(' ') + '」のあと' : '文のはじめ';
      candBox = h('div', null,
        h('p', { class: 'small-title' }, 'つぎの言葉の候補(' + ctx + 'に来た言葉)', cand.used && cand.used < tg.order ? h('span', { class: 'muted', text: '　※2語の組み合わせがないので1語で見ています' }) : null),
        list.length ? h('table', { class: 'prob' },
          h('thead', null, h('tr', null, h('th', { text: '言葉(おすとえらべる)' }), h('th', { text: 'えらばれる割合' }), h('th', { class: 'num', text: '' }), h('th', { class: 'num', text: '学習データで' }))),
          h('tbody', null, list.slice(0, 10).map(function (c) {
            return h('tr', null,
              h('th', { scope: 'row' }, h('button', { type: 'button', class: 'word-btn', on: { click: function () { tg.hist.push(c.word); finishCheck(model); go('textgen'); } } }, c.word)),
              h('td', null, bar(c.q)), h('td', { class: 'num', text: pct(c.q) }), h('td', { class: 'num', text: c.count + '回' }));
          }))) : h('p', { class: 'muted', text: '候補がありません。' }),
        list.length > 10 ? h('p', { class: 'muted', text: 'ほかに ' + (list.length - 10) + ' こ' }) : null);
    }

    el.appendChild(card('文を作る', sentence, tg.hist.length ? null : startRow, actions, candBox));

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

  // ================= 4 もっともらしいまちがい =================
  var hs = { order: 2, results: [], judged: {}, marks: {}, revealed: {} };
  function renderHalluc(el) {
    var model = LM.buildModel(D.corpora.ichiban.sentences);
    append(el, h('p', { class: 'lead' }, '生成AIは、本当のことのように見えるまちがいを答えることがあります。これを',
      h('b', { text: 'ハルシネーション' }), '(もっともらしいまちがい)といいます。なぜ起きるのかを、ミニ文章AIでたしかめます。'));

    // A: ミニAIで
    var resList = h('ul', { class: 'gen-list' }, hs.results.map(function (r, i) {
      var j = hs.judged[i];
      var row = h('li', { class: 'gen-row' },
        h('span', { class: 'badge ' + (r.old ? 'gray' : 'orange'), text: r.old ? '学習データと同じ' : '新しい文' }),
        h('span', { class: 'gen-text', text: r.text }));
      if (!r.old) {
        if (!j) {
          row.appendChild(h('span', { class: 'judge' }, h('span', { class: 'muted', text: 'この文は' }),
            btn('本当', function () { hs.judged[i] = 'true'; go('halluc'); }), btn('まちがい', function () { hs.judged[i] = 'false'; go('halluc'); })));
        } else {
          row.appendChild(h('span', { class: 'judge-res ' + (j === 'false' ? 'ok' : 'ng'), text: j === 'false' ? '○ そのとおり。事実ではありません' : '× じつは事実ではありません' }));
        }
      }
      return row;
    }));
    el.appendChild(card('A ミニ文章AIに「日本のいちばん」を学習させる',
      h('p', { text: '学習データは、本当のこと(事実)だけの8本の文です。' }),
      h('ol', { class: 'data-list' }, model.sentences.map(function (s) { return h('li', { text: s.join(' ') }); })),
      h('div', { class: 'controls' },
        h('div', { class: 'ctl' }, h('span', { class: 'ctl-label', text: '前の言葉をいくつ見る？' }),
          segmented([[1, '1語'], [2, '2語']], hs.order, function (v) { hs.order = v; go('halluc'); }, '前の言葉をいくつ見るか'))),
      h('div', { class: 'row' }, btn('文を10本つくる', function () {
        hs.results = []; hs.judged = {};
        for (var k = 0; k < 10; k++) {
          var t = LM.generate(model, { order: hs.order, temperature: 1 });
          hs.results.push({ text: t.join(''), old: LM.inData(model, t) });
        }
        go('halluc');
      }, 'ef-btn-primary')),
      hs.results.length ? resList : null,
      hs.results.length ? h('p', { class: 'muted', text: '「新しい文」は、本当かまちがいか、自分で考えてからボタンをおしてください。' }) : null));
    if (hs.results.length) {
      var nNew = hs.results.filter(function (r) { return !r.old; }).length;
      el.appendChild(h('div', { class: 'result warn' },
        '10本のうち ' + nNew + ' 本が「新しい文」でした。学習データは本当のことだけなのに、新しい文はどれも事実ではありません。AIは「富士山 は 日本 で いちばん」のあとに「大きい」「長い」も来ることを覚えているので、つなぎ方によっては、自然に読めるまちがいの文ができます。'));
    }

    // B: AIの答えチェック
    var B = card('B AIの答えをチェックしよう',
      h('p', { text: 'AIチャットの答え(の例)です。あやしいと思う文をおして、印をつけてから「答え合わせ」をおしてください。' }));
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
                on: { click: function () { hs.marks[key] = !marked; go('halluc'); } } }, ln.t),
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
        h('li', { text: 'AIは「本当かどうか」を調べて文を作っているのではなく、「続きやすい言葉のならび」を作っています。だから、すらすら読める文でも、まちがっていることがあります。' }),
        h('li', { text: 'とくに、数字・年・人名・本や記事の名前・URL はまちがいやすい所です。' }),
        h('li', { text: 'たしかめ方: 教科書・図鑑・辞書、公式のサイトなど、もとの情報で調べる。何か所かでくらべる。わからなければ先生や大人に聞く。' }))));
  }

  // ================= 5 ノイズをまぜる =================
  var ns = { pic: 0, level: 40, seed: 7, game: null };
  function renderNoise(el) {
    var z = IM.noise(LM.seeded(ns.seed));
    var p = pictures[ns.pic];
    append(el, h('p', { class: 'lead', text: '画像をつくるAIは、学習のときに「絵にノイズ(ざらざら)をまぜたもの」から「もとの絵」を当てる練習を、何億回もします。まずは、絵にノイズをまぜてみましょう。' }));

    var big = pixCanvas(256, IM.addNoise(p.x, z, sigmaOf(ns.level)), p.label + 'にノイズをまぜた絵');
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
      gameCard.appendChild(btn('練習をはじめる', function () { ns.game = newRound(0, 0, 0); go('noise'); }, 'ef-btn-primary'));
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
      h('p', { text: 'AIは、ノイズが少しのときも、多いときも、「もとの絵はこうだったはず」と予想する練習をくり返します。この練習ができるようになると、ノイズだけの画面からでも、少しずつ絵を作れるようになります(つぎのステップ)。' })));
  }
  function sigmaOf(level) { return 1.6 * level / 100; }
  function newRound(round, score) {
    var r = LM.seeded(round * 31 + score * 7 + Date.now() % 1000);
    return { round: round, score: score, answer: Math.floor(r() * pictures.length), seed: Math.floor(r() * 9999) + 1, level: [50, 70, 85, 95, 100][round], chosen: null };
  }

  // ================= 6 ノイズから絵をつくる =================
  var STEPS = 20;
  var gs = { word: 'ねこ', word2: '', mix: 0.5, k: 0, x: null, x0: null, weights: null, sched: IM.schedule(STEPS, 1.6, 0.04), rnd: null, running: false };
  function resetGen() {
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
    append(el, h('p', { class: 'lead', text: 'ノイズだけの画面から、AIが「こうなるはず」と予想しながら、少しずつノイズを取りのぞいて絵にします。どんな絵にするかは「ことば(プロンプト)」で決めます。' }));

    var promptWords = gs.word ? (gs.word2 && gs.word2 !== gs.word ? [gs.word, gs.word2] : [gs.word]) : [];
    var wordsRow = h('div', { class: 'ctl' }, h('span', { class: 'ctl-label', text: 'ことば(プロンプト)' }),
      segmented(D.pictureWords.map(function (w) { return [w, w]; }).concat([['', 'ことばなし']]), gs.word, function (v) { gs.word = v; if (!v) gs.word2 = ''; resetGen(); go('imggen'); }, 'ことば'));
    var mixRow = h('div', { class: 'ctl' }, h('span', { class: 'ctl-label', text: 'もう1つまぜる' }),
      segmented([['', 'まぜない']].concat(D.pictureWords.filter(function (w) { return w !== gs.word; }).map(function (w) { return [w, w]; })), gs.word2, function (v) { gs.word2 = v; resetGen(); go('imggen'); }, 'もう1つのことば'));
    var mixIn = h('input', { id: 'mix', type: 'range', min: '0.1', max: '0.9', step: '0.1', value: String(gs.mix), 'aria-label': 'まぜる割合' });
    mixIn.addEventListener('change', function () { gs.mix = Number(mixIn.value); resetGen(); go('imggen'); });

    var canvasNow = pixCanvas(256, gs.x, 'いまの絵');
    var canvasPred = pixCanvas(128, gs.x0 || new Float32Array(IM.DIM), 'AIの予想');
    var stepOut = h('p', { class: 'stats' });
    var weightsBox = h('div', { class: 'weights' });
    var msg = h('div', { 'aria-live': 'polite' });

    function refresh() {
      paint(canvasNow, gs.x);
      if (gs.x0) paint(canvasPred, gs.x0);
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
        if (d < 0.08) msg.appendChild(h('div', { class: 'result warn', text: '学習した「' + pictures[best].label + '」とほとんど同じ絵ができました。学習した絵が少ないと、学習データをそのまま出してしまうことがあります。だれかの作品にそっくりな絵は、勝手に使えません(著作権)。' }));
        else msg.appendChild(h('div', { class: 'result info', text: '学習データにない、新しい絵ができました。いちばん近いのは「' + pictures[best].label + '」です。いくつかの絵がまざると、ふしぎな絵になることもあります(画像のハルシネーション)。' }));
      }
    }
    function run() {
      if (gs.running) return;
      if (gs.k >= STEPS) { resetGen(); }
      gs.running = true;
      var t = setInterval(function () {
        if (!genStep()) { clearInterval(t); gs.running = false; }
        refresh();
      }, reduceMotion ? 30 : 140);
      timers.push(t);
    }

    el.appendChild(h('div', { class: 'controls' }, wordsRow, gs.word ? mixRow : null,
      gs.word2 && gs.word ? h('label', { class: 'ctl' }, h('span', { class: 'ctl-label', text: gs.word + ' ↔ ' + gs.word2 }), mixIn) : null));
    el.appendChild(h('p', { class: 'muted' }, 'プロンプトもトークンにして番号でわたします: ',
      promptWords.length ? promptWords.map(function (w) { return w + ' → ' + LM.tokenize(w, vocab)[0].id; }).join('、') : '(ことばなし)'));

    el.appendChild(card(null,
      h('div', { class: 'gen-grid' },
        h('figure', { class: 'gen-now' }, canvasNow, h('figcaption', { text: 'いまの絵' })),
        h('div', { class: 'gen-side' },
          h('figure', null, canvasPred, h('figcaption', { text: 'AIの予想(ノイズを全部取ったら、こうなるはず)' })),
          stepOut,
          h('div', { class: 'row' },
            btn('1ステップ進める', function () { if (gs.k >= STEPS) resetGen(); genStep(); refresh(); }),
            btn('最後まで自動 ▶', run, 'ef-btn-primary'),
            btn('新しいノイズから', function () { clearTimers(); resetGen(); refresh(); })))),
      msg,
      h('p', { class: 'small-title', text: 'AIがお手本にしている学習した絵(いまの絵に近いほど重く見る)' }),
      weightsBox));
    refresh();

    el.appendChild(point('ためしてみよう',
      h('ul', null,
        h('li', { text: '同じ「ねこ」でも、「新しいノイズから」をおすたびに、茶とら・グレーのどちらになるかが変わります。はじめのノイズで決まります。' }),
        h('li', { text: '「ねこ」と「家」をまぜると、どんな絵になる？ 本物の画像AIも、学習していない組み合わせをたのむと、ふしぎな絵(指が6本の手など)を作ることがあります。' }),
        h('li', { text: 'この模型が学習した絵は6枚だけです。本物の画像AIは何億枚もの絵から学ぶので、いろいろな絵を作れますが、学習した作品に似た絵が出ることもあります。' }))));
  }

  // ================= 7 個人情報 =================
  var ps = { pick: { name: 0, school: -1, phone: 0, address: -1 }, sent: false, out: null, sendJudge: {} };
  function privacySentences() {
    return D.privacyChoices.filter(function (c) { return ps.pick[c.key] >= 0; }).map(function (c) {
      return c.template.replace('{v}', c.values[ps.pick[c.key]]);
    });
  }
  function renderPrivacy(el) {
    append(el, h('p', { class: 'lead', text: '生成AIのサービスによっては、入力した内容が記録として残ったり、AIの学習に使われたりします。そのとき何が起きるかを、ミニ文章AIでたしかめます。' }));

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
      ps.sent ? h('div', { class: 'result info', text: '送りました。この会話は、AIの学習データに入りました(という設定です)。' })
        : btn('AIに送る', function () { ps.sent = true; ps.out = null; go('privacy'); }, 'ef-btn-primary'));
    el.appendChild(step1);

    if (ps.sent) {
      var model = LM.buildModel(D.chatBase.concat(privacySentences()));
      var prompts = [['name', ['わたし', 'の', '名前', 'は']], ['phone', ['わたし', 'の', '電話番号', 'は']], ['address', ['わたし', 'の', '住所', 'は']],
        ['school', ['わたし', 'の', '学校', 'は']], ['', ['わたし', 'の', '好きな']]];
      var step2 = card('② 後日、Bさんが同じAIを使うと…',
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
        var text = ps.out.toks.join('');
        var leaked = privacySentences().some(function (s) { return s.replace(/ /g, '') === text; }) && !/好きな/.test(text);
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
        else if (ps.out.key && !entered) step2.appendChild(h('div', { class: 'result ok', text: 'Aさんはこの情報を入れなかったので、Aさんの情報は出てきません。そのかわりAIは、よく出てくる言葉でそれらしくうめました(これもハルシネーションです)。' }));
        else step2.appendChild(h('div', { class: 'result info', text: 'みんながよく入れる言葉から、続きが作られました。' }));
      }
      step2.appendChild(h('div', { class: 'row' }, btn('はじめからやり直す', function () { ps.sent = false; ps.out = null; go('privacy'); })));
      el.appendChild(step2);
    }

    var step3 = card('③ 送る前チェック',
      h('p', { text: 'つぎの文をAIに送ってもよいか、えらんでください。' }),
      h('ul', { class: 'send-list' }, D.sendCheck.map(function (s, i) {
        var j = ps.sendJudge[i];
        return h('li', { class: 'send-row' },
          h('span', { class: 'send-text', text: s.t }),
          j == null ? h('span', { class: 'judge' }, btn('送ってOK', function () { ps.sendJudge[i] = true; go('privacy'); }), btn('直す', function () { ps.sendJudge[i] = false; go('privacy'); }))
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

  // ================= 8 クイズとふりかえり =================
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
      el.appendChild(btn('クイズをやり直す', function () { qs.ans = {}; go('quiz'); }));
    }

    var refl = saved.refl || {};
    var qsR = [
      ['r1', '文章をつくるAIと、画像をつくるAIは、それぞれどうやって作っていましたか。'],
      ['r2', 'ハルシネーションや個人情報について、生成AIを使うときに気をつけたいことは何ですか。'],
      ['r3', '生成AIを、どんな場面で、どのように使ってみたいですか。']
    ];
    var status = h('p', { class: 'muted', 'aria-live': 'polite', text: '書いた内容は、この端末のブラウザの中だけに保存されます。' });
    el.appendChild(card('ふりかえり', qsR.map(function (r) {
      var ta = h('textarea', { id: 'refl-' + r[0], class: 'input', rows: 3 });
      ta.value = refl[r[0]] || '';
      ta.addEventListener('input', function () { refl[r[0]] = ta.value; save('refl', refl); status.textContent = '保存しました(この端末の中だけ)。'; });
      return h('label', { class: 'refl' }, h('span', { class: 'ctl-label', text: r[1] }), ta);
    }), status, h('p', { class: 'muted', text: '提出のしかたは、先生の指示にしたがってください。' })));
  }

  // ---- 表示の切りかえ(ふりがな・大きな文字) ----
  function setupToggles() {
    var tools = document.getElementById('display-toggles');
    [['furigana', 'ふりがな', 'show-ruby'], ['big', '大きな文字', 'big-text']].forEach(function (t) {
      var on = !!saved[t[0]];
      document.documentElement.classList.toggle(t[2], on);
      var b = h('button', { type: 'button', class: 'ef-btn', 'aria-pressed': String(on) }, t[1]);
      b.addEventListener('click', function () {
        on = !on;
        save(t[0], on);
        b.setAttribute('aria-pressed', String(on));
        document.documentElement.classList.toggle(t[2], on);
      });
      tools.appendChild(b);
    });
  }

  buildNav();
  setupToggles();
  window.addEventListener('hashchange', route);
  route();
})();
