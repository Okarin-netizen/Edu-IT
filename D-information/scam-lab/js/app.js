// ネット詐欺 追体験ラボ: 画面
(function () {
  'use strict';
  var D = ScamData, E = ScamEngine;
  var APP = 'ネット詐欺 追体験ラボ';
  // 振り返りを隠す設定(先生用。shared/eduit-frame.js)。隠すときは、まとめの振り返り欄・記録の振り返りを出さない
  var FK_OFF = !!(window.EduitFrame && EduitFrame.furikaeri === false);

  if (window.EDUIT_INFO) {
    EDUIT_INFO.app = EDUIT_INFO.app || { name: APP };
    EDUIT_INFO.app.safety = [
      'ネット詐欺 追体験ラボのサイト・メール・SNSの画面は、学習のために作った模型です。会社名・サイト名・アドレス・電話番号・口座番号はすべて架空で、押してもどこにも移動せず、どこにも連絡しません。',
      '名前やカード番号などを入力する場所はありません(入力欄は見た目だけです)。'
    ];
  }

  // ---- 端末の中だけの保存(使えなくても動く) ----
  var KEY = 'eduit-scam-lab';
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
  function btn(label, onClick, cls) { return h('button', { type: 'button', class: cls || 'ef-btn', on: { click: onClick } }, label); }
  function point(title) {
    var kids = Array.prototype.slice.call(arguments, 1);
    return h('div', { class: 'point' }, h('p', { class: 'point-title', text: title }), kids);
  }
  function card(title) {
    var kids = Array.prototype.slice.call(arguments, 1);
    return h('section', { class: 'panel card' }, title ? h('h2', { class: 'panel-title' }, title) : null, kids);
  }
  // 振り返りを隠す設定のとき出さない要素の印
  function reflectOnly(e) { e.setAttribute('data-ef-reflect', ''); return e; }

  // ふりがな: 表示したあとの画面の文字に、RUBY の言葉があれば <ruby> を付ける(長い言葉が先)
  var RUBY = {
    '詐欺': 'さぎ', '請求': 'せいきゅう', '契約': 'けいやく', '登録': 'とうろく', '料金': 'りょうきん', '振込み': 'ふりこみ', '振込': 'ふりこみ', '振り込': 'ふりこ',
    '相談': 'そうだん', '個人情報': 'こじんじょうほう', '確認': 'かくにん', '削除': 'さくじょ', '添付': 'てんぷ', '感染': 'かんせん',
    '警告': 'けいこく', '当選': 'とうせん', '公式': 'こうしき', '差出人': 'さしだしにん', '履歴': 'りれき', '閲覧': 'えつらん', '通知': 'つうち',
    '遠隔操作': 'えんかくそうさ', '被害': 'ひがい', '架空': 'かくう', '端末': 'たんまつ', '記録': 'きろく', '保存': 'ほぞん', '番号': 'ばんごう',
    '手順': 'てじゅん', '判断': 'はんだん', '返信': 'へんしん', '転送': 'てんそう', '応募': 'おうぼ', '抽選': 'ちゅうせん', '送料': 'そうりょう',
    '商品': 'しょうひん', '特定商取引法': 'とくていしょうとりひきほう', '評判': 'ひょうばん', '検索': 'けんさく', '口座': 'こうざ',
    '解除': 'かいじょ', '再起動': 'さいきどう', '有効化': 'ゆうこうか', '消費者': 'しょうひしゃ', '手口': 'てぐち', '体験': 'たいけん',
    '入力': 'にゅうりょく', '画面': 'がめん', '情報': 'じょうほう', '支払': 'しはら', '退会': 'たいかい', '延滞': 'えんたい', '法的': 'ほうてき',
    '期限': 'きげん', '演出': 'えんしゅつ', '撮影': 'さつえい', '提出': 'ていしゅつ', '授業': 'じゅぎょう', '設定': 'せってい',
    '迷惑': 'めいわく', '報告': 'ほうこく', '表示': 'ひょうじ', '全画面': 'ぜんがめん', '電子': 'でんし', '流出': 'りゅうしゅつ',
    '販売業者': 'はんばいぎょうしゃ', '所在地': 'しょざいち', '特徴': 'とくちょう', '連絡': 'れんらく', '名義': 'めいぎ', '在庫': 'ざいこ',
    '書き出': 'かきだ', '組': 'くみ', '状況': 'じょうきょう', '確': 'たし', '押': 'お'
  };
  var RUBY_KEYS = Object.keys(RUBY).filter(function (k) { return k.length > 1; }).sort(function (a, b) { return b.length - a.length; });
  var RUBY_RE = new RegExp(RUBY_KEYS.join('|'), 'g');
  function applyRuby(root) {
    if (!saved.furigana) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode;
        if (!p || p.closest('ruby, textarea, select, option, script, style, .no-ruby, .ef-footer')) return NodeFilter.FILTER_REJECT;
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

  // ---- 場面ごとの状態 ----
  function scState(sc) {
    var all = saved.sc || {};
    var st = all[sc.id];
    if (!st || !sc.nodes[st.node]) st = E.init(sc);
    return st;
  }
  function setScState(sc, st) {
    var all = saved.sc || {};
    all[sc.id] = st;
    save('sc', all);
  }

  // ---- ページ ----
  var timers = [];
  function clearTimers() { timers.forEach(clearInterval); timers = []; }

  var SECTIONS = [{ id: 'intro', group: '', no: '', icon: '⌂', title: 'はじめに', render: renderIntro }]
    .concat(D.scenarios.map(function (sc) {
      return { id: sc.id, group: '詐欺を体験する', no: sc.no, min: sc.min, title: sc.title, desc: sc.desc, sc: sc, render: renderScenario };
    }))
    .concat([
      { id: 'matome', group: 'まとめる', no: '6', min: '10分', title: FK_OFF ? 'まとめ' : 'まとめとふりかえり', desc: 'どの詐欺にも共通する手口と、自分の行動のしかたをまとめる', render: renderMatome },
      { id: 'records', group: '記録する', no: '', icon: '✎', title: FK_OFF ? '記録' : 'ふりかえり・記録', render: renderRecordsPage }
    ]);
  // 画面に出す番号は丸数字(label)。no は並びの番号(ステップかどうかの印にも使う)
  SECTIONS.forEach(function (x) { x.label = x.no ? '①②③④⑤⑥⑦⑧⑨'.charAt(Number(x.no) - 1) : ''; });
  var STEP_SECTIONS = SECTIONS.filter(function (x) { return x.no; });
  // できた印を付けるステップ(まとめは振り返りを書くとできた印。振り返りを隠すときは数えない)
  var DONE_SECTIONS = STEP_SECTIONS.filter(function (x) { return !(FK_OFF && x.id === 'matome'); });
  var view = document.getElementById('view');
  var nav = document.getElementById('nav');
  var current = null;

  function isDone(s) {
    if (s.sc) return !!scState(s.sc).cleared;
    if (s.id === 'matome') { var r = saved.refl || {}; return D.reflQ.some(function (q) { return String(r[q.id] || '').trim(); }); }
    return false;
  }
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
        h('span', null, s.title, s.no ? h('span', { class: 'visually-hidden nav-done', hidden: true, text: '(できた)' }) : null))));
    });
    nav.textContent = '';
    nav.appendChild(h('nav', { 'aria-label': 'ステップ' }, ol));
  }
  // 上のバーの「進み具合」: クリアした場面と、まとめ(ふりかえり)の割合
  function renderOverall() {
    var done = DONE_SECTIONS.filter(isDone).length;
    var p = Math.round(done / DONE_SECTIONS.length * 100);
    var el = document.getElementById('overall-progress');
    if (!el) return;
    el.textContent = '';
    append(el, [h('span', { text: '進み具合' }),
      h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(p), 'aria-label': '全体の進み具合' },
        h('span', { class: 'bar-fill', style: 'width:' + p + '%' })),
      h('span', { text: p + '%' })]);
  }
  function markNav() {
    Array.prototype.forEach.call(nav.querySelectorAll('.nav-link'), function (a) {
      var sec = SECTIONS.filter(function (x) { return x.id === a.getAttribute('data-id'); })[0];
      var done = !!(sec && sec.no && DONE_SECTIONS.indexOf(sec) >= 0 && isDone(sec));
      a.classList.toggle('is-done', done);
      a.parentNode.classList.toggle('done', done);
      a.querySelector('.num').textContent = done ? '✓' : (sec.no || sec.icon);
      var hid = a.querySelector('.nav-done');
      if (hid) hid.hidden = !done;
    });
    renderOverall();
  }

  // 同じページの中の操作では、スクロールの位置とキーボードの位置を保ったまま描き直す
  function focusables() { return Array.prototype.slice.call(view.querySelectorAll('button, input, select, textarea, a[href]')); }
  var afterDraw = null;
  function rerender() {
    var y = window.scrollY;
    var fi = focusables().indexOf(document.activeElement);
    clearTimers();
    draw(current);
    window.scrollTo(0, y);
    if (afterDraw) { var f = afterDraw; afterDraw = null; f(); return; }
    if (fi >= 0) {
      var list = focusables();
      var el = null;
      for (var i = Math.min(fi, list.length - 1); i < list.length && !el; i++) if (!list[i].disabled) el = list[i];
      if (el) try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
    }
  }
  function show(id) {
    var s = SECTIONS.filter(function (x) { return x.id === id; })[0] || SECTIONS[0];
    clearTimers();
    current = s;
    escAct = null;
    draw(s);
    save('last', s.id);
    if (s.no) save('lastStep', s.id);
    markNav();
    window.scrollTo(0, 0);
    document.title = (s.id === 'intro' ? 'はじめに' : s.title) + ' | ' + APP;
  }
  function draw(s) {
    escAct = null;
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
    s.render(body, s);
    var prev = SECTIONS[idx - 1];
    var next = SECTIONS[idx + 1];
    if (s.id !== 'intro') {
      view.appendChild(h('nav', { class: 'pager btn-row', 'aria-label': 'ページの移動' },
        prev ? h('a', { class: 'ef-btn', href: '#' + prev.id }, prev.no ? '← 前のステップ' : '← ' + prev.title) : null,
        next ? h('a', { class: 'ef-btn-primary', href: '#' + next.id }, '次へ：' + next.title + ' →') : null));
    }
    applyRuby(view);
  }
  function route() {
    var id = (location.hash || '').replace('#', '');
    if (!id) id = saved.last || 'intro';
    show(id);
  }

  // ================= はじめに =================
  function renderIntro(el) {
    var last = SECTIONS.filter(function (x) { return x.no && x.id === saved.lastStep; })[0];
    append(el, [
      h('div', { class: 'module-head' },
        h('h1', { class: 'sec-title', text: APP }),
        h('p', { class: 'meta' }, 'インターネットの詐欺を、スマホやパソコンの画面を自分で操作して「追体験」します。だまされそうになったとき、正しい手順を最後までやりきれたらクリアです。'),
        h('p', { class: 'muted author', text: '作成：羽生市立南中学校 技術 岡田' })),
      h('section', { class: 'card' },
        h('h2', { text: '遊び方' }),
        h('ol', null,
          h('li', { text: '左の画面は、あなたのスマホやパソコン。画面の中のボタンも押せます(押すと、だまされることもあります)。' }),
          h('li', { text: '右の「あなたの行動」から、つぎにどうするかをえらびます。' }),
          h('li', { text: '「やることリスト」の「？」を全部うめて、最後の行動までやりきるとクリア。こまったら「ヒント」を押そう。' }),
          h('li', { text: 'だまされたら、どうなったかを読んで、その前の場面からやり直せます。だまされても本当には何も起きません。「押したらどうなるか」を確かめるのも学習です。' })),
        point('安心して体験できます',
          h('p', { text: 'この教材はブラウザの中だけで動き、インターネットには一切つながりません。出てくる会社・サイト・アドレス・電話番号・口座はすべて架空で、押してもどこにも連絡しません。入力欄は見た目だけで、何も入力できません。' }))),
      h('section', { class: 'module-group' },
        h('h2', { text: 'ステップ' }),
        h('div', { class: 'module-grid' }, STEP_SECTIONS.map(function (x) {
          var done = isDone(x);
          return h('a', { class: 'module-card', href: '#' + x.id },
            h('span', { class: 'mc-num', text: x.group + '・ステップ' + x.label + '・目安 ' + x.min }),
            h('span', { class: 'mc-title', text: x.title }),
            h('span', { class: 'mc-desc', text: x.desc }),
            h('span', { class: 'mc-state' + (done ? ' is-done' : ''), 'data-ef-reflect': x.sc ? null : '', text: done ? (x.sc ? '✓ クリア' : '✓ 書いた') : 'まだ' }));
        }))),
      h('div', { class: 'btn-row home-start' },
        h('a', { class: 'ef-btn-primary', href: '#oneclick', text: 'ステップ① ワンクリック詐欺からはじめよう →' }),
        last && last.id !== 'oneclick' ? h('a', { class: 'ef-btn', href: '#' + last.id, text: 'つづきから：' + last.title + ' →' }) : null),
      h('details', { class: 'teacher' },
        h('summary', { text: '先生へ' }),
        h('ul', null,
          h('li', { text: '1時間(50分)で、5つの場面(各10分程度)とまとめを行う想定です。時間がないときは、1・3・4 を中心にし、2・5 は家庭学習にできます。' }),
          h('li', { text: '情報セキュリティ体験ラボの「フィッシング見分け」(メールのどこが怪しいかを見つける)・「判断ロールプレイ」(DM・アプリの権限・パスワード)とは場面が重なりません。こちらは、だまされる画面を自分で操作し、正しい手順を最後までやりきる体験です。続けて使うと、「見分ける → 行動する」の流れになります。' }),
          h('li', { text: 'クリアした場面・だまされた回数・ヒントを使った回数・ふりかえりは、この端末のブラウザの中にだけ保存されます。「ふりかえり・記録」から JSON で書き出し、振り返り一覧(先生用)で読み込めます。' }),
          h('li', { text: '次の人に端末をわたすときは、「ふりかえり・記録」のいちばん下の「はじめからやり直す」で記録を消せます。ふりがな・文字の大きさの設定は残ります。' })))
    ]);
  }

  // ================= 場面 =================
  function renderScenario(el, s) {
    var sc = s.sc;
    var st = scState(sc);
    function set(n) { setScState(sc, n); markNav(); rerender(); }
    function doAct(a) {
      var n = E.apply(sc, st, a, new Date().toISOString());
      // スクロールの動きは描き直す前に決めておく(描き直しのすぐあとに動く)
      if (n.end || n.node !== st.node) {
        afterDraw = function () {
          var t = document.getElementById('scene-top');
          if (t) { t.scrollIntoView({ block: 'start' }); var f = t.querySelector('h2, .end-title'); if (f) { f.setAttribute('tabindex', '-1'); f.focus({ preventScroll: true }); } }
        };
      } else if (n.msg) {
        afterDraw = function () { var m = document.getElementById('scene-msg'); if (m) m.scrollIntoView({ block: 'nearest' }); };
      }
      set(n);
    }

    // はじめる前: 状況とめあて
    if (!st.started) {
      append(el, [
        card('状況', h('p', { class: 'lead', text: sc.story }),
          point('めあて', h('p', { text: sc.goal })),
          h('p', { class: 'muted', text: (sc.device === 'pc' ? 'パソコン' : 'スマホ') + 'の画面を操作します。やることは ' + sc.steps.length + ' つ。全部やりきるとクリアです。' }),
          h('div', { class: 'btn-row' }, btn('体験をはじめる', function () { var n = Object.assign({}, st, { started: true }); set(n); }, 'ef-btn-primary'))),
        st.cleared ? h('p', { class: 'result ok', text: '✓ この場面はクリアしています。もう一度体験できます。' }) : null
      ]);
      return;
    }

    var wrap = h('div', { class: 'scene', id: 'scene-top' });
    el.appendChild(wrap);
    if (st.end) {
      wrap.appendChild(renderEnd(sc, st, set));
      return;
    }
    var node = sc.nodes[st.node];
    var list = E.acts(sc, st.node);
    var byId = {};
    list.forEach(function (a) { if (a.id) byId[a.id] = a; });
    var screenAct = function (id) { return function () { if (byId[id]) doAct(byId[id]); }; };
    escAct = byId.esc && !(byId.esc.step && st.done[byId.esc.step]) ? function () { doAct(byId.esc); } : null;

    timerKey = sc.id + ':' + st.node;
    var device = renderDevice(sc, node.screen, st, screenAct);
    var side = h('div', { class: 'scene-side' },
      h('section', { class: 'card situation' }, h('h2', { class: 'panel-title', text: 'いまの状況' }), h('p', { text: node.say })),
      st.msg ? h('div', { id: 'scene-msg', class: 'result ' + ({ good: 'ok', meh: 'warn', need: 'warn', info: 'info' }[st.msg.tone] || 'info'), role: 'status' },
        h('span', { class: 'msg-label', text: { good: 'よい判断！ ', meh: 'うーん… ', need: 'ちょっと待って ', info: '' }[st.msg.tone] || '' }), st.msg.text) : null,
      h('section', { class: 'card actions' },
        h('h2', { class: 'panel-title', text: 'あなたの行動' }),
        h('div', { class: 'act-list' }, mix(list.filter(function (a) { return a.panel !== false; }), sc.id + ':' + st.node).map(function (a) {
          var did = a.step && st.done[a.step] && !a.to;
          return h('button', { type: 'button', class: 'act' + (did ? ' did' : ''), disabled: did, on: { click: function () { doAct(a); } } },
            did ? h('span', { class: 'act-mark', text: '✓ ' }) : null, a.label);
        }))),
      renderChecklist(sc, st, function () {
        var n = E.useHint(sc, st);
        // いまの画面でできることがないときは、状況の文を手がかりにする
        var ns = E.nextStep(sc, st);
        if (ns && !list.some(function (a) { return a.step === ns.id; })) n.hint = node.say + '(「あなたの行動」か画面の中から、つぎに進もう)';
        set(n);
      }));
    wrap.appendChild(h('div', { class: 'scene-grid' }, device, side));
    wrap.appendChild(h('div', { class: 'btn-row scene-tools' },
      btn('この場面をはじめから', function () { resetTimers(sc); set(E.restart(sc, st)); }, 'ef-btn small')));
  }

  function renderChecklist(sc, st, onHint) {
    var left = sc.steps.filter(function (x) { return !st.done[x.id]; }).length;
    return h('section', { class: 'card checklist' },
      h('h2', { class: 'panel-title', text: 'やることリスト' }),
      h('p', { class: 'muted', text: left ? 'あと ' + left + ' つ。「？」は、やると中身がわかります。' : '全部できた！' }),
      h('ol', { class: 'steps' }, sc.steps.map(function (x) {
        var done = !!st.done[x.id];
        return h('li', { class: done ? 'is-done' : '' }, h('span', { class: 'step-mark', 'aria-hidden': 'true', text: done ? '✓' : '？' }),
          h('span', { text: done ? x.label : '？？？' }), done ? null : h('span', { class: 'visually-hidden', text: '(まだ)' }));
      })),
      left ? h('div', { class: 'btn-row' }, btn('💡 ヒント', onHint, 'ef-btn small')) : null,
      st.hint ? h('p', { class: 'hint-text', role: 'status', text: 'ヒント: ' + st.hint }) : null);
  }

  function renderEnd(sc, st, set) {
    var e = sc.ends[st.end];
    if (e.type === 'bad') {
      return h('section', { class: 'end-card bad' },
        h('p', { class: 'end-badge', text: '✗ だまされてしまった' }),
        h('h2', { class: 'end-title', text: e.title }),
        h('div', { class: 'end-block' }, h('h3', { text: 'どうなった？' }), h('p', { text: e.text })),
        point('どうすればよかった？', h('p', { text: e.lesson })),
        h('p', { class: 'muted', text: '※ これは体験です。本当には何も起きていません。' }),
        h('div', { class: 'btn-row' },
          btn('その前の場面にもどって、やり直す', function () { set(E.back(sc, st)); }, 'ef-btn-primary'),
          btn('この場面をはじめから', function () { resetTimers(sc); set(E.restart(sc, st)); })));
    }
    var idx = D.scenarios.indexOf(sc);
    var nextSc = D.scenarios[idx + 1];
    return h('section', { class: 'end-card clear' },
      h('p', { class: 'end-badge', text: '★ クリア！' }),
      h('h2', { class: 'end-title', text: sc.title + 'から、安全にぬけ出せた！' }),
      h('p', { class: 'muted', text: 'だまされた回数: ' + st.misses + ' 回 ・ ヒント: ' + st.hints + ' 回' }),
      h('div', { class: 'end-block' }, h('h3', { text: '正しい手順' }),
        h('ol', null, sc.steps.map(function (x) { return h('li', { text: x.label }); }))),
      h('div', { class: 'end-block' }, h('h3', { text: 'だます人の手口' }),
        h('ul', null, sc.tricks.map(function (t) { return h('li', { text: t }); }))),
      point('もし、だまされてしまったら', h('p', { text: sc.ifDone })),
      h('div', { class: 'btn-row' },
        nextSc ? h('a', { class: 'ef-btn-primary', href: '#' + nextSc.id, text: 'つぎの場面：' + nextSc.title + ' →' })
          : h('a', { class: 'ef-btn-primary', href: '#matome', text: (FK_OFF ? 'まとめ' : 'まとめとふりかえり') + 'へ →' }),
        btn('この場面をもう一度', function () { resetTimers(sc); set(E.restart(sc, st)); })));
  }

  // ---- スマホ・パソコンの画面 ----
  // カウントダウンは、はじめて出した時から数える(行動して描き直しても、もどらない)
  var timerStart = {};
  var timerKey = '';
  function resetTimers(sc) { Object.keys(timerStart).forEach(function (k) { if (k.indexOf(sc.id + ':') === 0) delete timerStart[k]; }); }
  // いつも同じ順にまぜる(画面ごとに決まった順。描き直しても変わらない)
  function mix(list, seed) {
    var x = 0;
    for (var i = 0; i < seed.length; i++) x = (x * 31 + seed.charCodeAt(i)) >>> 0;
    var a = list.slice();
    for (var j = a.length - 1; j > 0; j--) {
      x = (x * 1103515245 + 12345) >>> 0;
      var k = x % (j + 1), t = a[j];
      a[j] = a[k]; a[k] = t;
    }
    return a;
  }
  var escAct = null;
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && escAct && current && current.sc) { var f = escAct; escAct = null; f(); }
  });
  function fmtTime(sec) {
    var d = Math.floor(sec / 86400), hh = Math.floor(sec % 86400 / 3600), mm = Math.floor(sec % 3600 / 60), ss = sec % 60;
    var p = function (x) { return (x < 10 ? '0' : '') + x; };
    return (d ? d + '日 ' : '') + (d || hh ? p(hh) + ':' : '') + p(mm) + ':' + p(ss);
  }
  function blocks(list, onAct) {
    return (list || []).map(function (b) {
      switch (b.t) {
        case 'h': return h('p', { class: 'sb-h ' + (b.cls || ''), text: b.text });
        case 'p': return h('p', { class: 'sb-p ' + (b.cls || ''), text: b.text });
        case 'btn': return h('button', { type: 'button', class: 'sb-btn ' + (b.cls || ''), on: { click: onAct(b.act) } }, b.text);
        case 'link': return h('button', { type: 'button', class: 'sb-link', on: { click: onAct(b.act) } }, b.text);
        case 'box': {
          var box = h(b.act ? 'button' : 'div', { type: b.act ? 'button' : null, class: 'sb-box ' + (b.cls || ''), on: b.act ? { click: onAct(b.act) } : null },
            b.title ? h('b', { class: 'sb-box-title', text: b.title }) : null,
            b.lines.map(function (l) { return h('span', { class: 'sb-line', text: l }); }));
          return box;
        }
        case 'thumbs': return h('div', { class: 'sb-thumbs' }, b.items.map(function (it) {
          return h('div', { class: 'sb-thumb' }, h('span', { class: 'sb-emoji', 'aria-hidden': 'true', text: it.emoji }), h('span', { text: it.text }));
        }));
        case 'timer': {
          var key = timerKey + ':' + b.label;
          if (!timerStart[key]) timerStart[key] = Date.now();
          var since = function () { return Math.floor((Date.now() - timerStart[key]) / 1000); };
          var left = Math.max(0, b.sec - since());
          var out = h('b', { class: 'sb-timer-v', text: fmtTime(left) });
          timers.push(setInterval(function () { left = Math.max(0, b.sec - since()); out.textContent = fmtTime(left); }, 1000));
          return h('p', { class: 'sb-timer' }, b.label + ' ', out);
        }
        case 'field': return h('div', { class: 'sb-field' }, h('span', { text: b.label }), h('span', { class: 'sb-input', 'aria-hidden': 'true' }));
        case 'table': return h('table', { class: 'sb-table' }, h('tbody', null, b.rows.map(function (r) { return h('tr', null, h('th', { text: r[0] }), h('td', { text: r[1] })); })));
      }
      return null;
    });
  }
  function renderDevice(sc, scr, st, onAct) {
    var inner;
    switch (scr.kind) {
      case 'browser':
        inner = [
          scr.full ? null : scr.app ? h('div', { class: 'sb-appbar', text: scr.app })
            : h('div', { class: 'sb-urlbar no-ruby' }, h('span', { class: 'sb-lock', 'aria-hidden': 'true', text: '🔒' }), h('span', { text: scr.url })),
          h('div', { class: 'sb-page' + (scr.theme ? ' theme-' + scr.theme : '') }, blocks(scr.body, onAct)),
          scr.dialog ? h('div', { class: 'sb-dialog', role: 'group', 'aria-label': scr.dialog.title },
            h('b', { class: 'no-ruby', text: scr.dialog.title }), h('p', { text: scr.dialog.text }),
            h('div', { class: 'sb-dialog-btns' }, scr.dialog.buttons.map(function (x) { return h('button', { type: 'button', class: 'sb-btn', on: { click: onAct(x.act) } }, x.text); }))) : null
        ];
        break;
      case 'mail-list':
        inner = [h('div', { class: 'sb-appbar', text: scr.app || 'メール' }), h('ul', { class: 'sb-mails' }, scr.items.map(function (m) {
          var content = [h('span', { class: 'sb-mail-from' }, m.from, m.clip ? h('span', { class: 'sb-clip', 'aria-label': '添付ファイルあり', text: ' 📎' }) : null, h('span', { class: 'sb-mail-time', text: m.time })),
            h('span', { class: 'sb-mail-subj', text: m.subject })];
          return h('li', { class: m.unread ? 'unread' : '' }, m.act ? h('button', { type: 'button', class: 'sb-mail', on: { click: onAct(m.act) } }, content) : h('div', { class: 'sb-mail' }, content));
        }))];
        break;
      case 'mail': {
        var showAddr = !scr.addrStep || st.done[scr.addrStep];
        inner = [h('div', { class: 'sb-appbar', text: 'メール' }), h('div', { class: 'sb-page sb-mailview' },
          h('p', { class: 'sb-mail-subject', text: scr.subject }),
          h('p', { class: 'sb-mail-head' }, h('b', { text: scr.from }),
            showAddr ? h('span', { class: 'sb-addr no-ruby' + (scr.addrStep ? ' flagged' : ''), text: ' <' + scr.addr + '>' })
              : h('button', { type: 'button', class: 'sb-more', 'aria-label': '差出人のくわしい情報を見る', on: { click: onAct(scr.addrAct) } }, '▼'),
            h('span', { class: 'sb-mail-time', text: scr.time })),
          h('div', { class: 'sb-mail-body' }, scr.body.map(function (l) { return h('p', { text: l }); })),
          (scr.attach || []).map(function (a) {
            return h('button', { type: 'button', class: 'sb-attach', on: { click: onAct(a.act) } }, h('span', { 'aria-hidden': 'true', text: '📎 ' }), a.name, h('span', { class: 'sb-mail-time', text: a.size }));
          }),
          (scr.buttons || []).map(function (b) { return h('button', { type: 'button', class: 'sb-btn big', on: { click: onAct(b.act) } }, b.text); }),
          (scr.links || []).map(function (b) { return h('button', { type: 'button', class: 'sb-link small', on: { click: onAct(b.act) } }, b.text); }))];
        break;
      }
      case 'home':
        inner = [h('div', { class: 'sb-home' },
          h('p', { class: 'sb-clock', text: '19:24' }),
          scr.notice ? h('button', { type: 'button', class: 'sb-notice', on: { click: onAct(scr.notice.act) } },
            h('span', { class: 'sb-notice-app no-ruby', text: '🔔 ' + scr.notice.app }), h('span', { text: scr.notice.text })) : null,
          h('div', { class: 'sb-apps', 'aria-hidden': 'true' }, ['📞', '✉️', '🌐', '📷', '🎵', '⚙️', '🗓️', '🗺️'].map(function (x) { return h('span', { class: 'sb-app', text: x }); })))];
        break;
      case 'sns':
        inner = [h('div', { class: 'sb-appbar', text: 'SNS' }), h('div', { class: 'sb-page sb-feed' }, scr.posts.map(function (p) {
          return h('div', { class: 'sb-post' + (p.ad ? ' ad' : '') },
            h('p', { class: 'sb-post-name' }, p.name, p.ad ? h('span', { class: 'sb-ad', text: '広告' }) : null),
            p.emoji ? h('p', { class: 'sb-post-img', 'aria-hidden': 'true', text: p.emoji }) : null,
            h('p', { text: p.text }),
            p.btn ? h('button', { type: 'button', class: 'sb-btn', on: { click: onAct(p.btn.act) } }, p.btn.text) : null);
        }))];
        break;
      case 'doc':
        inner = [h('div', { class: 'sb-appbar no-ruby', text: '📄 ' + scr.file }),
          h('div', { class: 'sb-docbar' }, h('span', { text: '⚠ ' + scr.bar.text }), h('button', { type: 'button', class: 'sb-btn', on: { click: onAct(scr.bar.btn.act) } }, scr.bar.btn.text)),
          h('div', { class: 'sb-page' }, blocks(scr.body, onAct))];
        break;
      case 'search':
        inner = [h('div', { class: 'sb-urlbar' }, h('span', { 'aria-hidden': 'true', text: '🔍 ' }), h('span', { text: scr.query })),
          h('div', { class: 'sb-page' }, scr.results.map(function (r) {
            return h('div', { class: 'sb-result' }, h('span', { class: 'sb-result-url no-ruby', text: r.url }), h('b', { class: 'sb-result-title', text: r.title }), h('span', { text: r.text }));
          }))];
        break;
      case 'desktop':
        inner = [h('div', { class: 'sb-desktop' }, h('p', { text: '🖥 ' + scr.text }))];
        break;
    }
    return h('div', { class: 'device ' + sc.device + (scr.full ? ' full' : '') },
      h('p', { class: 'visually-hidden', text: (sc.device === 'pc' ? 'パソコン' : 'スマホ') + 'の画面' }),
      h('div', { class: 'device-screen' }, inner));
  }

  // ================= まとめとふりかえり =================
  function renderMatome(el) {
    var refl = saved.refl || {};
    var cleared = D.scenarios.filter(function (sc) { return scState(sc).cleared; }).length;
    append(el, [
      card('どの詐欺にも共通すること',
        h('p', { text: 'ワンクリック詐欺・当選メール・ウイルス付きメール・にせのウイルス警告・にせの通販サイト。見た目はちがっても、だます人のやり方は同じです。' }),
        h('div', { class: 'flow' }, D.common.map(function (c, i) {
          return h('div', { class: 'flow-box' }, h('b', { text: (i + 1) + '. ' + c.title }), h('span', { text: c.text }));
        }))),
      card('あやしいと思ったら、この3つ',
        h('div', { class: 'flow' }, D.rule.map(function (c, i) {
          return [i ? h('span', { class: 'flow-arrow', 'aria-hidden': 'true', text: '→' }) : null,
            h('div', { class: 'flow-box accent' }, h('b', { text: c.title }), h('span', { text: c.text }))];
        })),
        h('p', { class: 'muted', text: '情報セキュリティ体験ラボの「立ち止まる → 確認する → 相談する」と同じ考え方です。' })),
      card(D.consult.title,
        h('p', { text: D.consult.first }),
        h('ul', { class: 'consult' }, D.consult.lines.map(function (l) {
          return h('li', null, h('b', { text: l.name + '　' }), h('span', { class: 'tel', text: l.tel }), h('span', { class: 'muted', text: '　' + l.note }));
        }))),
      reflectOnly(card('ふりかえり',
        h('p', { class: 'muted', text: 'クリアした場面: ' + cleared + ' / ' + D.scenarios.length + '。書いた文は、この端末の中だけに保存されます。' }),
        D.reflQ.map(function (q) {
          var ta = h('textarea', { id: 'refl-' + q.id, class: 'input', rows: 3, maxlength: '600' });
          ta.value = refl[q.id] || '';
          ta.addEventListener('input', function () { var r = saved.refl || {}; r[q.id] = ta.value; save('refl', r); markNav(); });
          return h('div', { class: 'field' }, h('label', { for: 'refl-' + q.id, text: q.label }), ta);
        })))
    ]);
  }

  // ================= ふりかえり・記録 =================
  function buildRecord() {
    var st = saved.student || {};
    var refl = saved.refl || {};
    return {
      app: APP,
      exportedAt: new Date().toISOString(),
      student: { cls: st.cls || '', num: st.num || '', name: st.name || '' },
      scenarios: D.scenarios.map(function (sc) {
        var s = scState(sc);
        return { id: sc.id, no: '①②③④⑤⑥'.charAt(Number(sc.no) - 1), title: sc.title, cleared: !!s.cleared, clearedAt: s.clearedAt || '', misses: s.misses || 0, hints: s.hints || 0,
          steps: sc.steps.filter(function (x) { return s.done[x.id]; }).length + ' / ' + sc.steps.length };
      }),
      reflection: { r1: refl.r1 || '', r2: refl.r2 || '', r3: refl.r3 || '' }
    };
  }
  function recordCsv(r) {
    var cell = function (v) {
      var s = String(v == null ? '' : v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };
    var head = ['組', '番号', '名前', 'クリアした場面'].concat(r.scenarios.map(function (x) { return x.no + ' ' + x.title; })).concat(['ふりかえり1', 'ふりかえり2', 'ふりかえり3']);
    var row = [r.student.cls, r.student.num, r.student.name, r.scenarios.filter(function (x) { return x.cleared; }).length + ' / ' + r.scenarios.length]
      .concat(r.scenarios.map(function (x) { return (x.cleared ? 'クリア' : 'まだ') + '(だまされた ' + x.misses + '・ヒント ' + x.hints + ')'; }))
      .concat([r.reflection.r1, r.reflection.r2, r.reflection.r3]);
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
      return (APP.replace(/\s/g, '_') + '_' + who + '.' + ext).replace(/[\\/:*?"<>|]/g, '_');
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
      var text = [r.app, '組: ' + r.student.cls + '　番号: ' + r.student.num + '　名前: ' + r.student.name]
        .concat(r.scenarios.map(function (x) { return x.no + ' ' + x.title + ': ' + (x.cleared ? 'クリア' : 'まだ') + '(だまされた ' + x.misses + '回・ヒント ' + x.hints + '回)'; }))
        .concat(['ふりかえり1: ' + r.reflection.r1, 'ふりかえり2: ' + r.reflection.r2, 'ふりかえり3: ' + r.reflection.r3]).join('\n');
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
    var r = buildRecord();
    var refl = saved.refl || {};
    append(el, [
      h('div', { class: 'module-head' },
        h('h1', { class: 'sec-title', text: FK_OFF ? '記録' : 'ふりかえり・記録' }),
        h('p', { class: 'meta', text: (FK_OFF ? 'クリアした場面' : 'クリアした場面とふりかえり') + 'は、この端末のブラウザの中にだけ保存されています。提出するときは、ファイルに書き出してください。' })),
      card('名前',
        h('p', { class: 'muted', text: '名前は、先生の指示がないときは入れなくてかまいません。' }),
        h('div', { class: 'field-row' }, field('rec-cls', '組', 'cls', 4), field('rec-num', '番号', 'num', 4), field('rec-name', '名前(なくてもよい)', 'name', 12))),
      card(FK_OFF ? '進み具合' : '進み具合とふりかえり',
        h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
          h('thead', null, h('tr', null, h('th', { text: '場面' }), h('th', { text: 'クリア' }), h('th', { text: 'だまされた' }), h('th', { text: 'ヒント' }))),
          h('tbody', null, r.scenarios.map(function (x) {
            return h('tr', null, h('td', { text: x.label + ' ' + x.title }), h('td', { text: x.cleared ? '✓' : '' }), h('td', { text: x.misses + ' 回' }), h('td', { text: x.hints + ' 回' }));
          })))),
        h('ul', { class: 'refl-list', 'data-ef-reflect': '' }, D.reflQ.map(function (q, i) {
          return h('li', null, h('b', { text: 'ふりかえり' + (i + 1) + ': ' }), refl[q.id] ? h('span', { text: refl[q.id] }) : h('span', { class: 'muted', text: '(まだ書いていません)' }));
        })),
        h('p', { class: 'muted', 'data-ef-reflect': '' }, 'ふりかえりは「', h('a', { href: '#matome', text: '⑥ まとめとふりかえり' }), '」で書きます。')),
      card('書き出す',
        h('p', null, h('strong', { text: '先生に出すのは JSON のファイルです。' }), 'CSV は、表計算ソフトで見るときに使います。ファイルができないときは「記録をコピーする」を使います。'),
        h('div', { class: 'btn-row' },
          btn('記録を書き出す(JSON・提出用)', function () { download('json'); }, 'ef-btn-primary'),
          btn('CSVで書き出す(表計算用)', function () { download('csv'); }),
          btn('記録をコピーする', copy)),
        note,
        point('書き出す中身', h('p', { text: '組・番号・名前、場面ごとのクリア・だまされた回数・ヒントの回数、ふりかえりの文章だけです。' }))),
      renderReset()
    ]);
  }

  // ---- はじめからやり直す(データリセット) ----
  // 確認は画面の中で行う。ふりがな・文字の大きさは表示の設定なので消さない(ほかの情報の教材と同じ)。
  var resetAsk = false;
  var resetMsg = '';
  function renderReset() {
    var box = card('はじめからやり直す',
      h('p', { text: '次の人に端末をわたすときや、最初からやり直したいときに使います。この端末に保存した組・番号・名前、クリアした場面、だまされた回数、ふりかえりを、すべて消します。ふりがな・文字の大きさの設定は残ります。' }));
    box.id = 'reset';
    box.classList.add('reset-card');
    if (!resetAsk) {
      box.appendChild(h('div', { class: 'btn-row' }, btn('この端末の記録をすべて消す', function () { resetAsk = true; resetMsg = ''; rerender(); }, 'ef-btn reset-btn')));
    } else {
      box.appendChild(h('div', { class: 'reset-confirm', role: 'alert' },
        h('p', null, h('strong', { text: '本当に消しますか？' }), '消した記録は元にもどせません。提出がまだなら、先に「書き出す」でファイルにしておこう。'),
        h('div', { class: 'btn-row' },
          btn('消す(はじめからやり直す)', function () { resetAll(); }, 'ef-btn-primary danger'),
          btn('やめる', function () { resetAsk = false; rerender(); }))));
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
    resetAsk = false;
    resetMsg = '記録をすべて消しました。はじめから使えます。';
    current = null;
    show('records');
    resetMsg = '';
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
    setTimeout(function () { t.classList.remove('show'); }, 2500);
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

  buildNav();
  setupToggles();
  window.addEventListener('hashchange', route);
  route();
})();
