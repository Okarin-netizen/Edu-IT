/* Edu-IT 共通の枠: 作成者・安全と個人情報・ライセンス・更新履歴
 * 使い方(classic script。file:// でも動く):
 *   <link rel="stylesheet" href="…/shared/eduit-frame.css">
 *   <script src="…/<分野>/eduit-info.js"></script>   … window.EDUIT_INFO を決める
 *   <script src="…/shared/eduit-frame.js"></script>
 * 置き場所(どれか):
 *   - <div data-ef-footer></div> があればそこにフッターを出す
 *   - <span data-ef-about></span> があればそこに「ⓘ このアプリについて」ボタンを出す(フッターは出さない)
 *   - どちらもなければ <body> の最後にフッターを足す
 *   - EDUIT_INFO.app.footer === false なら自動では何も出さない(EduitFrame.open() だけ使う)
 * EDUIT_INFO = {
 *   domain: 'A',                     分野(A/B/C/D)。色が切りかわる
 *   domainName: '材料と加工の技術',
 *   suite: '材料と加工 教材アプリ',     教材集の名前
 *   version: '2.1', updated: '2026-10-15',
 *   safety: ['この分野だけの安全の説明', …],   共通の説明のあとに足す
 *   history: [{ version: '2.1', date: '2026-10-15', items: ['…', …] }, …]   新しい順
 *   app: { name: 'A3 構造強化ラボ' }   アプリごとに上書き(EDUIT_INFO.app を各ページで決めてもよい)
 *   levels: { basic: {...}, advanced: {...} }   基本編・発展編の分け方(メニューが EduitFrame.levels で使う)
 * }
 *
 * メニューのカード(4分野共通の形): EduitFrame.card({ code: 'A1', icon: '🪵', title: '…', desc: '…', parts: 「使うところ」の要素,
 *   extra: [分野ごとの追加の要素…], href: 'ひらく先' か onOpen: function () {…}, openAttrs: { 'data-go': 'b1' } })
 *   → <article class="ef-card ef-mcard">。記号・アイコン・名前・説明・使うところ・追加の欄・「ひらく ▶」の順。カードのどこを押しても開く。
 * 記号の印: EduitFrame.code('A2') → <span class="ef-code">A2</span>(メニューの上のバー・アプリの上のバー・切りかえボタンで使う)
 * メニューの上のバーの名前: EduitFrame.menuTitle(h1) → h1 の中を「[A] 材料と加工の技術 教材集」にする
 *
 * 基本編・発展編(メニュー用): EduitFrame.levels(置き場所, { card: function (item, parts, levelKey) { return カードの要素; }, code: function (item) { return 'A1'; } })
 *   code を渡すと、基本編の上に「おすすめの順番: A1 → A2 → …」の1行を出す(カードの順 = 番号の順 = おすすめの順)。
 *   EDUIT_INFO.levels = {
 *     basic:    { title: '基本編', lead: '…', items: [{ id: 'M1', parts: ['材料カード', …], curr: 'A(1)ア', why: '…' }, …] },
 *     advanced: { title: '発展編', lead: '…', items: [ … ] }
 *   }
 *   id はメニューごとのアプリの id。parts は生徒の画面に出るタブ・ページの名前(「使うところ」に出す)。
 *   curr(学習指導要領の項目)と why(分けた理由)は先生用の一覧だけに出し、生徒のカードには出さない。
 *   選んだ編は localStorage の 'eduit.level.<分野>' に覚える(表示の設定なので「はじめから」でも消さない)。
 */
(function () {
  'use strict';
  var AUTHOR = '技術　岡田';
  var info = window.EDUIT_INFO || {};
  var app = info.app || {};
  if (info.domain) document.documentElement.setAttribute('data-ef-domain', info.domain);

  var SAFETY = [
    'この教材はインターネットに接続しません。外部のサイトやサーバーへ、入力した内容や学習の記録を送ることはありません。',
    '学習の記録は、開いた端末のブラウザの中だけに保存されます。ほかの端末や先生のパソコンへ自動で送られることはありません。',
    '提出するときは、自分で「書き出す」などのボタンでファイルにして、先生の指示どおりに出します。',
    '名前などの個人情報は、先生の指示がないときは入力しないでください。',
    '端末をほかの人と共有するときは、提出したあとに記録を消してください。',
    '教材に出てくる会社名・人名・アドレス・数値は、学習のために作ったものです(実在のものではありません。数値は目安です)。',
    '広告・アクセス解析・Cookie による追跡はありません。外部のプログラム(CDN など)も読み込みません。'
  ];
  var LICENSE = [
    '著作権: © 2026 ' + AUTHOR,
    '学校の授業・家庭学習など、学習のためであれば、だれでも無料で使用・コピー・配布できます(ほかの学校の先生も使えます)。',
    '授業に合わせて直して使うこともできます。直したものを配るときは、直したことと、もとの作者(' + AUTHOR + ')を書いてください。',
    '販売すること、有料の教材や商品に入れて配ることはできません。',
    'この教材は今のまま提供します。使ったことで起きた不具合や損害について、作者は責任を負いません。',
    '教科書の図や文章は使っていません。図や文章はこの教材のために作ったものです。'
  ];

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'class') e.className = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function list(items) { return el('ul', null, items.map(function (t) { return el('li', { text: t }); })); }
  function appName() { return app.name || info.suite || document.title; }

  var dlg = null;
  function build() {
    var safety = SAFETY.concat(info.safety || []).concat(app.safety || []);
    var hist = info.history || [];
    var panels = [
      ['安全と個人情報', [el('h3', { text: 'この教材の安全について' }), list(safety)]],
      ['ライセンス', [el('h3', { text: '使ってよい条件' }), list(LICENSE)]],
      ['更新履歴', hist.length ? hist.map(function (h) {
        return el('section', null, [
          el('h3', null, [el('span', { class: 'ef-hist-ver', text: h.version ? '第' + h.version + '版' : '' }),
            el('span', { class: 'ef-hist-date', text: h.date || '' })]),
          list(h.items || [])
        ]);
      }) : [el('p', { text: 'まだありません。' })]],
      ['作った人', [
        el('h3', { text: appName() }),
        el('p', { text: (info.domainName ? '中学校 技術・家庭科(技術分野)「' + info.domainName + '」の教材です。' : '中学校 技術・家庭科(技術分野)の教材です。') }),
        el('p', { text: '作成: ' + AUTHOR }),
        el('p', { text: (info.version ? '第' + info.version + '版' : '') + (info.updated ? '(' + info.updated + ' 更新)' : '') })
      ]]
    ];
    var tabs = el('div', { class: 'ef-tabs', role: 'tablist' });
    var body = el('div');
    var tabEls = [], panelEls = [];
    panels.forEach(function (p, i) {
      var t = el('button', { type: 'button', class: 'ef-tab', role: 'tab', id: 'ef-tab-' + i, 'aria-controls': 'ef-panel-' + i, 'aria-selected': i ? 'false' : 'true', tabindex: i ? '-1' : '0', text: p[0] });
      var pn = el('div', { class: 'ef-panel', role: 'tabpanel', id: 'ef-panel-' + i, 'aria-labelledby': 'ef-tab-' + i }, p[1]);
      if (i) pn.hidden = true;
      t.addEventListener('click', function () { select(i); });
      t.addEventListener('keydown', function (e) {
        var n = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (n) { e.preventDefault(); select((i + n + panels.length) % panels.length); tabEls[(i + n + panels.length) % panels.length].focus(); }
      });
      tabEls.push(t); panelEls.push(pn); tabs.appendChild(t); body.appendChild(pn);
    });
    function select(i) {
      tabEls.forEach(function (t, j) { t.setAttribute('aria-selected', i === j ? 'true' : 'false'); t.tabIndex = i === j ? 0 : -1; });
      panelEls.forEach(function (p, j) { p.hidden = i !== j; });
    }
    var close = el('button', { type: 'button', class: 'ef-btn', text: '閉じる' });
    close.addEventListener('click', function () { dlg.close(); });
    dlg = el('dialog', { class: 'ef-dialog', 'aria-labelledby': 'ef-dialog-title' }, [
      el('div', { class: 'ef-dialog-in' }, [
        el('div', { class: 'ef-dialog-head' }, [el('h2', { id: 'ef-dialog-title', text: 'このアプリについて' }), close]),
        tabs, body
      ])
    ]);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg._select = select;
    document.body.appendChild(dlg);
  }
  function open(tab) {
    if (!dlg) build();
    dlg._select(typeof tab === 'number' ? tab : 0);
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  }

  function aboutButton(cls) {
    var b = el('button', { type: 'button', class: cls || 'ef-btn ef-about-btn', title: '作った人・安全と個人情報・ライセンス・更新履歴', text: 'ⓘ このアプリについて' });
    b.addEventListener('click', function () { open(0); });
    return b;
  }
  function footer() {
    var link = aboutButton('ef-about-link');
    link.textContent = '安全と個人情報・ライセンス・更新履歴';
    return el('footer', { class: 'ef-footer', role: 'contentinfo' }, [
      el('span', null, ['作成: ', el('span', { class: 'ef-author', text: AUTHOR })]),
      info.version ? el('span', { text: '第' + info.version + '版' + (info.updated ? '(' + info.updated + ')' : '') }) : null,
      link
    ]);
  }
  function mount() {
    if (app.footer === false) return;
    var slot = document.querySelector('[data-ef-footer]');
    var about = document.querySelector('[data-ef-about]');
    if (slot) { if (!slot.querySelector('.ef-footer')) slot.appendChild(footer()); }
    else if (about) { if (!about.querySelector('button')) about.appendChild(aboutButton()); }
    else if (!document.querySelector('body > .ef-footer')) document.body.appendChild(footer());
  }

  // ---- 基本編・発展編のタブ(メニュー用) ----
  var LEVEL_KEYS = ['basic', 'advanced'];
  function levels(box, opts) {
    var L = info.levels;
    if (!box || !L) return null;
    opts = opts || {};
    var store = 'eduit.level.' + (info.domain || 'x');
    var cur = 'basic';
    try { if (LEVEL_KEYS.indexOf(localStorage.getItem(store)) >= 0) cur = localStorage.getItem(store); } catch (e) {}
    var uid = 'ef-lv-' + (info.domain || 'x');
    var tabs = el('div', { class: 'ef-level-tabs', role: 'tablist', 'aria-label': '基本編と発展編' });
    var panel = el('div', { class: 'ef-level-panel', role: 'tabpanel', id: uid + '-panel', tabindex: '-1' });
    var tabEls = LEVEL_KEYS.map(function (k, i) {
      var lv = L[k] || { items: [] };
      var t = el('button', { type: 'button', role: 'tab', class: 'ef-level-tab ef-level-' + k, id: uid + '-' + k, 'aria-controls': uid + '-panel' }, [
        el('span', { class: 'ef-level-name', text: lv.title || (k === 'basic' ? '基本編' : '発展編') }),
        el('span', { class: 'ef-level-count', text: (lv.items || []).length + 'つ' })
      ]);
      t.addEventListener('click', function () { select(k, true); });
      t.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        var n = LEVEL_KEYS[(i + 1) % LEVEL_KEYS.length];
        select(n, true); tabEls[LEVEL_KEYS.indexOf(n)].focus();
      });
      tabs.appendChild(t);
      return t;
    });
    function partsEl(item) {
      if (!item.parts || !item.parts.length) return null;
      return el('p', { class: 'ef-level-parts' }, [el('span', { class: 'ef-level-parts-k', text: '使うところ' }), item.parts.join('・')]);
    }
    function render() {
      var lv = L[cur] || { items: [] };
      tabEls.forEach(function (t, i) { var on = LEVEL_KEYS[i] === cur; t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1; });
      panel.setAttribute('aria-labelledby', uid + '-' + cur);
      var grid = el('div', { class: 'ef-level-grid ' + (opts.gridClass || '') });
      (lv.items || []).forEach(function (item) {
        var c = opts.card ? opts.card(item, partsEl(item), cur) : null;
        if (c) grid.appendChild(c);
      });
      while (panel.firstChild) panel.removeChild(panel.firstChild);
      if (lv.lead) panel.appendChild(el('p', { class: 'ef-level-lead', text: lv.lead }));
      if (opts.code && cur === 'basic') {
        var codes = (lv.items || []).map(opts.code).filter(Boolean);
        if (codes.length) panel.appendChild(el('p', { class: 'ef-level-order' }, [el('span', { class: 'ef-level-parts-k', text: 'おすすめの順番' }), codes.join(' → ')]));
      }
      panel.appendChild(grid);
      if (opts.onRender) opts.onRender(panel, cur);
    }
    function select(k, byUser) {
      if (LEVEL_KEYS.indexOf(k) < 0) return;
      cur = k;
      if (byUser) try { localStorage.setItem(store, k); } catch (e) {}
      render();
    }
    while (box.firstChild) box.removeChild(box.firstChild);
    box.classList.add('ef-levels');
    box.appendChild(tabs);
    box.appendChild(panel);
    render();
    return { render: render, select: select, current: function () { return cur; } };
  }

  // ---- 記号の印・メニューの上のバーの名前・メニューのカード(4分野共通の形) ----
  function code(c) { return el('span', { class: 'ef-code', text: c }); }
  function menuTitle(h) {
    if (!h) return h;
    while (h.firstChild) h.removeChild(h.firstChild);
    h.classList.add('ef-title');
    if (info.domain) h.appendChild(code(info.domain));
    h.appendChild(el('span', { class: 'ef-title-name', text: (info.domainName || '') + ' 教材集' }));
    return h;
  }
  function card(o) {
    o = o || {};
    var go = o.href
      ? el('a', { class: 'ef-btn-primary ef-mcard-go', href: o.href, text: 'ひらく ▶' })
      : el('button', { type: 'button', class: 'ef-btn-primary ef-mcard-go', text: 'ひらく ▶' });
    if (o.openAttrs) for (var k in o.openAttrs) go.setAttribute(k, o.openAttrs[k]);
    if (o.title) go.setAttribute('aria-label', (o.code ? o.code + ' ' : '') + o.title + ' をひらく');
    if (o.onOpen) go.addEventListener('click', function (e) { o.onOpen(e); });
    var extra = (o.extra || []).filter(Boolean);
    var c = el('article', { class: 'ef-card ef-mcard' }, [
      el('div', { class: 'ef-mcard-hd' }, [
        o.icon ? el('span', { class: 'ef-mcard-ic', 'aria-hidden': 'true', text: o.icon }) : null,
        el('div', { class: 'ef-mcard-ht' }, [
          o.code ? el('p', { class: 'ef-card-tag' }, [code(o.code)]) : null,
          el('h3', { class: 'ef-card-title', text: o.title || '' })
        ])
      ]),
      o.desc ? el('p', { class: 'ef-mcard-desc', text: o.desc }) : null,
      o.parts || null,
      extra.length ? el('div', { class: 'ef-mcard-extra' }, extra) : null,
      go
    ]);
    if (o.code) c.setAttribute('data-code', o.code);
    // カードのどこを押しても開く(カードの中のほかのボタン・リンク・入力は、そのまま)
    c.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a, button, input, select, textarea, label, summary')) return;
      go.click();
    });
    return c;
  }

  window.EduitFrame = { AUTHOR: AUTHOR, open: open, footer: footer, aboutButton: aboutButton, mount: mount, levels: levels, card: card, code: code, menuTitle: menuTitle };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
