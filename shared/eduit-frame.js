/* Edu-IT 共通の枠: 作成者・安全と個人情報・ライセンス・更新履歴
 * 使い方(classic script。file:// でも動く):
 *   <link rel="stylesheet" href="…/shared/eduit-frame.css">
 *   <script src="…/<分野>/eduit-info.js"></script>   … window.EDUIT_INFO を決める
 *   <script src="…/shared/eduit-frame.js"></script>
 * 置き場所(どれか):
 *   - <div data-ef-footer></div> があればそこにフッターを出す
 *   - <span data-ef-about></span> があればそこに「ⓘ このアプリについて」ボタンを出す(data-ef-footer がなければフッターは出さない)
 *   - <span data-ef-fs></span> があればそこに「全画面」ボタンを出す(いちばん外のページごと全画面。できない端末では出さない)
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
 * メニューのカード(4分野共通の形): EduitFrame.card({ code: 'A1', title: '…', desc: '…', parts: 「使うところ」の要素,
 *   extra: [分野ごとの追加の要素…], href: 'ひらく先' か onOpen: function () {…}, openAttrs: { 'data-go': 'b1' } })
 *   → <article class="ef-card ef-mcard">。記号・アイコン・名前・説明・使うところ・追加の欄・「ひらく ▶」の順。カードのどこを押しても開く。
 * メニューの上のバー(4分野で同じ): 左に EduitFrame.menuTitle の「[A] 材料と加工の技術 教材集」、右に「ふりがな」「文字 中」「使い方」「先生用」の4つだけ。
 *   ボタンは字だけ(絵文字を付けない)。くっきり・全画面・教材の切りかえボタンは、アプリを開いたときの上のバーにだけ出す。
 * 使い方のダイアログ: EduitFrame.howto(本文の HTML, { onOpen: function (dialogの中身) {…} }) → 「使い方」の題のダイアログを開く
 *   (別の「使い方」の画面がない分野のメニューで使う。onOpen はふりがなを付けるときなどに)
 * 記号の印: EduitFrame.code('A2') → <span class="ef-code">A2</span>(メニューの上のバー・アプリの上のバー・切りかえボタンで使う)
 * メニューの上のバーの名前: EduitFrame.menuTitle(h1) → h1 の中を「[A] 材料と加工の技術 教材集」にする
 * 上のバーの表示の道具(4分野で同じ形):
 *   ふりがな・くっきり: <button class="ef-btn ef-toggle" aria-pressed="true|false">ふりがな</button>(ON は分野の色で塗り、✓ が付く)
 *   文字の大きさ: <button class="ef-btn ef-size"></button> に EduitFrame.sizeButton(btn, { steps: [[値, '中'], [値, '大'], …], get: 今の値, set: function (値) {…} })
 *     →「文字 中」のボタンになり、押すたびに次の大きさへ(最後のつぎは最初へ)。もどり値の関数を呼ぶと表示を今の値に合わせる。
 *     「ふつう・大きい」の2段だけのときは、<button class="ef-btn ef-size" aria-pressed="false">文字 <span class="ef-size-v"></span></button> にして aria-pressed を切りかえるだけでよい(「中」「大」は CSS が出す)。
 * 表示の設定(全教材で1つ): EduitFrame.prefs。上のバーのボタンに data-ef-pref="ruby" / "fs" / "kukkiri" を付けると、
 *   ふりがな・「文字 中」(小・中・大・特大)・くっきりのボタンになる。ボタンのない教材は EduitFrame.prefs.use()。
 *   EduitFrame.prefs.get('fs') / set('ruby', true) / on(function (key, value) {…})。JS でバーを作る教材は prefs.button('fs') でボタンを受け取る。くわしくは下の「表示の設定」。
 * タブの帯をスクロールで隠す: 上に固定(position: sticky)したタブの帯に data-ef-autohide を付けるだけ。
 *   下へ読み進めると上へ引っこみ、少しでも上へ戻すと出てくる(帯の中にフォーカスがあるときは隠さない)。
 *   画面のはばの半分より細いもの(PC で左にたてに並ぶメニュー)は隠さない。スマホで横1行の帯になったときだけ隠れる。
 *
 * 振り返りを隠す設定: EduitFrame.furikaeri(true = 出す / false = 隠す)。隠すときは <html data-ef-furikaeri="off"> になり、
 *   data-ef-reflect の付いた要素(振り返りのタブ・欄・カードの印など)が出なくなる(eduit-frame.css)。決め方(先のものが勝つ):
 *   1. アドレスの ?furikaeri=off / ?furikaeri=on(自分か、同じサイトの親の画面のアドレス)。localStorage 'eduit.furikaeri' に覚える
 *   2. window.EDUIT_FURIKAERI = 'off' / 'on'(自分か親の画面。配布用の「振り返りなし」版はこれを入れてある)
 *   3. localStorage 'eduit.furikaeri'(前に 1 で決めたもの)
 *   JS で振り返りを出し分けるとき(振り返りを書かないと先へ進めない、など)は EduitFrame.furikaeri を見る。
 *
 * 自習モード: EduitFrame.jishu(true = 入っている。既定は切)。決め方は振り返りと同じで、?jishu=on|off → window.EDUIT_JISHU → localStorage 'eduit.jishu'。
 *   入っているときは <html data-ef-jishu="on"> になり、アプリの右はしに「自習ガイド」のボタンとパネル(ねらい・進め方・ヒント・たしかめ問題)を出す。
 *   中身は分野ごとの eduit-info.js の EDUIT_INFO.jishu.apps[記号](記号はアプリ名 EDUIT_INFO.app.name の先頭の「A3」など):
 *   { goal: 'ねらい', time: '30分', steps: [{ where: 'タブの名前', do: 'やること', hint: 'ヒント', go: '#/hash' か 'CSSセレクタ', level: 'advanced', reflect: true }],
 *     check: [{ q: '問い', choices: ['…', …], answer: 正解の番号(0から), explain: '解説' }] }
 *   go は「この場所へ」ボタンの行き先(# で始まれば location.hash、それ以外はその要素を click)。level: 'advanced' は「発展」にまとめ、reflect: true は振り返りを隠す設定のとき出さない。
 *   1つのページの中でアプリを切りかえる教材集は、開いたときに EduitFrame.jishuApp('C4')、メニューにもどったら EduitFrame.jishuApp(null) を呼ぶ。
 *   できた印と答えは localStorage 'eduit.jishu.v1.<記号>'。メニュー(levels に code を渡したとき)は基本編の上に進め方の説明、カードに進み具合を出す。
 *
 * まず考えよう(教科書の各節の「レッツスタート」にあたる導入): 下の LETS に、学習コース(T-textbook/course-data.js)の節の id ごとに
 *   { q: '問い', hint: 'ヒント' } を書く。文は教科書を写さず、この教材のために書いたもの(1文40字くらい)。
 *   教材の画面では、そのタブのいちばん上に <div data-ef-lets="a12"></div> を置くだけで、カードが入る(JS で後から作る画面でもよい)。
 *   学習コースは EduitFrame.lets(id) でデータを、EduitFrame.letsCard(id) でカードを取る。
 *
 * 基本編・発展編(メニュー用): EduitFrame.levels(置き場所, { card: function (item, parts, levelKey) { return カードの要素; }, code: function (item) { return 'A1'; } })
 *   code を渡すと、基本編の上に「おすすめの順番: A1 → A2 → …」の1行を出す(カードの順 = 番号の順 = おすすめの順)。
 *   EDUIT_INFO.levels = {
 *     basic:    { title: '基本編', lead: '…', items: [{ id: 'M1', parts: ['材料カード', …], curr: 'A(1)ア', why: '…' }, …] },
 *     advanced: { title: '発展編', lead: '…', items: [ … ] }
 *   }
 *   id はメニューごとのアプリの id。parts は生徒の画面に出るタブ・ページの名前(「使うところ」に出す)。
 *   EDUIT_INFO.textbook があれば、カードを教科書の章ごとに見出しで区切り、カードに「教科書 1編1章 2」の行を出す:
 *   EDUIT_INFO.textbook = {
 *     groups: [{ key: 'know', ch: '1章', title: 'しくみを知る' }, { key: 'solve', ch: '2章', title: '問題を解決する' }, …],  見出しの順
 *     items: { 'material-navi': { g: 'know', ref: '1編1章 1・2' }, … }   id ごとの区切りと、カードに出す教科書の節
 *   }
 *   curr(学習指導要領の項目)と why(分けた理由)は先生用の一覧だけに出し、生徒のカードには出さない。
 *   選んだ編は localStorage の 'eduit.level.<分野>' に覚える(表示の設定なので「はじめから」でも消さない)。
 */
(function () {
  'use strict';
  var AUTHOR = '技術　岡田';
  var info = window.EDUIT_INFO || {};
  var app = info.app || {};
  if (info.domain) document.documentElement.setAttribute('data-ef-domain', info.domain);

  // ---- 振り返りを隠す設定 ----
  // 決め方(先のものが勝つ): アドレスの ?名前=on|off(自分か、同じサイトの親の画面。localStorage に覚える)→ window.変数 → localStorage
  function setting(param, globalName, key) {
    var w = window, v = null, re = new RegExp('[?&]' + param + '=(on|off)(?:&|$)');
    for (var i = 0; i < 8 && v === null; i++) {
      try {
        var m = re.exec(w.location.search || '');
        if (m) { v = m[1]; try { localStorage.setItem(key, v); } catch (e) {} }
        else if (w[globalName] === 'on' || w[globalName] === 'off') v = w[globalName];
      } catch (e) { break; }  // ちがうサイトの親は見ない
      if (w === w.parent) break;
      w = w.parent;
    }
    if (v === null) try { v = localStorage.getItem(key); } catch (e) {}
    return v;
  }
  function furikaeriSetting() { return setting('furikaeri', 'EDUIT_FURIKAERI', 'eduit.furikaeri') !== 'off'; }
  var furikaeri = furikaeriSetting();
  if (!furikaeri) document.documentElement.setAttribute('data-ef-furikaeri', 'off');

  // ---- 自習モード(既定は切)。入っているときは <html data-ef-jishu="on"> にして、アプリに「自習ガイド」を出す ----
  var JS_STORE = 'eduit.jishu.v1.';  // + 記号: { s: できた手順, q: たしかめ問題の答え, seen: ガイドを開いたことがある }
  var jishu = setting('jishu', 'EDUIT_JISHU', 'eduit.jishu') === 'on';
  if (jishu) document.documentElement.setAttribute('data-ef-jishu', 'on');

  var SAFETY = [
    'この教材は、インターネットにつながりません。入力したことや学習の記録を、外のサイトに送ることはありません。',
    '学習の記録は、開いた端末のブラウザの中だけに保存されます。ほかの端末や先生のパソコンには送られません。',
    '提出するときは、「書き出す」などのボタンでファイルにします。そのファイルを、先生の指示どおりに出します。',
    '名前などの個人情報は、先生の指示がないときは入力しないでください。',
    '端末をほかの人と共有するときは、提出したあとに記録を消してください。',
    '教材に出てくる会社名・人名・アドレスは、学習のために作ったものです。実在しません。数値は目安です。',
    '広告・アクセス解析・Cookie による追跡はありません。外部のプログラム(CDN など)も読み込みません。'
  ];
  var LICENSE = [
    '著作権: © 2026 ' + AUTHOR,
    '学習のためなら、だれでも無料で使い、コピーし、配ることができます。ほかの学校の先生も使えます。',
    '授業に合わせて直して使うこともできます。直したものを配るときは、直したことと、もとの作者(' + AUTHOR + ')を書いてください。',
    '販売すること、有料の教材や商品に入れて配ることはできません。',
    'この教材は、今のまま提供します。使って起きた不具合や損害に、作者は責任を負いません。',
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
        if (!n) return;
        var j = (i + n + panels.length) % panels.length;
        e.preventDefault(); select(j); tabEls[j].focus();
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

  var howtoDlg = null;
  function howto(html, opts) {
    opts = opts || {};
    if (!howtoDlg) {
      var close = el('button', { type: 'button', class: 'ef-btn', text: '閉じる' });
      close.addEventListener('click', function () { howtoDlg.close(); });
      howtoDlg = el('dialog', { class: 'ef-dialog ef-howto', 'aria-labelledby': 'ef-howto-title' }, [
        el('div', { class: 'ef-dialog-in' }, [
          el('div', { class: 'ef-dialog-head' }, [el('h2', { id: 'ef-howto-title', text: '使い方' }), close]),
          el('div', { class: 'ef-panel' })
        ])
      ]);
      howtoDlg.addEventListener('click', function (e) { if (e.target === howtoDlg) howtoDlg.close(); });
      document.body.appendChild(howtoDlg);
    }
    var body = howtoDlg.querySelector('.ef-panel');
    body.innerHTML = html;
    if (opts.onOpen) opts.onOpen(body);
    if (typeof howtoDlg.showModal === 'function') howtoDlg.showModal(); else howtoDlg.setAttribute('open', '');
    body.scrollTop = 0;
  }

  function aboutButton(cls) {
    var b = el('button', { type: 'button', class: cls || 'ef-btn ef-about-btn', title: '作った人・安全と個人情報・ライセンス・更新履歴', 'aria-label': 'このアプリについて(作った人・安全と個人情報・ライセンス・更新履歴)' },
      ['ⓘ', el('span', { class: 't', text: ' このアプリについて' })]);
    b.addEventListener('click', function () { open(0); });
    return b;
  }
  // 全画面(C エネルギー変換の「全画面」と同じ)。枠(生徒用サイト・1ファイル版のメニュー)の中で開いたときは、いちばん外のページごと全画面にする
  function fsDoc() {
    var d = document;
    try { for (var w = window; w !== w.parent; w = w.parent) { var pd = w.parent.document; if (!pd) break; d = pd; } } catch (e) {}
    return d;
  }
  function fsButton() {
    var D = fsDoc(), W = D.defaultView || window;
    var b = el('button', { type: 'button', class: 'ef-btn ef-fs-btn' });
    var keyMq = W.matchMedia ? W.matchMedia('(display-mode: fullscreen)') : null;
    function isFull() { return !!(D.fullscreenElement || D.webkitFullscreenElement); }
    function isKeyFull() { return !isFull() && !!(keyMq && keyMq.matches); }
    function upd() {
      var on = isFull() || isKeyFull();
      b.hidden = !(D.fullscreenEnabled || D.webkitFullscreenEnabled);
      b.textContent = '';
      b.appendChild(el('span', { class: 't', text: on ? '全画面をやめる' : '全画面' }));
      b.setAttribute('aria-label', on ? '全画面をやめる' : '全画面にする');
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    b.addEventListener('click', function () {
      var r = D.documentElement;
      try {
        if (isFull()) (D.exitFullscreen || D.webkitExitFullscreen).call(D);
        else if (isKeyFull()) window.alert('キーで全画面にしたときは、同じキー(F11 など)でもどせます');
        else { var p = (r.requestFullscreen || r.webkitRequestFullscreen).call(r); if (p && p.catch) p.catch(function () {}); }
      } catch (e) {}
    });
    D.addEventListener('fullscreenchange', upd);
    D.addEventListener('webkitfullscreenchange', upd);
    if (keyMq) { if (keyMq.addEventListener) keyMq.addEventListener('change', upd); else if (keyMq.addListener) keyMq.addListener(upd); }
    upd();
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
    prefsMount();
    if (app.footer === false) return;
    var slot = document.querySelector('[data-ef-footer]');
    var about = document.querySelector('[data-ef-about]');
    Array.prototype.forEach.call(document.querySelectorAll('[data-ef-fs]'), function (f) { if (!f.querySelector('button')) f.appendChild(fsButton()); });
    if (about && !about.querySelector('button')) about.appendChild(aboutButton());
    if (slot) { if (!slot.querySelector('.ef-footer')) slot.appendChild(footer()); }
    else if (!about && !document.querySelector('body > .ef-footer')) document.body.appendChild(footer());
  }

  // ---- 基本編・発展編のタブ(メニュー用) ----
  var LEVEL_KEYS = ['basic', 'advanced'];
  // メニューから開く M・F(分野をまたぐ教材)。配るフォルダ(生徒に配る/)では同じフォルダにある。site/build.py がこの行を公開用の名前にする
  var SIBLINGS = { M: { file: 'M_身の回りの技術さがし.html', name: '身の回りの技術さがし' }, F: { file: 'F_これからの技術ラボ.html', name: 'これからの技術ラボ' } };
  // textbook.links の1つ: { code: 'M', area: 'a', when: '1章のはじめに', tab: '' }。M・F は ?bunya=a でその分野だけを開く(学習コースと同じ)
  function linkRow(L) {
    var S = SIBLINGS[L.code];
    if (!S) return null;
    var q = [jishu ? 'jishu=on' : '', L.area ? 'bunya=' + L.area : ''].filter(Boolean).join('&');
    var href = S.file + (q ? '?' + q : '') + (L.area ? '#' + L.area : '');
    return el('p', { class: 'ef-level-link' }, [
      L.when ? el('span', { class: 'ef-level-parts-k', text: L.when }) : null,
      el('a', { href: href, target: '_blank', rel: 'noopener' }, [code(L.code), S.name + (L.tab ? ' ' + L.tab : ''), el('span', { class: 'ef-level-link-go', text: ' ひらく ▶' })])
    ]);
  }
  // 学習のまとめ: 基本編の教材の「たしかめ問題」(EDUIT_INFO.jishu.apps[記号].check)を集めて、編ごとの確かめにする。
  // textbook.links[章].matome = { when: '3章のさいごに' } で、その章のおわりに行が出る。?matome=1 で開くと、すぐに開く(学習コースから)
  var MT_STORE = 'eduit.matome.', matomeDlg = null;
  function matomeQs(codes) {
    var out = [];
    codes.forEach(function (c) { var d = jishuData(c); if (d && d.check) d.check.forEach(function (q, i) { out.push({ c: c, i: i, q: q }); }); });
    return out;
  }
  function matomeOpen(codes, names) {
    var key = MT_STORE + (info.domain || 'x'), st = {};
    try { st = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) { st = {}; }
    var list = matomeQs(codes), area = (info.domain || '').charAt(0).toUpperCase();
    var close = el('button', { type: 'button', class: 'ef-btn', text: '閉じる' });
    var score = el('p', { class: 'ef-matome-score', 'aria-live': 'polite' });
    var body = el('div', { class: 'ef-panel ef-matome' });
    if (matomeDlg) matomeDlg.parentNode.removeChild(matomeDlg);
    matomeDlg = el('dialog', { class: 'ef-dialog ef-matome-dlg', 'aria-labelledby': 'ef-matome-title' }, [
      el('div', { class: 'ef-dialog-in' }, [el('div', { class: 'ef-dialog-head' }, [el('h2', { id: 'ef-matome-title', text: (area ? area + ' ' : '') + '学習のまとめ' }), close]), body])
    ]);
    close.addEventListener('click', function () { matomeDlg.close(); });
    function save() { try { localStorage.setItem(key, JSON.stringify(st)); } catch (e) {} }
    function paintScore() {
      var ok = list.filter(function (x) { return st[x.c + '.' + x.i] === x.q.answer; }).length;
      score.textContent = '正解 ' + ok + ' / ' + list.length + (ok === list.length ? ' 全部できました。' : '');
    }
    function qEl(x) {
      var k = x.c + '.' + x.i, res = el('p', { class: 'ef-jishu-res', 'aria-live': 'polite' });
      var btns = x.q.choices.map(function (t, j) {
        var b = el('button', { type: 'button', class: 'ef-jishu-choice', text: t });
        b.addEventListener('click', function () { st[k] = j; save(); paint(); paintScore(); });
        return b;
      });
      function paint() {
        var a = st[k];
        btns.forEach(function (b, j) {
          b.classList.toggle('is-ok', a !== undefined && j === x.q.answer && a === x.q.answer);
          b.classList.toggle('is-ng', a !== undefined && j === a && a !== x.q.answer);
          b.setAttribute('aria-pressed', String(a === j));
        });
        while (res.firstChild) res.removeChild(res.firstChild);
        if (a === undefined) return;
        res.className = 'ef-jishu-res ' + (a === x.q.answer ? 'is-ok' : 'is-ng');
        res.appendChild(el('strong', { text: a === x.q.answer ? '正解!' : 'ちがいます。もう一度考えよう。' }));
        if (a === x.q.answer && x.q.explain) res.appendChild(el('span', { text: ' ' + x.q.explain }));
        if (jishuRubyOn()) jishuRuby(res);
      }
      paint();
      return el('li', { class: 'ef-jishu-q' }, [el('p', { class: 'ef-jishu-qt', text: x.q.q }), el('div', { class: 'ef-jishu-choices' }, btns), res]);
    }
    var again = el('button', { type: 'button', class: 'ef-btn', text: 'はじめからやり直す' });
    again.addEventListener('click', function () { st = {}; save(); matomeDlg.close(); matomeOpen(codes, names); });
    body.appendChild(el('p', { text: '各教材のたしかめ問題です。答えると、すぐに答えが出ます。' }));
    body.appendChild(score);
    codes.forEach(function (c) {
      var qs = list.filter(function (x) { return x.c === c; });
      if (!qs.length) return;
      body.appendChild(el('h3', { class: 'ef-matome-h' }, [code(c), names[c] || '']));
      body.appendChild(el('ol', { class: 'ef-jishu-qs' }, qs.map(qEl)));
    });
    body.appendChild(el('p', null, [again]));
    paintScore();
    // ふりがなは問題の文だけ(教材の名前は、メニューのふりがなのしくみにまかせる)
    if (jishuRubyOn()) Array.prototype.forEach.call(body.querySelectorAll('.ef-jishu-qs, p'), function (n) { jishuRuby(n); });
    matomeDlg.addEventListener('click', function (e) { if (e.target === matomeDlg) matomeDlg.close(); });
    document.body.appendChild(matomeDlg);
    if (typeof matomeDlg.showModal === 'function') matomeDlg.showModal(); else matomeDlg.setAttribute('open', '');
  }
  // カードの名前(ふりがなの rt は入れない)
  function plainTitle(c) {
    var t = c.querySelector('.ef-card-title');
    if (!t) return '';
    var x = t.cloneNode(true);
    Array.prototype.forEach.call(x.querySelectorAll('rt, rp'), function (r) { r.parentNode.removeChild(r); });
    return x.textContent;
  }
  function matomeRow(M, codes, names) {
    var b = el('button', { type: 'button', class: 'ef-level-matome' }, [el('span', { class: 'ef-level-matome-t', text: '学習のまとめ' }),
      el('span', { class: 'ef-level-matome-d', text: matomeQs(codes).length + '問。基本編の教材のたしかめ問題をまとめて解く' }), el('span', { class: 'ef-level-link-go', text: ' ひらく ▶' })]);
    b.addEventListener('click', function () { matomeOpen(codes, names); });
    return el('div', { class: 'ef-level-link' }, [M.when ? el('span', { class: 'ef-level-parts-k', text: M.when }) : null, b]);
  }
  // ?matome=1 は、1つのファイルにまとめた版(メニューが iframe の中)でも見えるように親もさがす。開くのは1回だけ
  function matomeWanted() {
    var w = window;
    for (var i = 0; i < 8; i++) {
      try {
        if (/[?&]matome=1(&|$)/.test(w.location.search || '')) { if (w.__efMatomeDone) return false; w.__efMatomeDone = true; return true; }
      } catch (e) { break; }
      if (w === w.parent) break;
      w = w.parent;
    }
    return false;
  }
  function levels(box, opts) {
    var L = info.levels;
    if (!box || !L) return null;
    opts = opts || {};
    var store = 'eduit.level.' + (info.domain || 'x');
    var cur = 'basic';
    try { var saved = localStorage.getItem(store); if (LEVEL_KEYS.indexOf(saved) >= 0) cur = saved; } catch (e) {}
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
        var n = LEVEL_KEYS[(i + (e.key === 'ArrowRight' ? 1 : -1) + LEVEL_KEYS.length) % LEVEL_KEYS.length];
        select(n, true); tabEls[LEVEL_KEYS.indexOf(n)].focus();
      });
      tabs.appendChild(t);
      return t;
    });
    function partsEl(item) {
      if (!item.parts || !item.parts.length) return null;
      // カードには長い列を出さない(計画 6章のきまり10)。押すと開く
      return el('details', { class: 'ef-level-parts' }, [el('summary', null, [el('span', { class: 'ef-level-parts-k', text: '使うところ' }), item.parts.length + 'か所']), el('p', { text: item.parts.join('・') })]);
    }
    function render() {
      var lv = L[cur] || { items: [] };
      tabEls.forEach(function (t, i) { var on = LEVEL_KEYS[i] === cur; t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1; });
      panel.setAttribute('aria-labelledby', uid + '-' + cur);
      var grid = el('div', { class: 'ef-level-grid ' + (opts.gridClass || '') });
      var tb = info.textbook, groups = [], bcodes = [], bnames = {};
      (lv.items || []).forEach(function (item) {
        var c = opts.card ? opts.card(item, partsEl(item), cur) : null;
        if (!c) return;
        var c0 = opts.code ? opts.code(item) : null;
        if (c0) { bcodes.push(c0); bnames[c0] = plainTitle(c); }
        var t = tb && tb.items && tb.items[item.id];
        if (t && t.ref) {
          var go = c.querySelector('.ef-mcard-go');
          c.insertBefore(el('p', { class: 'ef-mcard-tb' }, [el('span', { class: 'ef-level-parts-k', text: '教科書' }), t.ref]), go && go.parentNode === c ? go : null);
        }
        var jc = jishu && opts.code ? opts.code(item) : null, jb = jc ? jishuBadge(jc) : null;
        if (jb) {
          var go2 = c.querySelector('.ef-mcard-go');
          c.insertBefore(jb, go2 && go2.parentNode === c ? go2 : null);
        }
        if (!tb || !tb.groups) { grid.appendChild(c); return; }
        var gi = 0;
        tb.groups.forEach(function (g, i) { if (t && t.g === g.key) gi = i; });
        (groups[gi] = groups[gi] || []).push(c);
      });
      // 教科書の章ごとに見出しで区切る(EDUIT_INFO.textbook)。区切りの中は levels の items の順
      // 基本編では、区切りのはじめ・おわりに M・F へのリンクの行(textbook.links)も出す
      var blocks = [], lk = cur === 'basic' && tb && tb.links || {};

      if (tb && tb.groups) tb.groups.forEach(function (g, i) {
        var L = lk[g.key] || {};
        if (!groups[i] && !L.first && !L.last && !L.matome) return;
        blocks.push(el('h3', { class: 'ef-level-group' }, [g.ch ? el('span', { class: 'ef-level-group-ch', text: g.ch }) : null, g.title]));
        if (L.first) blocks.push(linkRow(L.first));
        if (groups[i]) blocks.push(el('div', { class: 'ef-level-grid ' + (opts.gridClass || '') }, groups[i]));
        if (L.last) blocks.push(linkRow(L.last));
        if (L.matome && bcodes.length) blocks.push(matomeRow(L.matome, bcodes, bnames));
      });
      while (panel.firstChild) panel.removeChild(panel.firstChild);
      if (jishu && cur === 'basic') panel.appendChild(jishuMenuBox());
      if (lv.lead) panel.appendChild(el('p', { class: 'ef-level-lead', text: lv.lead }));
      if (opts.code && cur === 'basic') {
        var codes = (lv.items || []).map(opts.code).filter(Boolean);
        if (codes.length) panel.appendChild(el('p', { class: 'ef-level-order' }, [el('span', { class: 'ef-level-parts-k', text: 'おすすめの順番' }), codes.join(' → ')]));
      }
      if (blocks.length) blocks.forEach(function (b) { panel.appendChild(b); });
      else panel.appendChild(grid);
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
    if (opts.code && matomeWanted()) {
      var mc = (L.basic && L.basic.items || []).map(opts.code).filter(Boolean), mn = {};
      Array.prototype.forEach.call(box.querySelectorAll('.ef-mcard[data-code]'), function (c) { mn[c.getAttribute('data-code')] = plainTitle(c); });
      setTimeout(function () { matomeOpen(mc, mn); }, 0);
    }
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

  // ---- 文字の大きさのボタン(4分野で同じ形:「文字 中」。押すたびに次の大きさへ) ----
  function sizeButton(btn, opt) {
    var steps = opt.steps;
    btn.classList.add('ef-btn', 'ef-size');
    btn.type = 'button';
    btn.textContent = '';
    btn.appendChild(document.createTextNode('文字 '));
    var v = document.createElement('span');
    v.className = 'ef-size-v';
    v.setAttribute('data-noruby', '');
    btn.appendChild(v);
    function idx() {
      var cur = opt.get(), best = 0;
      for (var i = 1; i < steps.length; i++) if (Math.abs(steps[i][0] - cur) < Math.abs(steps[best][0] - cur)) best = i;
      return best;
    }
    function update() {
      var s = steps[idx()][1];
      v.textContent = s;
      btn.title = '文字の大きさ(いまは「' + s + '」。押すと変わる)';
      btn.setAttribute('aria-label', '文字の大きさ: ' + s);
    }
    btn.addEventListener('click', function () { opt.set(steps[(idx() + 1) % steps.length][0]); update(); });
    update();
    return update;
  }

  // ---- 表示の設定(文字の大きさ・ふりがな・くっきり。全教材で1つ) ----
  // 覚える場所は localStorage 'eduit.prefs' の1つだけ。どの教材で変えても、ほかの教材(同じページの iframe もほかのタブも)に効く。
  //   fs:      文字の大きさ(px)。FS_STEPS の 15・17・20・24 のどれか → <html> の --ef-fs
  //   ruby:    ふりがな(true / false。はじめは false)→ <html data-ef-ruby="on|off">
  //   kukkiri: くっきり(true / false)→ <html data-ef-kukkiri="on|off">(eduit-frame.css が字と線を濃くする)
  // 使い方:
  //   上のバーのボタンに data-ef-pref="fs" / "ruby" / "kukkiri" を付けるだけで、EduitFrame.mount() がボタンにする。
  //   ボタンのない教材(教材集の iframe の中など)は EduitFrame.prefs.use() を呼ぶ。どちらでも <html data-ef-prefs> になり、<html> の字が --ef-fs になる。
  //   ふりがなを付ける・外すなど、変わったときに教材ですることは EduitFrame.prefs.on(function (key, value) {…}) で受ける。
  var PREFS_KEY = 'eduit.prefs';
  var FS_STEPS = [[15, '小'], [17, '中'], [20, '大'], [24, '特大']];
  var PREF_DEFAULTS = { fs: 17, ruby: false, kukkiri: false };
  var prefListeners = [];
  function prefsLoad() {
    var v = {};
    try { v = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') || {}; } catch (e) {}
    var out = {};
    Object.keys(PREF_DEFAULTS).forEach(function (k) { out[k] = typeof v[k] === typeof PREF_DEFAULTS[k] ? v[k] : PREF_DEFAULTS[k]; });
    return out;
  }
  var prefState = prefsLoad();
  function prefsApply() {
    var h = document.documentElement;
    h.style.setProperty('--ef-fs', prefState.fs + 'px');
    h.setAttribute('data-ef-ruby', prefState.ruby ? 'on' : 'off');
    h.setAttribute('data-ef-kukkiri', prefState.kukkiri ? 'on' : 'off');
  }
  function prefsNotify(changed) {
    changed.forEach(function (k) { prefListeners.forEach(function (fn) { try { fn(k, prefState[k]); } catch (e) {} }); });
    prefsPaintButtons();
  }
  function prefGet(k) { return prefState[k]; }
  function prefSet(k, value) {
    if (!(k in PREF_DEFAULTS) || prefState[k] === value) return;
    prefState[k] = value;
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefState)); } catch (e) {}
    prefsApply();
    prefsNotify([k]);
  }
  function prefsUse() { document.documentElement.setAttribute('data-ef-prefs', ''); prefsApply(); }
  // ほかの教材(ほかのタブ・同じページの iframe)で変えたとき
  window.addEventListener('storage', function (e) {
    if (e.key !== PREFS_KEY) return;
    var old = prefState;
    prefState = prefsLoad();
    prefsApply();
    prefsNotify(Object.keys(PREF_DEFAULTS).filter(function (k) { return old[k] !== prefState[k]; }));
  });
  var prefSizeUpdates = [];
  function prefsPaintButtons() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-ef-pref="ruby"], [data-ef-pref="kukkiri"]'), function (b) {
      b.setAttribute('aria-pressed', prefState[b.getAttribute('data-ef-pref')] ? 'true' : 'false');
    });
    prefSizeUpdates.forEach(function (u) { u(); });
  }
  function prefsMountOne(b) {
    var k = b.getAttribute('data-ef-pref');
    b.setAttribute('data-ef-pref-done', '');
    if (k === 'fs') {
      prefSizeUpdates.push(sizeButton(b, { steps: FS_STEPS, get: function () { return prefState.fs; }, set: function (v) { prefSet('fs', v); } }));
    } else if (k === 'ruby' || k === 'kukkiri') {
      b.classList.add('ef-btn', 'ef-toggle');
      b.type = 'button';
      if (!b.textContent.trim()) b.textContent = k === 'ruby' ? 'ふりがな' : 'くっきり';
      b.addEventListener('click', function () { prefSet(k, !prefState[k]); });
    }
  }
  function prefsMount() {
    var btns = document.querySelectorAll('[data-ef-pref]:not([data-ef-pref-done])');
    if (!btns.length) return;
    prefsUse();
    Array.prototype.forEach.call(btns, prefsMountOne);
    prefsPaintButtons();
  }
  // JS で上のバーを作る教材用: EduitFrame.prefs.button('fs' | 'ruby' | 'kukkiri') で、もうボタンになったものを返す(置く場所は教材が決める)
  function prefsButton(k) {
    var b = el('button', { class: 'ef-btn', 'data-ef-pref': k });
    prefsUse();
    prefsMountOne(b);
    if (k !== 'fs') b.setAttribute('aria-pressed', prefState[k] ? 'true' : 'false');
    return b;
  }
  prefsApply();
  var prefs = {
    FS_STEPS: FS_STEPS, get: prefGet, set: prefSet, use: prefsUse, mount: prefsMount, button: prefsButton,
    on: function (fn) { prefListeners.push(fn); }
  };

  // ---- タブの帯をスクロールで隠す([data-ef-autohide]。下へ読み進めると隠れ、上へ戻すと出る) ----
  function autoHide() {
    var lastY = window.pageYOffset || 0, ticking = false;
    function bars() { return document.querySelectorAll('[data-ef-autohide]'); }
    function show(bar) { bar.classList.remove('ef-ah-hide'); }
    function run() {
      ticking = false;
      var y = window.pageYOffset || 0, dy = y - lastY;
      if (Math.abs(dy) < 6 && y > 0) return;
      lastY = y;
      Array.prototype.forEach.call(bars(), function (bar) {
        if (dy < 0 || y <= 0 || bar.contains(document.activeElement)) { show(bar); return; }
        if (bar.classList.contains('ef-ah-hide')) return;
        var cs = getComputedStyle(bar), top = parseFloat(cs.top) || 0;
        // 上に固定されている(画面の上にはりついている)ときだけ隠す
        if (cs.position !== 'sticky' && cs.position !== 'fixed') return;
        // 横長の帯だけを隠す。PC の左のメニュー(画面のはばの半分より細い)は、いつも見えるように残す
        if (bar.offsetWidth < window.innerWidth / 2) return;
        if (bar.getBoundingClientRect().top > top + 1) return;
        bar.style.setProperty('--ef-ah-y', -(top + bar.offsetHeight + 4) + 'px');
        bar.classList.add('ef-ah-hide');
      });
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(run); } }, { passive: true });
    document.addEventListener('focusin', function (e) {
      var bar = e.target.closest && e.target.closest('[data-ef-autohide]');
      if (bar) show(bar);
    });
    // 帯が横にスクロールするとき(スマホ)は、えらんでいるタブが見える位置まで帯を動かす
    function reveal() {
      Array.prototype.forEach.call(bars(), function (bar) {
        var t = bar.querySelector('[role=tab][aria-selected="true"], [aria-current="page"]');
        if (!t) return;
        for (var sc = t.parentElement; sc && sc !== bar.parentElement; sc = sc.parentElement) {
          if (sc.scrollWidth > sc.clientWidth + 1) {
            var r = t.getBoundingClientRect(), b = sc.getBoundingClientRect();
            if (r.left < b.left) sc.scrollLeft -= b.left - r.left + 12;
            else if (r.right > b.right) sc.scrollLeft += r.right - b.right + 12;
            return;
          }
        }
      });
    }
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('[data-ef-autohide]')) setTimeout(reveal, 50);
    });
    window.addEventListener('hashchange', function () { setTimeout(reveal, 50); });
    window.addEventListener('load', function () { setTimeout(reveal, 300); });
  }
  autoHide();

  // ---- 自習ガイド(自習モードのときだけ。アプリの右はしに「自習ガイド」を出す) ----
  function jishuData(c) {
    var J = (window.EDUIT_INFO || info).jishu;
    return c && J && J.apps ? J.apps[c] || null : null;
  }
  function appCode() {
    var a = (window.EDUIT_INFO || info).app || app;
    var m = /^([A-D]\d+|[GMFZ])\s/.exec(a.name || '');
    return m ? m[1] : null;
  }
  function jishuLoad(c) {
    try { var v = JSON.parse(localStorage.getItem(JS_STORE + c) || 'null'); if (v && typeof v === 'object') return { s: v.s || {}, q: v.q || {}, seen: !!v.seen }; } catch (e) {}
    return { s: {}, q: {}, seen: false };
  }
  function jishuSave(c, st) { try { localStorage.setItem(JS_STORE + c, JSON.stringify(st)); } catch (e) {} }
  function jishuSteps(d) {
    // 振り返りを隠す設定のときは、振り返りの手順を出さない。i は steps の中の番号(できたの印はこれで覚える)
    return (d.steps || []).map(function (s, i) { return { s: s, i: i }; }).filter(function (x) { return furikaeri || !x.s.reflect; });
  }
  // 進み具合: 基本の手順のうち「できた」の数、たしかめ問題の正解の数
  function jishuProgress(c) {
    var d = jishuData(c);
    if (!d) return null;
    var st = jishuLoad(c);
    var basic = jishuSteps(d).filter(function (x) { return x.s.level !== 'advanced'; });
    var ok = 0;
    (d.check || []).forEach(function (q, i) { if (st.q[i] === q.answer) ok++; });
    return {
      done: basic.filter(function (x) { return st.s[x.i]; }).length, steps: basic.length,
      ok: ok, checks: (d.check || []).length
    };
  }
  function progressText(p) {
    return '進め方 ' + p.done + '/' + p.steps + (p.checks ? '・たしかめ ' + p.ok + '/' + p.checks : '');
  }

  // 自習ガイドのふりがな: EDUIT_INFO.jishu.ruby(言葉 → 読み。shared/jishu-ruby.py で作る)の言葉に、長いものから順に付ける。
  // ガイドの上の「ふりがな」で消せる(はじめは付いている。その端末で覚える)
  var JS_RUBY = 'eduit.jishu.ruby', KJ = /[一-鿿々〆]/, rubyRe = null;
  function jishuRubyOn() { try { return localStorage.getItem(JS_RUBY) !== 'off'; } catch (e) { return true; } }
  function rubyDict() { var J = (window.EDUIT_INFO || info).jishu; return (J && J.ruby) || {}; }
  // 言葉の中のかなのところには付けない(「下げる」→ 下(さ)げる)。読みと合わないときは、言葉ぜんぶに付ける
  function rubyParts(k, r) {
    var parts = k.match(/[一-鿿々〆]+|[^一-鿿々〆]+/g);
    var m = new RegExp('^' + parts.map(function (p) { return KJ.test(p) ? '(.+?)' : '(' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')'; }).join('') + '$').exec(r);
    if (!m) return [[k, r]];
    return parts.map(function (p, i) { return [p, KJ.test(p) ? m[i + 1] : null]; });
  }
  function jishuRuby(node) {
    var D = rubyDict(), keys = Object.keys(D);
    if (!keys.length) return;
    if (!rubyRe) rubyRe = new RegExp(keys.sort(function (a, b) { return b.length - a.length; }).map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|'), 'g');
    var w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null), list = [];
    while (w.nextNode()) if (KJ.test(w.currentNode.nodeValue) && !w.currentNode.parentNode.closest('ruby, rt, script, style')) list.push(w.currentNode);
    list.forEach(function (n) {
      var s = n.nodeValue, f = document.createDocumentFragment(), last = 0, m;
      rubyRe.lastIndex = 0;
      while ((m = rubyRe.exec(s))) {
        if (m.index > last) f.appendChild(document.createTextNode(s.slice(last, m.index)));
        rubyParts(m[0], D[m[0]]).forEach(function (x) {
          f.appendChild(x[1] ? el('ruby', null, [x[0], el('rt', { text: x[1] })]) : document.createTextNode(x[0]));
        });
        last = m.index + m[0].length;
      }
      if (!last) return;
      if (last < s.length) f.appendChild(document.createTextNode(s.slice(last)));
      n.parentNode.replaceChild(f, n);
    });
  }

  // 振り返りを隠す設定のときは、タブの名前から「ふりかえり」を消す(D の「ふりかえり・記録」→「記録」など。教材の側も同じように変わる)
  function whereText(w) {
    return furikaeri ? w : w.replace(/(ふりかえり|振り返り)・/g, '').replace(/と(ふりかえり|振り返り)/g, '');
  }
  // c: 記号(なければアプリ名から)。1つのページの中でアプリを切りかえる教材集(C)は、開いたアプリの記号で呼びなおす(null でかくす)
  function jishuMount(c, appTitle) {
    if (!jishu) return;
    Array.prototype.forEach.call(document.querySelectorAll('.ef-jishu, .ef-jishu-fab'), function (e) { e.parentNode.removeChild(e); });
    document.documentElement.classList.remove('ef-jishu-open');
    if (c === undefined) c = appCode();
    var d = jishuData(c);
    if (!d) return;
    var st = jishuLoad(c);
    var narrow = function () { return window.innerWidth <= 640; };
    var fab = el('button', { type: 'button', class: 'ef-jishu-fab kz-norb no-ruby', 'data-noruby': '', 'aria-expanded': 'false', 'aria-controls': 'ef-jishu', title: '自習ガイド(ひとりで進めるときの案内)' }, [
      el('span', { class: 'ef-jishu-fab-t', text: '自習ガイド' }), el('span', { class: 'ef-jishu-fab-p' })
    ]);
    var close = el('button', { type: 'button', class: 'ef-btn', text: '閉じる' });
    var rb = Object.keys(rubyDict()).length ? el('button', { type: 'button', class: 'ef-btn ef-toggle ef-jishu-small', 'aria-pressed': String(jishuRubyOn()), text: 'ふりがな' }) : null;
    var body = el('div', { class: 'ef-jishu-body' });
    var name = appTitle || ((window.EDUIT_INFO || info).app || app).name || '';
    var panel = el('aside', { class: 'ef-jishu kz-norb no-ruby', 'data-noruby': '', id: 'ef-jishu', 'aria-label': '自習ガイド', hidden: '' }, [
      el('div', { class: 'ef-jishu-head' }, [
        el('h2', null, [el('span', { class: 'ef-jishu-k', text: '自習ガイド' }), code(d.label || c), el('span', { class: 'ef-jishu-name', text: name.replace(/^(?:[A-D]\d+|[GMFZ])\s*/, '') })]),
        rb, close
      ]),
      body
    ]);
    function save() { jishuSave(c, st); updateFab(); }
    function updateFab() {
      var p = jishuProgress(c);
      fab.querySelector('.ef-jishu-fab-p').textContent = p.done + '/' + p.steps;
    }
    function go(where) {
      if (!where) return;
      if (where.charAt(0) === '#') location.hash = where;
      else { var t = document.querySelector(where); if (t) t.click(); }
      if (narrow()) show(false);
    }
    function canGo(where) {
      if (!where) return false;
      if (where.charAt(0) === '#') return true;
      try { return !!document.querySelector(where); } catch (e) { return false; }
    }
    // 1つの手順に文が2つ以上あるときは、文ごとに行を分ける(読む人が、いまどこをしているか追いやすいように)
    function lines(t) {
      return String(t || '').replace(/。(?=[^」』）)])/g, '。\n').split('\n').map(function (x) { return el('span', { class: 'ef-jishu-line', text: x }); });
    }
    function stepEl(x, n) {
      var s = x.s;
      var cb = el('input', { type: 'checkbox', id: 'ef-js-s' + x.i });
      cb.checked = !!st.s[x.i];
      cb.addEventListener('change', function () { if (cb.checked) st.s[x.i] = 1; else delete st.s[x.i]; li.classList.toggle('is-done', cb.checked); save(); renderEnd(); });
      var tools = el('div', { class: 'ef-jishu-tools' });
      if (s.hint) {
        var hint = el('p', { class: 'ef-jishu-hint', hidden: '', text: s.hint });
        var hb = el('button', { type: 'button', class: 'ef-btn ef-jishu-small', 'aria-expanded': 'false', text: 'ヒント' });
        hb.addEventListener('click', function () { hint.hidden = !hint.hidden; hb.setAttribute('aria-expanded', String(!hint.hidden)); });
        tools.appendChild(hb);
      }
      if (canGo(s.go)) {
        var gb = el('button', { type: 'button', class: 'ef-btn ef-jishu-small', text: 'この場所へ ▶' });
        gb.addEventListener('click', function () { go(s.go); });
        tools.appendChild(gb);
      }
      var li = el('li', { class: 'ef-jishu-step' + (cb.checked ? ' is-done' : '') }, [
        el('div', { class: 'ef-jishu-step-hd' }, [
          el('span', { class: 'ef-jishu-n', text: String(n) }),
          s.where ? el('span', { class: 'ef-jishu-where', text: whereText(s.where) }) : null
        ]),
        el('p', { class: 'ef-jishu-do' }, lines(s.do)),
        tools,
        hint || null,
        el('label', { class: 'ef-jishu-done', for: 'ef-js-s' + x.i }, [cb, 'できた'])
      ]);
      if (s.reflect) li.setAttribute('data-ef-reflect', '');
      return li;
    }
    function checkEl(q, i) {
      var res = el('p', { class: 'ef-jishu-res', 'aria-live': 'polite' });
      var btns = (q.choices || []).map(function (t, j) {
        var b = el('button', { type: 'button', class: 'ef-jishu-choice', text: t });
        b.addEventListener('click', function () { st.q[i] = j; save(); paint(); renderEnd(); });
        return b;
      });
      function paint() {
        var a = st.q[i];
        btns.forEach(function (b, j) {
          b.classList.toggle('is-ok', a !== undefined && j === q.answer && a === q.answer);
          b.classList.toggle('is-ng', a !== undefined && j === a && a !== q.answer);
          b.setAttribute('aria-pressed', String(a === j));
        });
        while (res.firstChild) res.removeChild(res.firstChild);
        if (a === undefined) return;
        res.className = 'ef-jishu-res ' + (a === q.answer ? 'is-ok' : 'is-ng');
        res.appendChild(el('strong', { text: a === q.answer ? '正解!' : 'ちがいます。もう一度考えて、ほかのものを選ぼう。' }));
        if (a === q.answer && q.explain) res.appendChild(el('span', { text: ' ' + q.explain }));
        if (rb && jishuRubyOn()) jishuRuby(res);
      }
      paint();
      return el('li', { class: 'ef-jishu-q' }, [el('p', { class: 'ef-jishu-qt', text: q.q }), el('div', { class: 'ef-jishu-choices' }, btns), res]);
    }
    var endBox = el('div', { class: 'ef-jishu-end' });
    function renderEnd() {
      var p = jishuProgress(c);
      while (endBox.firstChild) endBox.removeChild(endBox.firstChild);
      var all = p.done === p.steps && p.ok === p.checks;
      endBox.classList.toggle('is-clear', all);
      endBox.appendChild(el('p', { class: 'ef-jishu-prog', text: progressText(p) }));
      endBox.appendChild(el('p', { text: all
        ? '基本はクリアです。発展に挑戦しよう。または、メニューにもどって次の教材へ進もう。'
        : 'できた手順に ✓ を付けよう。手順が全部できて、たしかめ問題が全部正解ならクリアです。' }));
      if (rb && jishuRubyOn()) jishuRuby(endBox);
    }
    function render() {
      while (body.firstChild) body.removeChild(body.firstChild);
      var steps = jishuSteps(d);
      var basic = steps.filter(function (x) { return x.s.level !== 'advanced'; });
      var adv = steps.filter(function (x) { return x.s.level === 'advanced'; });
      body.appendChild(el('section', { class: 'ef-jishu-goal' }, [
        el('h3', { text: 'ねらい' }), el('p', null, lines(d.goal)),
        d.time ? el('p', { class: 'ef-jishu-time', text: '時間の目安: ' + d.time }) : null
      ]));
      body.appendChild(el('section', null, [el('h3', { text: '進め方' }), el('ol', { class: 'ef-jishu-steps' }, basic.map(function (x, k) { return stepEl(x, k + 1); }))]));
      if (d.check && d.check.length) body.appendChild(el('section', null, [
        el('h3', { text: 'たしかめ問題' }),
        el('p', { class: 'ef-jishu-note', text: '進め方が終わったら答えよう。わからないときは、教材にもどって確かめよう。' }),
        el('ol', { class: 'ef-jishu-qs' }, d.check.map(checkEl))
      ]));
      body.appendChild(endBox);
      renderEnd();
      if (adv.length) {
        var det = el('details', { class: 'ef-jishu-adv' }, [
          el('summary', { text: '発展(基本が終わった人)' }),
          el('ol', { class: 'ef-jishu-steps' }, adv.map(function (x, k) { return stepEl(x, k + 1); }))
        ]);
        body.appendChild(det);
      }
      if (rb && jishuRubyOn()) jishuRuby(body);
      document.dispatchEvent(new CustomEvent('eduit-jishu-render', { detail: panel }));
    }
    function show(on) {
      panel.hidden = !on;
      fab.setAttribute('aria-expanded', String(on));
      document.documentElement.classList.toggle('ef-jishu-open', on);
      if (on && !st.seen) { st.seen = true; save(); }
    }
    fab.addEventListener('click', function () { show(panel.hidden); if (!panel.hidden) close.focus(); });
    close.addEventListener('click', function () { show(false); fab.focus(); });
    if (rb) rb.addEventListener('click', function () {
      var on = !jishuRubyOn();
      try { localStorage.setItem(JS_RUBY, on ? 'on' : 'off'); } catch (e) {}
      rb.setAttribute('aria-pressed', String(on));
      render();
    });
    panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') { show(false); fab.focus(); } });
    render();
    updateFab();
    document.body.appendChild(fab);
    document.body.appendChild(panel);
    // はじめて開いた教材では、ガイドを開いておく
    if (!st.seen) show(true);
  }

  // メニュー(自習モードのとき): 基本編・発展編の上に進め方の説明、カードに進み具合
  function jishuMenuBox() {
    var J = info.jishu || {};
    return el('section', { class: 'ef-jishu-menu', 'aria-label': 'ひとりで進めるとき' }, [
      el('h3', { text: 'ひとりで進めるとき(自習モード)' }),
      J.lead ? el('p', { text: J.lead }) : null,
      el('ol', null, [
        el('li', { text: '基本編のカードを、おすすめの順番に開きます。' }),
        el('li', { text: '教材の右はしの「自習ガイド」を押すと、ねらいと進め方が出ます。上から順に進めます。できたら「できた」に ✓ を付けます。' }),
        el('li', { text: 'こまったら「ヒント」を押します。「この場所へ」を押すと、その手順のページに移ります。' }),
        el('li', { text: '最後に「たしかめ問題」に答えます。全部正解したら、次の教材へ進みます。' }),
        furikaeri ? el('li', { text: '振り返りを書きます。記録を書き出して、先生の指示どおりに出します。' }) : el('li', { text: '記録を書き出して、先生の指示どおりに出します。' })
      ])
    ]);
  }
  function jishuBadge(c) {
    var p = jishuProgress(c);
    if (!p) return null;
    var b = el('p', { class: 'ef-mcard-jishu', 'data-jishu-code': c }, [el('span', { class: 'ef-level-parts-k', text: '自習' }), progressText(p)]);
    if (p.done === p.steps && p.ok === p.checks) b.classList.add('is-clear');
    return b;
  }
  if (jishu) window.addEventListener('storage', function (e) {
    if (!e.key || e.key.indexOf(JS_STORE) !== 0) return;
    Array.prototype.forEach.call(document.querySelectorAll('.ef-mcard-jishu'), function (b) {
      var n = jishuBadge(b.getAttribute('data-jishu-code'));
      if (n) b.parentNode.replaceChild(n, b);
    });
  });


  // ---- まず考えよう(各節の導入の問い。id は学習コースの節の id) ----
  var LETS = {
    a11: { q: '身の回りの物を3つ選ぼう。それぞれ何の材料でできているかな?', hint: '机・はし・ペットボトルなど。木・金属・プラスチックのどれかな。' },
    a12: { q: '木・金属・プラスチックは、家や学校のどこに使われているかな?', hint: 'いすの脚、窓のわく、筆箱など。なぜその材料なのかも考えよう。' },
    a13: { q: '同じ紙でも、折ったり形を変えたりすると強くなるのはなぜだろう?', hint: '段ボールや、三角形の骨組みを思い出そう。' },
    a14: { q: '飲み物の容器には、どんな工夫があるかな? よく見てさがそう。', hint: '形・材料・ふたのつくりなどに注目しよう。' },
    a21: { q: '教室の机やいすで「こうだったらいいのに」と思うことは?', hint: '物を置く場所、すわり心地、片づけやすさなど。' },
    a22: { q: '作りたい物で、いちばん大事にしたいことは何かな?', hint: '大きさ・じょうぶさ・使いやすさなど。図にかく前に1つ決めよう。' },
    a23: { q: '材料や工具をむだなく用意するには、何を決めておくとよいかな?', hint: '部品の大きさと数、切る順番、使う工具など。' },
    a24: { q: 'のこぎりやげんのうを使うとき、気をつけることを思い出そう。', hint: '手の位置、まわりの人、服装など。' },
    a25: { q: '作った物で、はじめの「困った」は解決できたかな?', hint: 'できたこと・できなかったことを1つずつ考えよう。' },
    a31: { q: '自分の作品とお店の製品は、何がにていて何がちがうかな?', hint: '費用・安全・作る数などを考えよう。' },
    a32: { q: '木や金属をむだなく使うには、どんな技術があるとよいかな?', hint: 'リサイクルや、長く使える工夫など。' },
    b11: { q: '冬なのに、夏の野菜がお店にならぶのはなぜだろう?', hint: 'どこで、どうやって育てているかを考えよう。' },
    b12: { q: '畑の土を黒いシートでおおうと、作物に何がよいのだろう?', hint: '土の温度・水分・雑草のことを考えよう。' },
    b13: { q: 'キャベツが虫に食べられないようにするには、どんな世話が必要かな?', hint: '見回り、ネットをかける、間引きなど。' },
    b14: { q: '牛乳をたくさん出す牛は、どうやって生まれてきたのだろう?', hint: '育て方や、親えらびのくり返しを考えよう。' },
    b15: { q: '魚を「とる」だけでなく「育てる」のはなぜだろう?', hint: 'とれる量の変化や、食べる人の数を考えよう。' },
    b16: { q: '畑の野菜と、工場の中で育てる野菜は、何がちがうかな?', hint: '光・水・温度・費用のちがいを考えよう。' },
    b21: { q: '食べ物や環境のために、育てる技術で解決したいことは?', hint: '食べ物のむだ、水不足、育てる人がへることなど。' },
    b22: { q: '作物を育てる計画で、いちばん大事にしたいことは何かな?', hint: 'とれる量・費用・手間・安全など。順位をつけてみよう。' },
    b23: { q: 'ミニトマトの葉がしおれていたら、原因は何だと思う?', hint: '水・暑さ・根・病気・虫など、いくつも考えよう。' },
    b24: { q: '育てた結果を、どんな見方でふり返るとよいかな?', hint: 'できばえ、とれた量、かかった費用、安全など。' },
    b31: { q: '自分の育て方と農家の育て方は、何がにていて何がちがうかな?', hint: '育てる量や、費用・手間を考えよう。' },
    b32: { q: 'これからの農業や漁業に、どんな技術があるとよいかな?', hint: '人手が少なくても育てられる工夫など。' },
    c11: { q: '扇風機・電灯・テレビは、電気を何に変えて使っているかな?', hint: '光・熱・音・動き。1つの機器でいくつも変えていることもある。' },
    c12: { q: '風車の羽根の形や枚数を変えると、できる電気は変わるかな?', hint: '予想を立ててから確かめよう。' },
    c13: { q: 'コンセントの電気と乾電池の電気は、どこがちがうのかな?', hint: '電圧の大きさや、どこから来ているかを考えよう。' },
    c14: { q: '扇風機の風の強さを変えられるのは、どんなしくみかな?', hint: 'スイッチと、電気の流れる量に注目しよう。' },
    c15: { q: '電気の事故には、どんなものがあるかな? 原因も考えよう。', hint: 'たこ足配線、ぬれた手、こわれたコードなど。' },
    c16: { q: '扇風機の中で、羽根を回しているのは何だろう?', hint: 'モーターから羽根まで、力がどう伝わるかを考えよう。' },
    c17: { q: '自転車のペダルを1回こぐと、後ろの車輪は何回回るかな?', hint: '前と後ろの歯車の大きさ(歯の数)をくらべよう。' },
    c18: { q: '回る動きを、ほかの動きに変えている物をさがそう。', hint: 'ワイパー、ミシン、ポンプなど。まっすぐ・ゆれる動きに変わる。' },
    c19: { q: 'ねじの大きさが製品ごとにばらばらだったら、何が困るかな?', hint: '部品の交換や修理のときを考えよう。' },
    c110: { q: '新しい家電には、前の物よりどんな工夫があるかな?', hint: '省エネ、安全、使いやすさに注目しよう。' },
    c21: { q: '電気や機械で「あったらいいな」と思う物は何かな?', hint: '家や学校の明かり、温度、動く物など。' },
    c22: { q: '作りたい回路には、どんな部品が必要かな?', hint: '電源・スイッチ・明かりやモーター・安全のための部品。' },
    c23: { q: 'どんな動きをする模型を作りたいかな?', hint: '回る、行ったり来たりする、持ち上げる など。身近な物から考えよう。' },
    c24: { q: '作った物は、使う人にとって安全で便利だったかな?', hint: 'はたらき・使いやすさ・安全・環境への影響で考えよう。' },
    c31: { q: '自分の作品と会社の製品は、何がにていて何がちがうかな?', hint: '費用・安全・作る数などを考えよう。' },
    c32: { q: 'エネルギーをむだにしない技術には、どんなものがあるとよいかな?', hint: '電気をつくる・送る・使う、それぞれで考えよう。' },
    d11: { q: 'タブレットやスマホを、ふだん何のために使っているかな?', hint: '調べもの、連絡、写真、勉強など。' },
    d12: { q: 'タブレットに文字や命令を入れる方法は、いくつあるかな?', hint: 'キーボード、タッチ、声、カメラなど。' },
    d13: { q: '針の時計と数字の時計は、時刻の表し方がどうちがうかな?', hint: '針はなめらかに動く。数字はとびとびに変わる。' },
    d14: { q: 'Webページを見るとき、そのページはどこから来ているのだろう?', hint: '画面の上のアドレス(URL)を見てみよう。' },
    d15: { q: '大事な情報を守るには、どんな方法があるかな? 3つあげよう。', hint: 'パスワード、カギをかける、写しを取っておく など。' },
    d16: { q: 'ネットを使っていて、「こまった」と思ったことはあるかな?', hint: '知らない人からの連絡、写真ののせ方など。' },
    d17: { q: '情報の技術で、生活のどこが便利になったかな?', hint: '買い物、連絡、地図、学校の勉強など。' },
    d21: { q: 'ネットで、相手とやりとりしながら使うものには何があるかな?', hint: 'アンケート、チャット、ゲーム、予約など。' },
    d22: { q: 'よく使うアプリで「こうだったらいいのに」と思うことは?', hint: '入力しにくい、見つけにくい、知らせてほしい など。' },
    d23: { q: '作るコンテンツには、どんなボタンや表示が必要かな?', hint: '使う人が何を入れて、何が返ってくるかを考えよう。' },
    d24: { q: '画面の流れを図にかこう。何を入れて、何が出るかな?', hint: '入力 → 処理 → 出力の順に考えよう。' },
    d25: { q: 'できたコンテンツに、考えた機能は全部そろったかな?', hint: '友だちに使ってもらい、感想を聞こう。' },
    d31: { q: '人が操作しなくても、自動で動く物をさがそう。', hint: '自動ドア、エアコン、街灯、信号など。' },
    d32: { q: '自動で動く物は、何を「はかって」動きを決めているかな?', hint: '明るさ、温度、人がいるかどうか など。' },
    d33: { q: '自動で動くしくみを作るには、どんな部品が必要かな?', hint: 'センサ・コンピュータ・動かす部品の3つで考えよう。' },
    d34: { q: 'センサの値でどう動かすかを、先に言葉で書いてみよう。', hint: '「もし〜なら〜する」の形で書こう。' },
    d35: { q: '作ったしくみは、考えたとおりに動いたかな?', hint: 'うまくいかなかった場面を1つえらび、直し方を考えよう。' },
    d41: { q: '自分の作品の工夫を、社会の製品とくらべてみよう。', hint: '使いやすさ・安全・費用など。' },
    d42: { q: 'これからの社会に、どんな情報の技術があるとよいかな?', hint: 'AI、自動運転、遠くの人とのやりとりなど。よい点と心配な点も。' }
  };
  function letsCard(id) {
    var d = LETS[id];
    if (!d) return null;
    return el('section', { class: 'ef-lets', 'aria-label': 'まず考えよう' }, [
      el('p', { class: 'ef-lets-k', text: 'まず考えよう' }),
      el('p', { class: 'ef-lets-q', text: d.q }),
      d.hint ? el('details', { class: 'ef-lets-hint' }, [el('summary', { text: 'ヒント' }), el('p', { text: d.hint })]) : null
    ]);
  }
  // data-ef-lets の置き場所にカードを入れる(あとから作られた画面にも入れる)
  function fillLets() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-ef-lets]:not([data-ef-lets-done])'), function (box) {
      box.setAttribute('data-ef-lets-done', '');
      var c = letsCard(box.getAttribute('data-ef-lets'));
      if (c) box.appendChild(c);
    });
  }
  var letsTimer = 0;
  function watchLets() {
    fillLets();
    if (!window.MutationObserver) return;
    new MutationObserver(function () {
      if (letsTimer) return;
      letsTimer = setTimeout(function () { letsTimer = 0; fillLets(); }, 0);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  // ---- 字だけの表示(見た目 案1「教科書の目次」) ----
  // ボタン・見出し・説明の文についた絵文字をとる。字の記号にできるもの(✅ → ✓ など)は字の記号にする。
  // 絵文字だけの部分は、2つ外までの要素に字があれば(「💾<span>記録</span>」など)とり、なければ(部品の絵・盤面の絵など)そのまま。絵として残したい所には data-ef-emoji を付ける。
  var VS_TEXT = '\uFE0E';  // 字の形で出す(色の絵にしない)しるし
  // 絵文字だけの所でも字の記号にするもの: ✅✔→✓ ☑ ⭕→○ ❌✖❎→× ⬜→□ ⚠ ➡⬅⬆⬇→矢印 ▶ ◀
  var EMOJI_TO_TEXT = {
    '\u2705': '\u2713', '\u2714': '\u2713', '\u2611': '\u2611' + VS_TEXT, '\u2B55': '\u25CB', '\u274C': '\u00D7', '\u2716': '\u00D7', '\u274E': '\u00D7',
    '\u2B1C': '\u25A1', '\u26A0': '\u26A0' + VS_TEXT, '\u27A1': '\u2192', '\u2B05': '\u2190', '\u2B06': '\u2191', '\u2B07': '\u2193', '\u25B6': '\u25B6' + VS_TEXT, '\u25C0': '\u25C0' + VS_TEXT
  };
  var EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u2600-\u27BF\u2B00-\u2BFF\u231A-\u23FF\u2190-\u21FF\u25A0-\u25FF](?:\uFE0F|\uFE0E|[\u{1F3FB}-\u{1F3FF}])?(?:\u200D[\u{1F000}-\u{1FAFF}\u2600-\u27BF]\uFE0F?)*/gu;
  var KEEP_RE = /^[\u2190-\u21FF\u25A0-\u25FF\u2605\u2606\u2713\u2717\u2715\u270E\u2661\u2610]$/;  // 矢印・■□○△・★☆・✓✗✕・✎・♡・☐ はもとから字の記号なので残す
  var LETTER_RE = /[0-9A-Za-z\u3040-\u30FF\u3400-\u9FFF\uFF10-\uFF5A]/;
  var CUT = '\u0000';
  // t の中か、t をすぐに包む要素(ボタン・見出しなど)に字があれば、絵文字は飾りなのでとる
  function plainText(t, around) {
    var deco = LETTER_RE.test(t) || !!(around && LETTER_RE.test(around));
    var r = t.replace(EMOJI_RE, function (m) {
      var b = m.replace(/[\uFE0E\uFE0F\u200D]|[\u{1F3FB}-\u{1F3FF}]/gu, '');
      if (EMOJI_TO_TEXT[b] != null) return EMOJI_TO_TEXT[b];
      if (KEEP_RE.test(b) || !deco) return m;
      return CUT;
    });
    if (r.indexOf(CUT) < 0) return r;
    return r.replace(/\u0000[ \u3000]?/g, '').replace(/[ \u3000]\u0000/g, '');
  }
  // 絵文字だけの所のまわりの字: 2つ外の要素まで見る(「<button><span class="ic">💾</span>記録</button>」など)
  function around(p) {
    for (var k = 0; k < 2 && p; k++, p = p.parentElement) if (LETTER_RE.test(p.textContent)) return p.textContent;
    return '';
  }
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, CODE: 1, PRE: 1, IFRAME: 1 };
  function plainNode(n) {
    if (n.nodeType === 3) {
      var p = n.parentNode;
      if (!p || SKIP_TAGS[p.nodeName] || (p.closest && p.closest('svg, [data-ef-emoji], [contenteditable]'))) return;
      var t = plainText(n.nodeValue, LETTER_RE.test(n.nodeValue) ? '' : around(p));
      if (t !== n.nodeValue) n.nodeValue = t;
      return;
    }
    if (n.nodeType !== 1 || SKIP_TAGS[n.nodeName]) return;
    var w = document.createTreeWalker(n, 4), x, list = [];
    while ((x = w.nextNode())) list.push(x);
    list.forEach(plainNode);
  }
  function watchPlain() {
    if (!window.MutationObserver) return;
    new MutationObserver(function (ms) {
      ms.forEach(function (m) {
        if (m.type === 'characterData') plainNode(m.target);
        else Array.prototype.forEach.call(m.addedNodes, plainNode);
      });
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    plainNode(document.documentElement);
  }
  watchPlain();  // 読みこみの途中から見はる(はじめに絵文字が一瞬出ないように)

  window.EduitFrame = { AUTHOR: AUTHOR, furikaeri: furikaeri, jishu: jishu, open: open, howto: howto, footer: footer, aboutButton: aboutButton, fsButton: fsButton, mount: mount, levels: levels, card: card, code: code, menuTitle: menuTitle, sizeButton: sizeButton, prefs: prefs, jishuProgress: jishuProgress, jishuApp: function (c, title) { jishuSet = true; jishuMount(c, title); }, lets: function (id) { return LETS[id] || null; }, letsCard: letsCard };
  var jishuSet = false;  // 教材集が jishuApp で決めたときは、アプリ名から決めなおさない
  function start() { mount(); if (!jishuSet) jishuMount(); watchLets(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
