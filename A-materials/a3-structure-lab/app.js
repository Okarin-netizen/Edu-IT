/*
 * 構造強化ラボ(A3)app.js
 * 梁 / 枠と筋かい / 接合 / 設計課題 の4画面。計算は ../common/beam.js(window.Beam)。
 */
(function () {
  'use strict';
  var $ = G.$, $$ = G.$$, h = G.h;
  var APP = 'structure-lab';
  var SVGNS = 'http://www.w3.org/2000/svg';

  // このアプリで使う語の読み(共通辞書にないもの)
  G.ruby.add({
    '梁': 'はり', '枠': 'わく', '筋かい': 'すじかい', '接合': 'せつごう', '設計課題': 'せっけいかだい', '設計': 'せっけい',
    '課題': 'かだい', '記録': 'きろく', '名前': 'なまえ', '新しく': 'あたらしく', '始める': 'はじめる', '開く': 'ひらく',
    '書き出す': 'かきだす', '読みこむ': 'よみこむ', '画面': 'がめん', '切りかえ': 'きりかえ', '板': 'いた',
    '力': 'ちから', '曲がる': 'まがる', '曲がり方': 'まがりかた', '材料': 'ざいりょう', '厚み': 'あつみ', '形': 'かたち',
    '変えて': 'かえて', '比べよう': 'くらべよう', '比べる': 'くらべる', '比べて': 'くらべて', '結果': 'けっか', '前': 'まえ',
    '消す': 'けす', '実験': 'じっけん', '本物': 'ほんもの', '計算': 'けいさん', '気づいた': 'きづいた', '木目': 'もくめ',
    '節': 'ふし', '支え方': 'ささえかた', '支える': 'ささえる', '片方': 'かたほう', '固定': 'こてい', '片持ち': 'かたもち',
    '荷重': 'かじゅう', '集中': 'しゅうちゅう', '先': 'さき', '全体': 'ぜんたい', '分布': 'ぶんぷ', '重さ': 'おもさ',
    '支点間': 'してんかん', '距離': 'きょり', '断面': 'だんめん', '幅': 'はば', '高さ': 'たかさ', '本数': 'ほんすう',
    '箱形': 'はこがた', '字': 'じ', '倍': 'ばい', '足す': 'たす', '計算のしかた': 'けいさんのしかた',
    '断面二次モーメント': 'だんめんにじもーめんと', '決まる': 'きまる', '曲がりにくさ': 'まがりにくさ',
    '上': 'うえ', '横': 'よこ', '横材': 'よこざい', '左': 'ひだり', '右': 'みぎ', '補強': 'ほきょう',
    '三角形': 'さんかくけい', '四角形': 'しかくけい', '辺': 'へん', '長さ': 'ながさ', '変わらない': 'かわらない',
    '変わる': 'かわる', '角': 'かど', '節点': 'せってん', '身のまわり': 'みのまわり', '使われて': 'つかわれて',
    '部材': 'ぶざい', '方法': 'ほうほう', '強さ': 'つよさ', '選ぶ': 'えらぶ', '試す': 'ためす', '試した': 'ためした',
    '質量': 'しつりょう', '理由': 'りゆう', '実際': 'じっさい', '作る': 'つくる', '考える': 'かんがえる',
    '費用': 'ひよう', '見た目': 'みため', '作りやすさ': 'つくりやすさ', '安全': 'あんぜん', '応力': 'おうりょく',
    '安全率': 'あんぜんりつ', '余裕': 'よゆう', '注意': 'ちゅうい', '公式': 'こうしき', '範囲': 'はんい',
    '大きすぎて': 'おおきすぎて', '正しく': 'ただしく', '大きさ': 'おおきさ', '目安': 'めやす', '軽く': 'かるく',
    '以下': 'いか', '以上': 'いじょう', '条件': 'じょうけん', '合計': 'ごうけい', '本': 'ほん', '物': 'もの',
    '真ん中': 'まんなか', '壁': 'かべ', '棚板': 'たないた', '本棚': 'ほんだな', '棚': 'たな', '長い': 'ながい',
    '出た': 'でた', '両はし': 'りょうはし', '拡大': 'かくだい', '表示': 'ひょうじ', '問': 'もん', '正解': 'せいかい',
    '解説': 'かいせつ', '問題': 'もんだい', '答え': 'こたえ', '向く': 'むく', '場面': 'ばめん', '特徴': 'とくちょう',
    '弱い': 'よわい', '強い': 'つよい', '保存': 'ほぞん', '読みこみ': 'よみこみ', '失敗': 'しっぱい',
    '外す': 'はずす', '星': 'ほし', '軽い': 'かるい', '小さい': 'ちいさい', '大きい': 'おおきい', '次': 'つぎ',
    '面材': 'めんざい', '全面': 'ぜんめん', '張る': 'はる', '斜め': 'ななめ', '材': 'ざい', '掛け': 'がけ',
    '押す': 'おす', '引っ張られ': 'ひっぱられ', '押され': 'おされ', '保って': 'たもって', '少し': 'すこし',
    '固める': 'かためる', '受けて': 'うけて', '受け': 'うけ', '面': 'めん', '取り付け': 'とりつけ',
    '計算上': 'けいさんじょう', '構造': 'こうぞう', '構造強化': 'こうぞうきょうか', '強化': 'きょうか', '安心': 'あんしん',
    '言われます': 'いわれます', '分の': 'ぶんの', '曲がり': 'まがり', 'かけ方': 'かけかた', 'リブ付き': 'リブつき',
    'ヤング率': 'ヤングりつ', '代表': 'だいひょう', '使った': 'つかった', '使われる': 'つかわれる', '向き': 'むき',
    '水分': 'すいぶん', '大きく': 'おおきく', '変わります': 'かわります', '一般的': 'いっぱんてき', '文献値': 'ぶんけんち',
    '工業': 'こうぎょう', '便覧': 'びんらん', '理科年表': 'りかねんぴょう', '公開資料': 'こうかいしりょう', '丸めた': 'まるめた',
    '選んで': 'えらんで', '選び': 'えらび', '度': 'ど', '変わって': 'かわって', '打ちこみ': 'うちこみ', '打つ': 'うつ',
    '摩擦': 'まさつ', '止める': 'とめる', '少なく': 'すくなく', '手早く': 'てばやく', '引き抜く': 'ひきぬく', '引き抜き': 'ひきぬき',
    'くり返し': 'くりかえし', 'くり返せる': 'くりかえせる', '効き': 'きき', '効か': 'きか', '向いている': 'むいている',
    '仮組み': 'かりぐみ', '端': 'はし', '近すぎる': 'ちかすぎる', '割れ': 'われ', 'ねじ山': 'ねじやま', '外せる': 'はずせる',
    '外せない': 'はずせない', '何度': 'なんど', '付け外し': 'つけはずし', '広がり': 'ひろがり', '運ぶ': 'はこぶ', '家具': 'かぐ',
    '調整': 'ちょうせい', '付ければ': 'つければ', '強く': 'つよく', '見えない': 'みえない', '見える': 'みえる', '見せず': 'みせず',
    '乾く': 'かわく', '乾いて': 'かわいて', '乾かす': 'かわかす', '水': 'みず', '熱': 'ねつ', '貼り合わせ': 'はりあわせ',
    '組み合わせ': 'くみあわせ', '合った': 'あった', '圧着': 'あっちゃく', 'ほぞ組み': 'ほぞぐみ', '一方': 'いっぽう',
    '出っぱり': 'でっぱり', '作り': 'つくり', 'かみ合う': 'かみあう', '日本': 'にほん', '建築': 'けんちく', '正確': 'せいかく',
    '手間': 'てま', '縮む': 'ちぢむ', '机': 'つくえ', '脚': 'あし', '横木': 'よこぎ', '完成後': 'かんせいご', '完成': 'かんせい',
    '大きな': 'おおきな', '関係': 'かんけい', '教室': 'きょうしつ', '体育館': 'たいいくかん', '確かめる': 'たしかめる',
    '試作品': 'しさくひん', '仮に': 'かりに', '何枚': 'なんまい', '重ねて': 'かさねて', '厚い': 'あつい', '付ける': 'つける',
    '支えた': 'ささえた', '思った': 'おもった', '保てない': 'たもてない', '角材': 'かくざい', '伝統的': 'でんとうてき', '比較的': 'ひかくてき', '四角い': 'しかくい', '外から': 'そとから', '問中': 'もんちゅう', '前回': 'ぜんかい', '続き': 'つづき', '自動': 'じどう', '表で': 'ひょうで', '比べられます': 'くらべられます',
    '組み立て': 'くみたて', '分解': 'ぶんかい', '修理': 'しゅうり', '伝統的': 'でんとうてき', '技術': 'ぎじゅつ',
    '発展': 'はってん', 'ほぞ接ぎ': 'ほぞつぎ', '木ねじ': 'もくねじ', '接着剤': 'せっちゃくざい', '読み込む': 'よみこむ', '読み込み': 'よみこみ', '曲げ': 'まげ'
  });

  G.initApp({
    app: APP,
    title: '構造強化ラボ',
    files: ['app.css', 'app.js', 'frame.js', 'challenge.js', 'joints.js', '../common/materials.js', '../common/beam.js']
  });

  /* ---------- 状態と保存 ---------- */
  var DEFAULT_BEAM = { material: 'sugi', support: 'simple', loadType: 'point', loadKg: 10, span: 600,
    shape: 'rect', b: 200, t: 15, h: 40, ribs: 2, ribW: 15, ribH: 30 };
  function defaultState() {
    return {
      beam: Object.assign({}, DEFAULT_BEAM), pinned: null, measured: '', measuredNote: '',
      frame: { mode: 'none', note: '' },
      quiz: { answers: {} },
      challenge: { level: 'lv1', designs: {}, log: [], reflect: '', reflect2: '' }
    };
  }
  var work = G.newArtifact(APP, '構造強化ラボの記録', defaultState());
  var S = work.data;
  var saveTimer = null;

  function fill(st) {
    var d = defaultState();
    st = st || {};
    d.beam = Object.assign(d.beam, st.beam || {});
    d.pinned = st.pinned || null;
    d.measured = st.measured || ''; d.measuredNote = st.measuredNote || '';
    d.frame = Object.assign(d.frame, st.frame || {});
    d.quiz = Object.assign(d.quiz, st.quiz || {});
    d.challenge = Object.assign(d.challenge, st.challenge || {});
    if (!Array.isArray(d.challenge.log)) d.challenge.log = [];
    return d;
  }
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      work.title = $('#work-title').value.trim() || '構造強化ラボの記録';
      G.store.put(work).then(function () {
        $('#save-status').textContent = '自動で保存しました(' + new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) + ')';
      }).catch(function () { $('#save-status').textContent = '保存できませんでした。「ファイルに書き出す」で残してください。'; });
    }, 600);
  }
  function load(a) {
    work = a;
    work.data = fill(a.data);
    S = work.data;
    $('#work-title').value = work.title || '';
    renderAll();
  }

  /* ---------- 小物 ---------- */
  function svg(tag, attrs, parent) {
    var el = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(el);
    return el;
  }
  function txt(parent, x, y, s, attrs) {
    var t = svg('text', Object.assign({ x: x, y: y, 'font-size': 13, fill: 'currentColor' }, attrs || {}), parent);
    t.textContent = s;
    return t;
  }
  function fmt(n, d) { return G.fmt(n, d); }
  function fmtSig(n) { // 有効数字ていど
    if (!isFinite(n)) return '—';
    var a = Math.abs(n);
    return fmt(n, a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3);
  }
  function matName(id) { var m = Beam.MATERIALS[id]; return m ? m.name : id; }
  var SHAPE_NAMES = { rect: '板', ribbed: 'リブ付き', L: 'L形', channel: 'コの字', box: '箱形' };
  function sectionSpec(b) {
    var s = { shape: b.shape, b: b.b, t: b.t };
    if (b.shape === 'ribbed') { s.ribs = b.ribs; s.ribW = b.ribW; s.ribH = b.ribH; }
    if (b.shape === 'L' || b.shape === 'channel' || b.shape === 'box') s.h = b.h;
    return s;
  }
  function analyzeBeam(b) {
    return Beam.analyze({ material: b.material, section: sectionSpec(b), span: b.span, loadKg: b.loadKg,
      support: b.support, loadType: b.loadType });
  }
  function describe(b) {
    var s = matName(b.material) + '・' + SHAPE_NAMES[b.shape] + ' ' + b.b + '×' + b.t + 'mm';
    if (b.shape === 'ribbed') s += '(リブ' + b.ribs + '本 ' + b.ribW + '×' + b.ribH + ')';
    if (b.shape === 'L' || b.shape === 'channel' || b.shape === 'box') s += '・高さ' + b.h + 'mm';
    return s;
  }
  function levelBadge(lv) {
    return h('span', { class: 'level ' + lv.id }, h('span', { class: 'mark', 'aria-hidden': 'true' }, lv.mark), lv.label);
  }

  /* ---------- 梁の図(梁タブと設計課題で共用) ---------- */
  // opts: { support, loadType, loadKg, sectionHeight, curves:[{r, style:'now'|'before'}], width }
  function drawBeam(el, opts) {
    while (el.firstChild) el.removeChild(el.firstChild);
    var W = 640, x0 = 50, x1 = 600, yb = 90, span = x1 - x0;
    var thick = Math.max(6, Math.min(26, 6 + (opts.sectionHeight || 15) * 0.35));
    var cant = opts.support === 'cantilever';
    var good = opts.curves.filter(function (c) { return c.r && c.r.ok && isFinite(c.r.deflection); });
    var L = good.length ? good[0].r.L : 600, scale = span / L;
    var maxD = 0;
    good.forEach(function (c) { maxD = Math.max(maxD, c.r.deflection); });
    var realPx = maxD * scale, room = 70, mag = 1;
    if (realPx > 0 && realPx < room) mag = Math.min(500, room / realPx);
    if (mag > 1.5) mag = Math.floor(mag); else mag = 1;

    // 支え
    if (cant) {
      svg('rect', { x: x0 - 26, y: yb - 50, width: 26, height: 110, fill: 'url(#hatch-' + el.id + ')', stroke: 'currentColor' }, el);
    } else {
      [x0, x1].forEach(function (x, i) {
        svg('path', { d: 'M' + x + ' ' + (yb + thick / 2) + ' l-12 20 h24 z', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, el);
        if (i === 1) svg('circle', { cx: x, cy: yb + thick / 2 + 25, r: 4, fill: 'none', stroke: 'currentColor' }, el);
      });
      svg('line', { x1: x0 - 30, y1: yb + thick / 2 + 30, x2: x1 + 30, y2: yb + thick / 2 + 30, stroke: 'currentColor', 'stroke-width': 1, 'stroke-dasharray': '4 3' }, el);
    }
    var defs = svg('defs', {}, el);
    var pat = svg('pattern', { id: 'hatch-' + el.id, width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    svg('line', { x1: 0, y1: 0, x2: 0, y2: 8, stroke: 'currentColor', 'stroke-width': 2 }, pat);

    // 元の位置(細い点線)
    svg('line', { x1: x0, y1: yb, x2: x1, y2: yb, stroke: 'currentColor', 'stroke-opacity': .35, 'stroke-dasharray': '2 4' }, el);

    function pts(r) {
      var a = [];
      for (var i = 0; i <= 60; i++) {
        var x = L * i / 60;
        var dy = r.deflection * Beam.shape(x, L, r.support, r.loadType) * scale * mag;
        a.push([x0 + x * scale, yb + Math.min(dy, 120)]);
      }
      return a;
    }
    // 比べる前(点線)→ いま(板)
    opts.curves.slice().reverse().forEach(function (c) {
      if (!c.r || !c.r.ok) return;
      var p = pts(c.r);
      if (c.style === 'before') {
        svg('polyline', { points: p.map(function (q) { return q.join(','); }).join(' '), fill: 'none', stroke: 'var(--before)', 'stroke-width': 3, 'stroke-dasharray': '9 6' }, el);
      } else {
        var top = p.map(function (q) { return q[0] + ',' + (q[1] - thick / 2); });
        var bot = p.slice().reverse().map(function (q) { return q[0] + ',' + (q[1] + thick / 2); });
        svg('polygon', { points: top.concat(bot).join(' '), fill: 'var(--beam)', stroke: 'var(--beam-line)', 'stroke-width': 2 }, el);
        var tip = cant ? p[p.length - 1] : p[30];
        if (c.r.deflection > 0) {
          txt(el, tip[0] + (cant ? -80 : 14), tip[1] + thick / 2 + 20, 'たわみ ' + fmtSig(c.r.deflection) + ' mm', { 'font-weight': 'bold' });
        }
      }
    });
    if (!good.length) {
      svg('rect', { x: x0, y: yb - thick / 2, width: span, height: thick, fill: 'none', stroke: 'currentColor', 'stroke-dasharray': '6 4' }, el);
    }

    // 荷重の矢印
    var now = opts.curves[0] && opts.curves[0].r && opts.curves[0].r.ok ? opts.curves[0].r : null;
    function yAt(x) { return now ? yb + Math.min(now.deflection * Beam.shape((x - x0) / scale, L, now.support, now.loadType) * scale * mag, 120) : yb; }
    function arrow(x, len) {
      var y = yAt(x) - thick / 2 - 2;
      svg('line', { x1: x, y1: y - len, x2: x, y2: y - 6, stroke: 'var(--load)', 'stroke-width': 3 }, el);
      svg('path', { d: 'M' + x + ' ' + y + ' l-6 -10 h12 z', fill: 'var(--load)' }, el);
    }
    if (opts.loadKg > 0) {
      if (opts.loadType === 'uniform') {
        for (var i = 0; i <= 10; i++) arrow(x0 + span * i / 10, 26);
        txt(el, x0 + span / 2 - 20, yb - 52, fmt(opts.loadKg, 1) + ' kg', { fill: 'var(--load)', 'font-weight': 'bold' });
      } else {
        var ax = cant ? x1 : x0 + span / 2;
        arrow(ax, 44);
        txt(el, ax + (cant ? -60 : 8), yb - 52, fmt(opts.loadKg, 1) + ' kg', { fill: 'var(--load)', 'font-weight': 'bold' });
      }
    }
    // 支点間の距離
    var yd = 228;
    svg('line', { x1: x0, y1: yd, x2: x1, y2: yd, stroke: 'currentColor' }, el);
    [x0, x1].forEach(function (x) { svg('line', { x1: x, y1: yd - 6, x2: x, y2: yd + 6, stroke: 'currentColor' }, el); });
    txt(el, x0 + span / 2 - 30, yd - 6, 'L = ' + fmt(L, 0) + ' mm');
    return { mag: mag };
  }

  // 断面の図
  function drawSection(el, sec, b) {
    while (el.firstChild) el.removeChild(el.firstChild);
    if (!sec.ok) { txt(el, 10, 64, '?', { 'font-size': 28 }); return; }
    var W = 140, H = 90;
    var s = Math.min(W / b.b, H / Math.max(sec.height, 1));
    var w = b.b * s, hh = sec.height * s, ox = 10 + (W - w) / 2, oy = 15 + (H + hh) / 2;
    var ribs = sec.rects.slice(1);
    sec.rects.forEach(function (r, i) {
      var x;
      if (b.shape === 'ribbed' && i > 0) {
        var n = ribs.length, idx = i - 1;
        x = n === 1 ? (b.b - r.w) / 2 : (b.b - r.w) * idx / (n - 1);
      } else if ((b.shape === 'channel' && i === 2) || (b.shape === 'box' && i === 3)) x = b.b - r.w;
      else x = 0;
      svg('rect', { x: ox + x * s, y: oy - (r.y + r.h) * s, width: Math.max(r.w * s, 1), height: Math.max(r.h * s, 1),
        fill: 'var(--beam)', stroke: 'var(--beam-line)', 'stroke-width': 1 }, el);
    });
    // 図心の線
    svg('line', { x1: 4, y1: oy - sec.yc * s, x2: 156, y2: oy - sec.yc * s, stroke: 'currentColor', 'stroke-dasharray': '3 3', 'stroke-opacity': .6 }, el);
    txt(el, ox + w / 2 - 4, 12, 'b', { 'font-size': 11 });
  }

  /* ---------- 1 梁 ---------- */
  var F = {};
  function initBeam() {
    var sel = $('#b-material');
    Object.keys(Beam.MATERIALS).forEach(function (id) {
      sel.appendChild(h('option', { value: id }, Beam.MATERIALS[id].name));
    });
    ['material', 'load', 'span', 'b', 't', 'h', 'ribs', 'ribw', 'ribh'].forEach(function (k) { F[k] = $('#b-' + k); });
    F.loadR = $('#b-load-r'); F.spanR = $('#b-span-r');
    $('#beam-form').addEventListener('input', function (e) {
      var B = S.beam;
      var t = e.target;
      if (t === F.loadR) F.load.value = F.loadR.value;
      if (t === F.spanR) F.span.value = F.spanR.value;
      B.material = F.material.value;
      B.support = ($('input[name=b-support]:checked') || {}).value || 'simple';
      B.loadType = ($('input[name=b-load-type]:checked') || {}).value || 'point';
      B.shape = ($('input[name=b-shape]:checked') || {}).value || 'rect';
      B.loadKg = G.num(F.load.value, NaN);
      B.span = G.num(F.span.value, NaN);
      B.b = G.num(F.b.value, NaN); B.t = G.num(F.t.value, NaN); B.h = G.num(F.h.value, NaN);
      B.ribs = G.num(F.ribs.value, 0, 0, 6); B.ribW = G.num(F.ribw.value, NaN); B.ribH = G.num(F.ribh.value, NaN);
      if (t !== F.loadR && isFinite(B.loadKg)) F.loadR.value = B.loadKg;
      if (t !== F.spanR && isFinite(B.span)) F.spanR.value = B.span;
      if (t.name === 'b-shape') shapeDefaults(B);
      renderBeam(); save();
    });
    $$('[data-quick]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var B = S.beam, q = btn.getAttribute('data-quick');
        if (q === 't2' && isFinite(B.t)) B.t = B.t * 2;
        if (q === 'b2' && isFinite(B.b)) B.b = B.b * 2;
        if (q === 'rib') { if (B.shape !== 'ribbed') { B.shape = 'ribbed'; B.ribs = 1; } else B.ribs = Math.min(6, (B.ribs || 0) + 1); if (!(B.ribW > 0)) B.ribW = 15; if (!(B.ribH > 0)) B.ribH = 30; }
        if (q === 'reset') S.beam = Object.assign({}, DEFAULT_BEAM);
        writeBeamForm(); renderBeam(); save();
      });
    });
    $('#btn-pin').addEventListener('click', function () {
      S.pinned = Object.assign({}, S.beam);
      renderBeam(); save();
      G.toast('いまの設計を「比べる前」にしました。条件を変えて比べてみよう。');
    });
    $('#btn-unpin').addEventListener('click', function () { S.pinned = null; renderBeam(); save(); });
    $('#measured').addEventListener('input', function () { S.measured = $('#measured').value; renderMeasured(analyzeBeam(S.beam)); save(); });
    $('#measured-note').addEventListener('input', function () { S.measuredNote = $('#measured-note').value; save(); });
    var src = $('#beam-source');
    src.appendChild(G.noteEstimate('数値は材料の代表値を使った目安です。実際の木材は、節・木目の向き・水分などで大きく変わります。' + Beam.SOURCE));
  }
  function shapeDefaults(B) {
    // 形を切りかえたとき、そのままでは作れない寸法を直す
    if (B.shape === 'L' || B.shape === 'channel' || B.shape === 'box') {
      if (B.b > 200) B.b = 40;
      if (B.t > 10) B.t = 3;
      if (!(B.h > 2 * B.t)) B.h = 40;
      if (B.material !== 'steel' && B.material !== 'aluminum' && !shapeDefaults.told) { shapeDefaults.told = true; G.toast('L形・コの字・箱形は、金属の板を曲げた部材によく使われる形です。'); }
      writeBeamForm();
    } else if (B.shape === 'ribbed') {
      if (!(B.ribs > 0)) B.ribs = 2;
      writeBeamForm();
    }
  }
  function writeBeamForm() {
    var B = S.beam;
    F.material.value = B.material;
    $$('input[name=b-support]').forEach(function (r) { r.checked = r.value === B.support; });
    $$('input[name=b-load-type]').forEach(function (r) { r.checked = r.value === B.loadType; });
    $$('input[name=b-shape]').forEach(function (r) { r.checked = r.value === B.shape; });
    function v(x) { return isFinite(x) ? String(x) : ''; }
    F.load.value = v(B.loadKg); F.loadR.value = v(B.loadKg);
    F.span.value = v(B.span); F.spanR.value = v(B.span);
    F.b.value = v(B.b); F.t.value = v(B.t); F.h.value = v(B.h);
    F.ribs.value = v(B.ribs); F.ribw.value = v(B.ribW); F.ribh.value = v(B.ribH);
    $('#measured').value = S.measured || '';
    $('#measured-note').value = S.measuredNote || '';
  }
  function renderBeam() {
    var B = S.beam;
    $$('[data-shape]').forEach(function (el) { el.hidden = el.getAttribute('data-shape').split(' ').indexOf(B.shape) < 0; });
    $$('[data-when]').forEach(function (el) { el.hidden = el.getAttribute('data-when') !== B.support; });
    var r = analyzeBeam(B);
    var pr = S.pinned ? analyzeBeam(S.pinned) : null;
    var sameView = pr && r.ok && pr.ok && pr.L === r.L && pr.support === r.support;
    var sec = Beam.section(sectionSpec(B));
    drawSection($('#section-svg'), sec, B);
    var curves = [{ r: r, style: 'now' }];
    if (sameView) curves.push({ r: pr, style: 'before' });
    var d = drawBeam($('#beam-svg'), { support: B.support, loadType: B.loadType, loadKg: B.loadKg, sectionHeight: sec.ok ? sec.height : 15, curves: curves });

    var desc = $('#beam-svg-desc');
    var leg = $('#beam-legend');
    leg.innerHTML = '';
    leg.appendChild(h('span', null, h('span', { class: 'sw', 'aria-hidden': 'true' }), 'いま'));
    if (sameView) leg.appendChild(h('span', null, h('span', { class: 'sw before', 'aria-hidden': 'true' }), '比べる前(点線)'));
    else if (pr && pr.ok) leg.appendChild(h('span', { class: 'g-muted' }, '支え方か支点間の距離がちがうので、「比べる前」は図に重ねていません(表で比べられます)。'));

    var out = $('#beam-result');
    out.innerHTML = '';
    if (!r.ok) {
      desc.textContent = '条件を直すと、曲がり方が表示されます。';
      out.appendChild(h('p', { class: 'error', role: 'alert' }, '計算できません:' + r.error));
    } else {
      desc.textContent = (d.mag > 1 ? 'たわみを' + d.mag + '倍に拡大して表示しています。' : 'たわみを実際の大きさで表示しています。') +
        ' いまのたわみは ' + fmtSig(r.deflection) + 'mm です。';
      out.appendChild(h('div', { class: 'results' },
        stat('たわみ(曲がる量)', fmtSig(r.deflection), 'mm'),
        h('div', { class: 'stat' }, h('span', { class: 'k' }, '強さの余裕'), levelBadge(r.level)),
        stat('重さ', fmtSig(r.mass * 1000), 'g')));
      out.appendChild(h('details', { class: 'more' },
        h('summary', null, 'くわしく見る(発展)'),
        h('div', { class: 'results' },
          stat('曲げの応力(目安)', fmtSig(r.stress), 'N/mm²'),
          stat('安全率(強さ ÷ 応力)', isFinite(r.safety) ? fmt(r.safety, 1) : '—', ''),
          stat('断面二次モーメント I', fmtSig(r.I), 'mm⁴')),
        h('p', { class: 'g-muted' }, '安全率は、材料の強さが板の中の力(応力)の何倍あるかを表す数。3以上で「○ 余裕あり」、1.5〜3で「△ 注意」、1.5より小さいと「! こわれるおそれ」と表示しています。')));
      if (r.deflection > 0 && isFinite(r.ratio) && r.ratio >= 2) {
        out.appendChild(h('p', null, 'たわみは支点間の距離の 約 1/' + fmt(r.ratio, 0) + '。棚板なら 1/200 より小さいと安心と言われます。'));
      }
      if (r.warnings.length) out.appendChild(h('ul', { class: 'warn-list' }, r.warnings.map(function (w) { return h('li', null, '⚠ ' + w); })));
    }
    $('#btn-unpin').hidden = !S.pinned;
    renderCompare(r, pr);
    renderMeasured(r);
    $('#formula-text').textContent = formulaText(B);
  }
  function stat(k, v, u) {
    return h('div', { class: 'stat' }, h('span', { class: 'k' }, k), h('span', { class: 'v' }, v), h('span', { class: 'u' }, u));
  }
  function formulaText(B) {
    var f = { simple: { point: 'δ = P × L³ ÷ (48 × E × I)', uniform: 'δ = 5 × P × L³ ÷ (384 × E × I)' },
      cantilever: { point: 'δ = P × L³ ÷ (3 × E × I)', uniform: 'δ = P × L³ ÷ (8 × E × I)' } }[B.support][B.loadType];
    return 'たわみ ' + f + '(P: 荷重 N、L: 支点間の距離 mm、E: ヤング率 N/mm²、I: 断面二次モーメント mm⁴)。1kg のおもりは 約 9.8N の力。';
  }
  function renderCompare(r, pr) {
    var box = $('#beam-compare');
    box.innerHTML = '';
    if (!S.pinned) { box.appendChild(h('p', { class: 'g-muted' }, '「比べる前」を決めてから条件を変えると、2つの結果を重ねて比べられます。')); return; }
    if (!r.ok || !pr || !pr.ok) { box.appendChild(h('p', { class: 'g-muted' }, '比べる前:' + describe(S.pinned))); return; }
    function ratio(a, b) { return b > 0 && isFinite(a / b) ? fmt(a / b, 2) + ' 倍' : '—'; }
    function table(rows) {
      return h('div', { class: 'g-table-wrap' }, h('table', { class: 'g-table cmp' },
        h('thead', null, h('tr', null, h('th', null, ''), h('th', { class: 'num' }, '比べる前'), h('th', { class: 'num' }, 'いま'), h('th', { class: 'num' }, 'いま ÷ 前'))),
        h('tbody', null, rows.map(function (row) {
          if (row[3] === 'level') return h('tr', null, h('th', null, row[0]), h('td', { class: 'num' }, row[1].mark + ' ' + row[1].label), h('td', { class: 'num' }, row[2].mark + ' ' + row[2].label), h('td', { class: 'num' }, '—'));
          return h('tr', null, h('th', null, row[0]), h('td', { class: 'num' }, fmtSig(row[1])), h('td', { class: 'num' }, fmtSig(row[2])), h('td', { class: 'num cmp-ratio' }, ratio(row[2], row[1])));
        }))));
    }
    box.appendChild(table([
      ['たわみ(mm)', pr.deflection, r.deflection],
      ['強さの余裕', pr.level, r.level, 'level'],
      ['重さ(g)', pr.mass * 1000, r.mass * 1000]
    ]));
    box.appendChild(h('details', { class: 'more' }, h('summary', null, 'くわしく見る(発展)'), table([
      ['曲げの応力(N/mm²)', pr.stress, r.stress],
      ['安全率', pr.safety, r.safety]
    ])));
    box.appendChild(h('p', { class: 'g-muted' }, '比べる前:' + describe(S.pinned) + '/ いま:' + describe(S.beam)));
    if (pr.deflection > 0 && r.deflection > 0) {
      var k = r.deflection / pr.deflection, m = (r.mass / pr.mass);
      var msg = k < 1 ? 'たわみは ' + fmt(1 / k, 1) + '分の1 になった(曲がりにくくなった)。' : k > 1 ? 'たわみは ' + fmt(k, 1) + '倍 になった(曲がりやすくなった)。' : 'たわみは同じ。';
      if (isFinite(m) && Math.abs(m - 1) > 0.01) msg += ' 重さは ' + fmt(m, 2) + '倍。';
      box.appendChild(h('p', { class: 'cmp-ratio' }, msg));
    }
  }
  function renderMeasured(r) {
    var out = $('#measured-out');
    var m = G.num(S.measured, NaN);
    if (!isFinite(m) || !r.ok || !(r.deflection > 0)) { out.textContent = ''; return; }
    var k = m / r.deflection;
    out.textContent = '実験 ' + fmtSig(m) + 'mm ÷ 計算 ' + fmtSig(r.deflection) + 'mm = ' + fmt(k, 2) + '倍。' +
      (k > 1.3 ? '計算より大きく曲がった。節や木目、支え方のずれなどが原因かもしれない。' :
       k < 0.77 ? '計算より曲がらなかった。木材の性質は1本ごとにちがう。' : '計算とだいたい合っている。');
  }

  /* ---------- 2 枠と筋かい ---------- */
  var FW = 220, FH = 200, FX = 100, FY = 290;
  var push = 0, dragging = null;
  function initFrame() {
    var box = $('#frame-modes');
    Object.keys(Frame.MODES).forEach(function (id) {
      box.appendChild(h('label', null, h('input', { type: 'radio', name: 'frame-mode', value: id }), ' ' + Frame.MODES[id].label));
    });
    box.addEventListener('change', function () {
      S.frame.mode = ($('input[name=frame-mode]:checked') || {}).value || 'none';
      push = 0; renderFrame(); save();
    });
    $('#frame-left').addEventListener('click', function () { setPush(push - 20); });
    $('#frame-right').addEventListener('click', function () { setPush(push + 20); });
    $('#frame-reset').addEventListener('click', function () { setPush(0); });
    $('#frame-note').addEventListener('input', function () { S.frame.note = $('#frame-note').value; save(); });
    var el = $('#frame-svg');
    el.addEventListener('pointerdown', function (e) {
      if (!e.target.closest('.handle')) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      dragging = { x: toSvgX(el, e.clientX), push: push };
      e.target.closest('.handle').focus();
    });
    el.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      setPush(dragging.push + (toSvgX(el, e.clientX) - dragging.x));
    });
    function end() {
      if (!dragging) return;
      dragging = null;
      // 補強がある枠は、手をはなすと(弾性で)もとにもどる
      if (S.frame.mode !== 'none') springBack();
    }
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
  function toSvgX(el, cx) {
    var r = el.getBoundingClientRect();
    return (cx - r.left) * 420 / r.width;
  }
  function setPush(p) { push = Math.max(-140, Math.min(140, p)); renderFrame(); }
  function springBack() {
    var start = push, t0 = performance.now();
    (function step(t) {
      if (dragging) return;
      var k = Math.min(1, (t - t0) / 300);
      push = start * (1 - k);
      renderFrame();
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  function renderFrame() {
    var mode = S.frame.mode;
    var radio = $('input[name=frame-mode][value="' + mode + '"]');
    if (radio) radio.checked = true;
    var d = Frame.deform(mode, push, FW, FH);
    var el = $('#frame-svg');
    var hadFocus = document.activeElement && document.activeElement.closest && document.activeElement.closest('#frame-svg .handle');
    while (el.firstChild) el.removeChild(el.firstChild);
    function P(n) { return [FX + n[0], FY - n[1]]; }
    var N = { bl: P(d.nodes.bl), br: P(d.nodes.br), tl: P(d.nodes.tl), tr: P(d.nodes.tr) };
    var defs = svg('defs', {}, el);
    var pat = svg('pattern', { id: 'fhatch', width: 10, height: 10, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    svg('line', { x1: 0, y1: 0, x2: 0, y2: 10, stroke: 'var(--beam-line)', 'stroke-width': 2 }, pat);
    // 地面
    svg('rect', { x: 20, y: FY + 8, width: 380, height: 14, fill: 'none', stroke: 'currentColor' }, el);
    svg('line', { x1: 20, y1: FY + 8, x2: 400, y2: FY + 8, stroke: 'currentColor', 'stroke-width': 2 }, el);
    // 面材
    if (mode === 'panel') {
      svg('polygon', { points: [N.bl, N.br, N.tr, N.tl].join(' '), fill: 'url(#fhatch)', 'fill-opacity': .7, stroke: 'none' }, el);
    }
    // すみ板
    if (mode === 'corner') {
      [['tl', 'tr', 'bl'], ['tr', 'tl', 'br']].forEach(function (c) {
        var o = N[c[0]], a = N[c[1]], b = N[c[2]];
        function along(p, q, len) { var dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy); return [p[0] + dx * len / L, p[1] + dy * len / L]; }
        svg('polygon', { points: [o, along(o, a, 55), along(o, b, 55)].join(' '), fill: 'var(--beam)', stroke: 'var(--beam-line)', 'stroke-width': 2 }, el);
      });
    }
    function member(a, b, w, color, dash) {
      svg('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: color || 'var(--beam-line)', 'stroke-width': w || 12, 'stroke-linecap': 'round', 'stroke-dasharray': dash || '' }, el);
    }
    member(N.bl, N.br); member(N.bl, N.tl); member(N.br, N.tr);
    // 筋かい
    if (mode === 'brace' || mode === 'cross') {
      member(N.bl, N.tr, 8, 'var(--brace)');
      if (mode === 'cross') member(N.br, N.tl, 8, 'var(--brace)', '14 6');
      if (d.brace) {
        var mx = (N.bl[0] + N.tr[0]) / 2, my = (N.bl[1] + N.tr[1]) / 2;
        txt(el, mx + 10, my + 24, d.brace === 'tension' ? '← ひっぱられる →' : '→ おされる ←', { fill: 'var(--brace)', 'font-weight': 'bold' });
      }
    }
    // 上の横材(ドラッグできる)
    var g = svg('g', { class: 'handle', tabindex: 0, role: 'slider', 'aria-label': '上の横材をおす量', 'aria-valuemin': -140, 'aria-valuemax': 140,
      'aria-valuenow': Math.round(push), 'aria-valuetext': 'おす量 ' + Math.round(push) + '、かたむき ' + fmt(Math.abs(d.angleDeg), 0) + '度' }, el);
    svg('line', { class: 'focus-ring', x1: N.tl[0], y1: N.tl[1], x2: N.tr[0], y2: N.tr[1], stroke: 'transparent', 'stroke-width': 22, 'stroke-linecap': 'round' }, g);
    svg('line', { x1: N.tl[0], y1: N.tl[1], x2: N.tr[0], y2: N.tr[1], stroke: 'var(--beam-line)', 'stroke-width': 12, 'stroke-linecap': 'round' }, g);
    svg('line', { x1: N.tl[0] - 10, y1: N.tl[1] - 20, x2: N.tr[0] + 10, y2: N.tr[1] - 20, stroke: 'transparent', 'stroke-width': 50 }, g);
    txt(g, (N.tl[0] + N.tr[0]) / 2 - 48, N.tl[1] - 16, '⇔ ここをおす', { 'font-size': 13 });
    g.addEventListener('keydown', function (e) {
      var k = e.key === 'ArrowRight' ? 10 : e.key === 'ArrowLeft' ? -10 : 0;
      if (e.key === 'Home' || e.key === 'Escape') { e.preventDefault(); setPush(0); return; }
      if (!k) return;
      e.preventDefault(); setPush(push + k);
    });
    // 節点(ピン)
    ['bl', 'br', 'tl', 'tr'].forEach(function (k) { svg('circle', { cx: N[k][0], cy: N[k][1], r: 6, fill: 'var(--panel, #fff)', stroke: 'currentColor', 'stroke-width': 2 }, el); });
    // おす力の矢印
    if (Math.abs(push) > 2) {
      var y = N.tl[1], sx = push > 0 ? N.tl[0] - 20 : N.tr[0] + 20, len = Math.min(70, Math.abs(push) * 0.6 + 15), dir = push > 0 ? 1 : -1;
      svg('line', { x1: sx - dir * len, y1: y, x2: sx - dir * 6, y2: y, stroke: 'var(--load)', 'stroke-width': 4 }, el);
      svg('path', { d: 'M' + sx + ' ' + y + ' l' + (-dir * 12) + ' -7 v14 z', fill: 'var(--load)' }, el);
    }
    var ang = fmt(Math.abs(d.angleDeg), 0);
    var msg = {
      none: Math.abs(d.shift) < 1 ? '四角形の枠。上の横材をおしてみよう。' : '四角形の枠は、角がまわって ' + ang + '度 かたむいた。補強がないと形を保てない。',
      corner: Math.abs(push) < 2 ? '角に三角の板(すみ板)を付けた枠。' : 'すみ板が角を固めるので、かたむきは ' + ang + '度 だけ。手をはなすともどる。',
      brace: Math.abs(push) < 2 ? '筋かいで三角形を2つ作った枠。' : '筋かいが' + (d.brace === 'tension' ? '引っ張られて' : '押されて') + '、三角形が形を保っている。かたむきは0度。',
      cross: Math.abs(push) < 2 ? '筋かいを2本交差させた枠(たすき掛け)。' : 'どちらにおしても、どちらかの筋かいが引っ張られて形を保つ。かたむきは0度。',
      panel: Math.abs(push) < 2 ? '板を全面に張った枠。' : '張った板の面全体が力を受けて、形が変わらない。かたむきは0度。'
    }[mode];
    $('#frame-desc').textContent = msg;
    if (hadFocus) g.focus();
  }

  /* ---------- 3 接合 ---------- */
  var TIGHT = ['', 'ゆるみやすい', 'ややゆるみやすい', 'ふつう', 'ややゆるみにくい', 'ゆるみにくい'];
  function jointIcon(id) {
    var s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('viewBox', '0 0 64 48'); s.setAttribute('aria-hidden', 'true');
    function r(x, y, w, hh) { svg('rect', { x: x, y: y, width: w, height: hh, fill: 'var(--beam)', stroke: 'var(--beam-line)' }, s); }
    if (id === 'tenon') { r(4, 26, 56, 16); svg('rect', { x: 26, y: 26, width: 12, height: 8, fill: 'var(--bg)', stroke: 'var(--beam-line)' }, s); r(24, 4, 16, 16); r(28, 20, 8, 12); }
    else if (id === 'metal') { r(4, 30, 56, 12); r(4, 4, 12, 26); svg('path', { d: 'M18 12 v16 h16', fill: 'none', stroke: 'currentColor', 'stroke-width': 4 }, s); }
    else if (id === 'glue') { r(4, 8, 56, 14); r(4, 26, 56, 14); svg('line', { x1: 4, y1: 24, x2: 60, y2: 24, stroke: 'currentColor', 'stroke-width': 3, 'stroke-dasharray': '3 2' }, s); }
    else {
      r(4, 8, 56, 14); r(4, 22, 56, 20);
      svg('line', { x1: 32, y1: 2, x2: 32, y2: 38, stroke: 'currentColor', 'stroke-width': 3 }, s);
      svg('line', { x1: 26, y1: 2, x2: 38, y2: 2, stroke: 'currentColor', 'stroke-width': 3 }, s);
      if (id === 'screw') for (var y = 10; y < 38; y += 5) svg('line', { x1: 29, y1: y, x2: 35, y2: y + 3, stroke: 'currentColor', 'stroke-width': 1.5 }, s);
    }
    return s;
  }
  function initJoint() {
    var box = $('#joint-cards');
    JOINTS.forEach(function (j) {
      var meter = h('span', { class: 'meter', 'aria-hidden': 'true' });
      for (var i = 1; i <= 5; i++) meter.appendChild(h('i', { class: i <= j.tight ? 'on' : '' }));
      box.appendChild(h('article', { class: 'card joint-card' },
        h('h3', null, jointIcon(j.id), j.name),
        h('p', null, 'ゆるみにくさ ', meter, ' ', h('strong', null, j.tight + '/5 ' + TIGHT[j.tight])),
        h('dl', null,
          h('dt', null, 'しくみ'), h('dd', null, j.how),
          h('dt', null, 'よいところ'), h('dd', null, j.good),
          h('dt', null, '弱いところ'), h('dd', null, j.weak),
          h('dt', null, '向いている場面'), h('dd', null, j.use),
          h('dt', null, 'こつ'), h('dd', null, j.tip))));
    });
    box.appendChild(h('div', null, G.noteEstimate('ゆるみにくさ(■が多いほどゆるみにくい)は、使い方・材料・加工の正確さで変わる目安です。')));
  }
  function renderQuiz() {
    var box = $('#joint-quiz');
    box.innerHTML = '';
    var ans = S.quiz.answers, right = 0, done = 0;
    box.appendChild(h('h2', null, 'クイズ:どの接合を選ぶ?'));
    JOINT_QUIZ.forEach(function (q, i) {
      var a = ans[i], ok = a && q.ok.indexOf(a) >= 0;
      if (a) { done++; if (ok) right++; }
      var opts = h('div', { class: 'quiz-opts', role: 'group', 'aria-label': '問' + (i + 1) + 'の答え' });
      JOINTS.forEach(function (j) {
        opts.appendChild(h('button', { class: 'btn', type: 'button', 'aria-pressed': String(a === j.id), onclick: function () {
          S.quiz.answers[i] = j.id; renderQuiz(); save();
          var b = $$('#joint-quiz .quiz-opts')[i].querySelector('[aria-pressed="true"]'); if (b) b.focus();
        } }, j.name));
      });
      box.appendChild(h('div', { class: 'quiz-item' },
        h('p', { class: 'quiz-q' }, '問' + (i + 1) + ' ' + q.q), opts,
        a ? h('p', { class: 'quiz-fb ' + (ok ? 'ok' : 'ng'), role: 'status' }, (ok ? '○ 正解! ' : '✕ もう一度考えよう。') + (ok ? q.why : '')) : null));
    });
    box.appendChild(h('p', null, h('strong', null, JOINT_QUIZ.length + '問中 ' + right + '問 正解'), done < JOINT_QUIZ.length ? '(のこり ' + (JOINT_QUIZ.length - done) + '問)' : ''));
    box.appendChild(h('button', { class: 'btn small', type: 'button', onclick: function () { S.quiz.answers = {}; renderQuiz(); save(); } }, 'クイズをやり直す'));
  }

  /* ---------- 4 設計課題 ---------- */
  function initChallenge() {
    G.psCycle($('#ps-cycle'), ['plan', 'eval', 'improve']);
    var lt = $('#level-tabs');
    Challenge.LEVELS.forEach(function (lv, i) {
      lt.appendChild(h('button', { class: 'btn', type: 'button', 'data-level': lv.id, onclick: function () { S.challenge.level = lv.id; renderChallenge(); save(); } }, '課題' + (i + 1)));
    });
    Challenge.MATERIALS.forEach(function (id) { $('#c-material').appendChild(h('option', { value: id }, matName(id))); });
    Challenge.THICKNESS.forEach(function (t) { $('#c-t').appendChild(h('option', { value: t }, t + ' mm')); });
    for (var n = 0; n <= 3; n++) $('#c-ribs').appendChild(h('option', { value: n }, n ? n + '本' : 'なし'));
    $('#rib-size').textContent = Challenge.RIB.w + '×' + Challenge.RIB.h + 'mm の角材';
    ['#c-material', '#c-t', '#c-ribs'].forEach(function (sel) {
      $(sel).addEventListener('change', function () {
        S.challenge.designs[S.challenge.level] = { material: $('#c-material').value, t: +$('#c-t').value, ribs: +$('#c-ribs').value };
        renderChallenge(); save();
      });
    });
    $('#c-try').addEventListener('click', function () {
      var lv = Challenge.level(S.challenge.level), ds = design(lv.id), ev = Challenge.evaluate(lv, ds);
      if (!ev.ok) return;
      var st = Challenge.stars(lv, ev);
      S.challenge.log.push({ level: lv.id, material: ds.material, t: ds.t, ribs: ds.ribs, massG: Math.round(ev.massG),
        deflection: +ev.result.deflection.toFixed(2), safety: +ev.result.safety.toFixed(2), pass: ev.pass, stars: st, at: new Date().toISOString() });
      renderChallenge(); save();
      G.toast(ev.pass ? '条件クリア! ' + '★'.repeat(st) + '☆'.repeat(3 - st) : '条件をクリアできなかった。どこを変えればよいかな?');
    });
    $('#c-reflect').addEventListener('input', function () { S.challenge.reflect = $('#c-reflect').value; save(); });
    $('#c-reflect2').addEventListener('input', function () { S.challenge.reflect2 = $('#c-reflect2').value; save(); });
  }
  function design(id) {
    var d = S.challenge.designs[id];
    return d && Challenge.MATERIALS.indexOf(d.material) >= 0 ? d : { material: 'sugi', t: 9, ribs: 0 };
  }
  function bestStars(id) {
    return S.challenge.log.reduce(function (m, e) { return e.level === id ? Math.max(m, e.stars || 0) : m; }, 0);
  }
  function renderChallenge() {
    var lv = Challenge.level(S.challenge.level), ds = design(lv.id);
    $$('#level-tabs [data-level]').forEach(function (b, i) {
      var id = b.getAttribute('data-level'), st = bestStars(id);
      b.setAttribute('aria-pressed', String(id === lv.id));
      b.textContent = '課題' + (i + 1) + ' ' + (st ? '★'.repeat(st) + '☆'.repeat(3 - st) : '');
    });
    $('#lv-title').textContent = lv.title;
    $('#lv-story').textContent = lv.story + '(板の奥行き ' + lv.width + 'mm、' + (lv.support === 'simple' ? '支点間の距離' : '壁から先までの長さ') + ' ' + lv.span + 'mm)';
    var c = $('#lv-conds'); c.innerHTML = '';
    c.appendChild(h('li', null, 'たわみ ' + lv.maxDeflection + 'mm 以下'));
    c.appendChild(h('li', null, '強さの余裕:安全率 ' + lv.minSafety + ' 以上(こわれにくさに' + lv.minSafety + '倍の余裕。「○ 余裕あり」になればよい)'));
    if (lv.maxT) c.appendChild(h('li', null, '板の厚みは ' + lv.maxT + 'mm まで'));
    if (Challenge.maxRibs(lv) === 0) c.appendChild(h('li', null, 'リブは付けない'));
    c.appendChild(h('li', null, 'そのうえで、できるだけ軽く(材料を少なく)する。軽いほど星がふえる。'));
    // その課題で使えない厚み・リブの本数はえらべないようにする
    var okT = Challenge.allowedThickness(lv), mr = Challenge.maxRibs(lv);
    $$('#c-t option').forEach(function (o) { o.disabled = okT.indexOf(+o.value) < 0; });
    $$('#c-ribs option').forEach(function (o) { o.disabled = +o.value > mr; });
    if (okT.indexOf(ds.t) < 0) ds = { material: ds.material, t: okT[okT.length - 1], ribs: ds.ribs };
    if (ds.ribs > mr) ds = { material: ds.material, t: ds.t, ribs: mr };
    if (S.challenge.designs[lv.id]) S.challenge.designs[lv.id] = ds;
    $('#c-material').value = ds.material; $('#c-t').value = String(ds.t); $('#c-ribs').value = String(ds.ribs);

    var ev = Challenge.evaluate(lv, ds);
    var out = $('#c-result'); out.innerHTML = '';
    var sec = Beam.section(Challenge.sectionOf(lv, ds));
    drawBeam($('#c-svg'), { support: lv.support, loadType: lv.loadType, loadKg: lv.loadKg, sectionHeight: sec.ok ? sec.height : 15, curves: [{ r: ev.ok ? ev.result : null, style: 'now' }] });
    if (!ev.ok) { out.appendChild(h('p', { class: 'error' }, ev.error)); return; }
    var r = ev.result;
    out.appendChild(h('div', { class: 'check-row' },
      h('span', { class: 'check ' + (ev.okDeflection ? 'ok' : 'ng') }, (ev.okDeflection ? '✓ ' : '✕ ') + 'たわみ ' + fmtSig(r.deflection) + 'mm'),
      h('span', { class: 'check ' + (ev.okSafety ? 'ok' : 'ng') }, (ev.okSafety ? '✓ ' : '✕ ') + '強さの余裕 ' + r.level.mark + ' ' + r.level.label),
      h('span', { class: 'check' }, '重さ ' + fmt(ev.massG, 0) + 'g')));
    out.appendChild(h('details', { class: 'more' }, h('summary', null, 'くわしく見る(発展)'),
      h('p', null, '安全率 ' + (isFinite(r.safety) ? fmt(r.safety, 1) : '—') + '(条件は ' + lv.minSafety + ' 以上)、曲げの応力 ' + fmtSig(r.stress) + ' N/mm²')));

    var tb = $('#c-log tbody'); tb.innerHTML = '';
    var rows = S.challenge.log.filter(function (e) { return e.level === lv.id; });
    if (!rows.length) tb.appendChild(h('tr', null, h('td', { colspan: 6, class: 'g-muted' }, 'まだ記録がありません。「この設計で試す」をおそう。')));
    rows.forEach(function (e, i) {
      tb.appendChild(h('tr', null, h('td', null, String(i + 1)), h('td', null, matName(e.material)), h('td', { class: 'num' }, e.t + 'mm'),
        h('td', { class: 'num' }, e.ribs ? e.ribs + '本' : 'なし'), h('td', { class: 'num' }, fmt(e.massG, 0)),
        h('td', null, e.pass ? h('span', { class: 'stars', 'aria-label': '星' + e.stars + 'つ' }, '★'.repeat(e.stars) + '☆'.repeat(3 - e.stars)) : h('span', { class: 'check ng' }, '✕ 未クリア'))));
    });
    var tries = rows.length, best = bestStars(lv.id);
    if (tries >= 3 && best < 3) {
      out.appendChild(h('p', { class: 'g-note' }, best === 0
        ? 'ヒント:たわみが大きいときは、厚みを増やすと効果が大きい(厚み2倍でたわみは1/8)。'
        : 'ヒント:板を厚くするより、薄い板に細いリブを付けて「高さ」を出すほうが、軽くて曲がりにくくなることがある。'));
    }
    $('#c-reflect').value = S.challenge.reflect || '';
    $('#c-reflect2').value = S.challenge.reflect2 || '';
  }

  /* ---------- 保存バー ---------- */
  function initSaveBar() {
    $('#work-title').addEventListener('input', save);
    $('#btn-new').addEventListener('click', function () {
      G.confirm('新しい記録を始めます。いまの記録は保存されたまま残ります。', '始める').then(function (ok) {
        if (!ok) return;
        load(G.newArtifact(APP, '構造強化ラボの記録', defaultState()));
        save();
      });
    });
    $('#btn-open').addEventListener('click', function () {
      G.openDialog(APP).then(function (a) { if (a) { load(a); G.toast('「' + a.title + '」を開きました'); } });
    });
    $('#btn-export').addEventListener('click', function () {
      work.title = $('#work-title').value.trim() || work.title;
      work.updatedAt = new Date().toISOString();
      G.exportJSON(work, (work.title || 'structure-lab') + '.json');
    });
    $('#btn-import').addEventListener('click', function () {
      G.pickJSON().then(function (obj) {
        var list = G.normalizeImport(obj, APP);
        if (!list.length) { G.toast('構造強化ラボの記録が見つかりませんでした'); return; }
        return Promise.all(list.map(function (a) { return G.store.put(a); })).then(function () {
          load(list[0]);
          G.toast(list.length + '件を読み込みました');
        });
      }).catch(function (e) { G.toast('読み込みに失敗しました:' + e.message); });
    });
  }

  function renderAll() {
    writeBeamForm(); renderBeam();
    push = 0; renderFrame(); $('#frame-note').value = S.frame.note || '';
    renderQuiz(); renderChallenge();
  }

  initSaveBar(); initBeam(); initFrame(); initJoint(); initChallenge();
  G.tabs($('[data-g-tabs]'));
  renderAll();
  // 前回の記録があれば続きから
  G.store.list(APP).then(function (list) {
    if (list && list.length) { load(list[0]); $('#save-status').textContent = '前回の記録「' + (list[0].title || '') + '」の続きです。'; }
  }).catch(function () {});
})();
