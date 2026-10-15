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
 *   app: { name: 'M3 構造強化ラボ' }   アプリごとに上書き(EDUIT_INFO.app を各ページで決めてもよい)
 * }
 */
(function () {
  'use strict';
  var AUTHOR = '羽生市立南中学校　技術　岡田';
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

  window.EduitFrame = { AUTHOR: AUTHOR, open: open, footer: footer, aboutButton: aboutButton, mount: mount };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
