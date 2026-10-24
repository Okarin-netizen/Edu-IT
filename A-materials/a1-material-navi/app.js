/* 材料選択ナビ (A1)
 * 使用目的・使用条件から材料を比較・選択し、理由を説明する。
 * ビルド不要の Vanilla JS。外部通信なし。
 * テキスト中の {漢字|かんじ} はルビ付きで表示する。
 */
(function () {
  'use strict';

  const APP_ID = 'material-navi';  // 共通基盤の app 名
  const DATA = window.A1_DATA;
  const PROPS = DATA.properties;
  const KEYS = PROPS.map(p => p.key);
  const MAX = 5;

  // ---------- ルビ・HTML ----------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  // {漢字|かんじ} → <ruby>
  function rb(s) {
    return esc(s).replace(/\{([^|{}]+)\|([^{}]+)\}/g, '<ruby>$1<rt>$2</rt></ruby>');
  }
  // ルビ記法を外したプレーンテキスト(aria-label・保存用)
  function plain(s) {
    return String(s).replace(/\{([^|{}]+)\|([^{}]+)\}/g, '$1');
  }
  const $ = (sel, root) => (root || document).querySelector(sel);

  function toast(msg) {
    if (window.G && G.toast) { G.toast(msg); return; }
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2200);
  }

  // ---------- 保存 (IndexedDB) ----------
  // 共通基盤 G.store があればそちらを使う(全アプリ共通のDB)。なければ単体で IndexedDB を使う。
  const SCHEMA = 'gijutsu-artifact/1';
  const LS = {
    get(k) { try { return JSON.parse(localStorage.getItem(APP_ID + '.' + k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(APP_ID + '.' + k, JSON.stringify(v)); } catch (e) { /* 保存できない環境 */ } },
  };
  const Store = (window.G && G.store) ? {
    putArtifact: a => G.store.put(a),
    allArtifacts: () => G.store.list(APP_ID),
    deleteArtifact: id => G.store.del(id),
  } : (function () {
    const DB = APP_ID;
    let dbp = null;
    function open() {
      if (dbp) return dbp;
      dbp = new Promise((res, rej) => {
        if (!('indexedDB' in window)) { rej(new Error('no indexedDB')); return; }
        const r = indexedDB.open(DB, 1);
        r.onupgradeneeded = () => {
          const db = r.result;
          if (!db.objectStoreNames.contains('artifacts')) db.createObjectStore('artifacts', { keyPath: 'id' });
        };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      return dbp;
    }
    function tx(store, mode, fn) {
      return open().then(db => new Promise((res, rej) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        t.oncomplete = () => res(req && req.result);
        t.onerror = () => rej(t.error);
      }));
    }
    return {
      putArtifact: a => tx('artifacts', 'readwrite', s => s.put(a)),
      allArtifacts: () => tx('artifacts', 'readonly', s => s.getAll()).then(a => (a || []).sort((x, y) => (y.updatedAt || '').localeCompare(x.updatedAt || ''))),
      deleteArtifact: id => tx('artifacts', 'readwrite', s => s.delete(id)),
    };
  })();

  // ---------- 状態 ----------
  const DEFAULT_USE = DATA.uses.find(u => u.id === 'bookend') || DATA.uses[0];
  const state = {
    view: 'list',
    // 初めて開いたときは用途「本立て」(保存した条件があれば restore() で上書き)
    useId: DEFAULT_USE.id,
    weights: Object.assign({}, DEFAULT_USE.weights),
    conductMode: DEFAULT_USE.conductMode || 'low',          // 'low' = 電気・熱を通しにくい方がよい / 'high' = 通しやすい方がよい
    cats: { wood: true, metal: true, plastic: true },
    listCat: 'all',
    prevRanking: null,           // 直前の順位(順位変化の表示用)
    sheet: blankSheet(),
  };
  function blankSheet() {
    return { id: null, product: '', chosen: '', chosenReason: '', rejected: '', rejectedReason: '', notice: '' };
  }

  // ---------- 採点 ----------
  // 評価値(1〜5)。電気の通しやすさは「通さない方がよい」ときは 6-v に反転する。
  function effVal(m, key) {
    const v = m.ratings[key];
    if (key === 'conduct' && state.conductMode === 'low') return MAX + 1 - v;
    return v;
  }
  function propLabel(key) {
    const p = PROPS.find(x => x.key === key);
    if (key === 'conduct') {
      return state.conductMode === 'low' ? '{電気|でんき}・{熱|ねつ}を{通|とお}しにくい' : '{電気|でんき}・{熱|ねつ}を{通|とお}しやすい';
    }
    return p.label;
  }
  function score(m) {
    let num = 0, den = 0;
    const parts = [];
    for (const k of KEYS) {
      const w = state.weights[k];
      const v = effVal(m, k);
      num += w * v; den += w * MAX;
      parts.push({ key: k, w, v, p: w * v });
    }
    return { total: den ? Math.round(num / den * 1000) / 10 : 0, num, den, parts };
  }
  function ranking() {
    return DATA.materials
      .filter(m => state.cats[m.category])
      .map(m => ({ m, s: score(m) }))
      .sort((a, b) => b.s.total - a.s.total || a.m.name.localeCompare(b.m.name, 'ja'));
  }
  const weightSum = () => KEYS.reduce((a, k) => a + state.weights[k], 0);

  // ---------- 材料のSVG(自作の模式図) ----------
  const TINT = {
    sugi: ['#f1d9a8', '#c99a55'], hinoki: ['#f6e6bf', '#d1ad6a'], lauan: ['#d9a07a', '#a3613b'],
    plywood: ['#ecd3a0', '#b98d4f'], mdf: ['#b78f63', '#8c6a45'],
    steel: ['#9aa1a8', '#5d646b'], aluminum: ['#dde3e8', '#9aa5ae'], copper: ['#e3a06f', '#b5652f'], stainless: ['#c9cfd4', '#8b949b'],
    acrylic: ['#d8f0fb', '#7cbfdd'], pp: ['#f4f4ee', '#b7b7a8'], pvc: ['#c9d8e6', '#6f8aa6'], abs: ['#f2e6c9', '#b9a77a'], pet: ['#e1f5ea', '#88c4a2'],
  };
  function matSvg(m) {
    const [a, b] = TINT[m.id] || ['#eee', '#999'];
    const lbl = esc(plain(m.name)) + 'の図';
    let body = '';
    if (m.category === 'wood') {
      if (m.id === 'plywood') {
        // 合板: 層を交互に
        body = '<rect width="96" height="64" fill="' + a + '"/>';
        for (let i = 0; i < 5; i++) {
          const y = 8 + i * 10;
          body += '<rect x="0" y="' + y + '" width="96" height="9" fill="' + (i % 2 ? b : a) + '" stroke="' + b + '" stroke-width=".6"/>';
          if (i % 2 === 0) body += '<path d="M2 ' + (y + 4.5) + ' H94" stroke="' + b + '" stroke-width=".8" stroke-dasharray="6 3"/>';
          else for (let x = 4; x < 96; x += 8) body += '<circle cx="' + x + '" cy="' + (y + 4.5) + '" r="1.4" fill="' + a + '"/>';
        }
      } else if (m.id === 'mdf') {
        body = '<rect width="96" height="64" fill="' + a + '"/>';
        let seed = 7;
        for (let i = 0; i < 70; i++) {
          seed = (seed * 9301 + 49297) % 233280;
          const x = seed / 233280 * 96; seed = (seed * 9301 + 49297) % 233280;
          const y = seed / 233280 * 64;
          body += '<path d="M' + x.toFixed(1) + ' ' + y.toFixed(1) + ' l3 1" stroke="' + b + '" stroke-width="1"/>';
        }
      } else {
        // 無垢材: 年輪の木目
        const dense = { sugi: 7, hinoki: 9, lauan: 5 }[m.id] || 7;
        body = '<rect width="96" height="64" fill="' + a + '"/>';
        for (let i = 0; i < dense; i++) {
          const y = 4 + i * (56 / dense);
          body += '<path d="M0 ' + y.toFixed(1) + ' C 24 ' + (y + 5).toFixed(1) + ', 48 ' + (y - 5).toFixed(1) + ', 96 ' + (y + 2).toFixed(1) + '" fill="none" stroke="' + b + '" stroke-width="1.6"/>';
        }
        body += '<ellipse cx="66" cy="34" rx="5" ry="3" fill="none" stroke="' + b + '" stroke-width="1.4"/>';
      }
    } else if (m.category === 'metal') {
      const gid = 'g-' + m.id;
      body = '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + a + '"/><stop offset=".45" stop-color="#fff"/><stop offset=".55" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient></defs>' +
        '<rect width="96" height="64" fill="' + b + '"/>' +
        '<rect x="6" y="10" width="84" height="44" rx="2" fill="url(#' + gid + ')" stroke="' + b + '"/>' +
        '<circle cx="14" cy="18" r="3" fill="' + b + '"/><circle cx="82" cy="18" r="3" fill="' + b + '"/>' +
        '<circle cx="14" cy="46" r="3" fill="' + b + '"/><circle cx="82" cy="46" r="3" fill="' + b + '"/>';
      if (m.id === 'steel') body += '<circle cx="62" cy="38" r="4" fill="#a0522d" opacity=".6"/><circle cx="68" cy="42" r="2.5" fill="#a0522d" opacity=".5"/>';
      if (m.id === 'copper') body += '<path d="M24 32 h48" stroke="' + b + '" stroke-width="3"/>';
    } else {
      body = '<rect width="96" height="64" fill="#fbfbf8"/>';
      const shape = {
        acrylic: '<rect x="14" y="10" width="68" height="44" rx="3"/>',
        pp: '<path d="M18 52 V22 Q18 12 28 12 H68 Q78 12 78 22 V52 Z"/>',
        pvc: '<rect x="8" y="22" width="80" height="20" rx="10"/>',
        abs: '<rect x="18" y="14" width="60" height="36" rx="10"/>',
        pet: '<path d="M40 6 h16 v8 q10 6 10 16 v26 q0 4 -4 4 h-28 q-4 0 -4 -4 v-26 q0 -10 10 -16 z"/>',
      }[m.id] || '<rect x="14" y="10" width="68" height="44" rx="8"/>';
      body += '<g fill="' + a + '" stroke="' + b + '" stroke-width="2" opacity=".95">' + shape + '</g>' +
        '<path d="M24 18 l10 0 M24 22 l6 0" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>';
    }
    return '<svg class="mat" viewBox="0 0 96 64" role="img" aria-label="' + lbl + '">' + body + '</svg>';
  }

  function dots(v) {
    return '<span class="dots" aria-label="5段階中' + v + '">' + '<b>●</b>'.repeat(v) + '<i>○</i>'.repeat(MAX - v) + '</span>';
  }

  // ---------- 画面: 材料一覧 ----------
  function renderList() {
    const el = $('#view-list');
    const mats = DATA.materials.filter(m => state.listCat === 'all' || m.category === state.listCat);
    const catOpts = [['all', 'すべて']].concat(Object.entries(DATA.categories));
    el.innerHTML =
      '<div data-ef-lets="a12"></div>' +
      '<h2>' + rb('{材料|ざいりょう}カード') + '</h2>' +
      '<p class="lead">' + rb('材料の特徴をカードで確かめよう。評価は5段階で、●が多いほど、その性質が大きい。') + '<br>' + rb('「電気・熱の通しやすさ」は、●が多いほど通しやすい(よいか悪いかは用途しだい)。') + '</p>' +
      '<div class="notice"><strong>' + rb('{目安|めやす}') + '</strong> ' + rb(DATA.note) + '</div>' +
      '<div class="filters" role="group" aria-label="種類で絞り込み">' +
      catOpts.map(([k, v]) => '<label><input type="radio" name="listcat" value="' + k + '"' + (state.listCat === k ? ' checked' : '') + '> ' + rb(v) + '</label>').join('') +
      '</div>' +
      '<div class="cards">' + mats.map(cardHtml).join('') + '</div>' +
      '<div class="notice card-note"><strong>' + rb('注意') + '</strong> ' + rb('カードの●と密度・熱の数値は、すべて目安です。実物で確かめよう。') +
      '<br>' + rb('{出典|しゅってん}: ' + DATA.source) +
      DATA.materials.filter(m => m.source).map(m => '<br>' + rb(m.name + ': ' + m.source)).join('') + '</div>';
    el.querySelectorAll('input[name=listcat]').forEach(r => r.addEventListener('change', () => { state.listCat = r.value; renderList(); }));
  }
  function cardHtml(m) {
    const bars = PROPS.map(p => {
      const lbl = p.key === 'conduct' ? '電気・熱の通しやすさ' : p.label;
      return '<span>' + rb(lbl) + '</span>' + dots(m.ratings[p.key]);
    }).join('');
    return '<article class="mcard" aria-label="' + esc(plain(m.name)) + '">' +
      '<header>' + matSvg(m) + '<div><h3>' + rb(m.name) + '</h3><div class="cat">' + rb(DATA.categories[m.category]) + '</div></div></header>' +
      '<ul>' + m.points.map(p => '<li>' + rb(p) + '</li>').join('') + '</ul>' +
      '<div class="bars">' + bars + '</div>' +
      '<div class="meta">' + rb('{密度|みつど}: {約|やく}') + m.density + ' g/cm³ ・ ' + rb('{熱|ねつ}: ' + m.heatNote) + '</div>' +
      '</article>';
  }

  // ---------- 画面: 条件設定 ----------
  function renderCond() {
    const el = $('#view-cond');
    el.innerHTML =
      '<h2>' + rb('{使用目的|しようもくてき}・{使用条件|しようじょうけん}を{決|き}める') + '</h2>' +
      '<p class="lead">' + rb('{作|つく}るものを{選|えら}び、{重|おも}く{見|み}たい{観点|かんてん}ほど{数|かず}を{大|おお}きくしよう(0は{考|かんが}えない)。{順位|じゅんい}はすぐに{変|か}わる。') + '</p>' +
      '<div class="cond-grid">' +
      '<div class="panel">' +
      '<h3>' + rb('{作|つく}るもの({用途|ようと})') + '</h3>' +
      '<div class="uses" role="group" aria-label="用途">' +
      DATA.uses.map(u => '<button type="button" data-use="' + u.id + '" aria-pressed="' + (state.useId === u.id) + '">' + rb(u.name) + '</button>').join('') +
      '</div>' +
      '<p class="hint">' + rb('{用途|ようと}を{選|えら}ぶと{重|おも}みの{例|れい}が{入|はい}る。{自分|じぶん}の{考|かんが}えに{合|あ}わせて{変|か}えてよい。') + '</p>' +
      '<h3>' + rb('{重視|じゅうし}する{観点|かんてん}(0〜5)') + '</h3>' +
      PROPS.map(sliderHtml).join('') +
      '<h3>' + rb('{比|くら}べる{材料|ざいりょう}の{種類|しゅるい}') + '</h3>' +
      '<div class="filters">' +
      Object.entries(DATA.categories).map(([k, v]) => '<label><input type="checkbox" data-cat="' + k + '"' + (state.cats[k] ? ' checked' : '') + '> ' + rb(v) + '</label>').join('') +
      '</div>' +
      '</div>' +
      '<div class="panel live" aria-live="polite"><h3>' + rb('いまの{順位|じゅんい}') + '</h3><div id="live-rank"></div>' +
      '<p><button type="button" class="primary" id="go-result">' + rb('{比較|ひかく}{結果|けっか}を{見|み}る') + ' →</button></p></div>' +
      '</div>';

    el.querySelectorAll('[data-use]').forEach(b => b.addEventListener('click', () => applyUse(b.dataset.use)));
    el.querySelectorAll('input[type=range]').forEach(r => r.addEventListener('input', () => {
      state.weights[r.dataset.key] = +r.value;
      r.nextElementSibling.value = r.value;
      r.setAttribute('aria-valuetext', r.value);
      renderLive();
      persistCond();
    }));
    el.querySelectorAll('input[name=cmode]').forEach(r => r.addEventListener('change', () => {
      state.conductMode = r.value;
      renderLive();
      persistCond();
    }));
    el.querySelectorAll('[data-cat]').forEach(c => c.addEventListener('change', () => {
      state.cats[c.dataset.cat] = c.checked;
      if (!Object.values(state.cats).some(Boolean)) { state.cats[c.dataset.cat] = true; c.checked = true; toast('1つ以上の種類を選んでください'); }
      renderLive();
      persistCond();
    }));
    $('#go-result').addEventListener('click', () => show('result', true));
    state.prevRanking = null;
    renderLive();
  }
  function sliderHtml(p) {
    const id = 'w-' + p.key;
    const lbl = p.key === 'conduct' ? '{電気|でんき}・{熱|ねつ}の{通|とお}し{方|かた}' : p.label;
    let mode = '';
    if (p.key === 'conduct') {
      mode = '<div class="mode" role="radiogroup" aria-label="電気・熱の通し方">' +
        '<label><input type="radio" name="cmode" value="low"' + (state.conductMode === 'low' ? ' checked' : '') + '> ' + rb('{通|とお}しにくい{方|ほう}がよい({絶縁|ぜつえん}・{断熱|だんねつ})') + '</label>' +
        '<label><input type="radio" name="cmode" value="high"' + (state.conductMode === 'high' ? ' checked' : '') + '> ' + rb('{通|とお}しやすい{方|ほう}がよい') + '</label></div>';
    }
    return '<div class="slider"><label for="' + id + '">' + rb(lbl) + '</label>' +
      '<input type="range" id="' + id + '" data-key="' + p.key + '" min="0" max="5" step="1" value="' + state.weights[p.key] + '">' +
      '<output for="' + id + '">' + state.weights[p.key] + '</output>' +
      '<span class="help">' + rb(p.desc) + '</span>' + mode + '</div>';
  }
  function applyUse(id) {
    const u = DATA.uses.find(x => x.id === id);
    if (!u) return;
    state.useId = id;
    state.weights = Object.assign({}, u.weights);
    state.conductMode = u.conductMode || 'low';
    if (!state.sheet.product && id !== 'free') state.sheet.product = plain(u.name);
    persistCond();
    renderCond();
  }
  function renderLive() {
    const box = $('#live-rank');
    if (!box) return;
    const r = ranking();
    const prev = state.prevRanking;
    const ws = weightSum();
    if (!ws) {
      box.innerHTML = '<p>' + rb('{重|おも}みがすべて0です。どれか1つ{以上|いじょう}を1{以上|いじょう}にしよう。') + '</p>';
      return;
    }
    box.innerHTML = '<ol>' + r.slice(0, 6).map((x, i) => {
      let mv = '';
      if (prev) {
        const pi = prev.indexOf(x.m.id);
        if (pi === -1) mv = '';
        else if (pi > i) mv = '<span class="moved">▲' + (pi - i) + '</span>';
        else if (pi < i) mv = '<span class="moved">▼' + (i - pi) + '</span>';
      }
      return '<li>' + rb(x.m.name) + ' … <b>' + x.s.total.toFixed(1) + '</b>' + rb('{点|てん}') + mv + '</li>';
    }).join('') + '</ol>' +
      '<p class="hint">' + rb('{重|おも}みを{変|か}えると{順位|じゅんい}が{入|い}れかわる。▲▼は{直前|ちょくぜん}からの{変化|へんか}。') + '</p>';
    state.prevRanking = r.map(x => x.m.id);
  }

  // ---------- 画面: 比較結果 ----------
  const STYLES = [
    { color: '#b4441f', dash: [], marker: 'circle', name: '実線・●' },
    { color: '#1f5fa8', dash: [10, 6], marker: 'square', name: '破線・■' },
    { color: '#2f7d32', dash: [3, 4], marker: 'triangle', name: '点線・▲' },
  ];
  function renderResult() {
    const el = $('#view-result');
    const r = ranking();
    const top = r.slice(0, 3);
    const ws = weightSum();
    const useName = (DATA.uses.find(u => u.id === state.useId) || {}).name || '';
    if (!ws) {
      el.innerHTML = '<h2>' + rb('{比較|ひかく}{結果|けっか}') + '</h2><p>' + rb('{条件設定|じょうけんせってい}で{重|おも}みを1つ{以上|いじょう}{入|い}れてください。') + '</p>';
      return;
    }
    el.innerHTML =
      '<h2>' + rb('{比較|ひかく}{結果|けっか}') + (useName ? '(' + rb(useName) + ')' : '') + '</h2>' +
      '<div class="formula" aria-label="点数の計算式">' + rb('点数 =(重み×評価 を全部たしたもの)÷(重み×5 を全部たしたもの)× 100') +
      '<br><span class="hint">' + rb('{評価|ひょうか}は1〜5の{目安値|めやすち}。「{通|とお}しにくい{方|ほう}がよい」ときは {評価|ひょうか} = 6 − {通|とお}しやすさ にして{計算|けいさん}する。{満点|まんてん}は100{点|てん}。') + '</span></div>' +
      '<div class="msg-key"><b>' + rb('{最適|さいてき}な{材料|ざいりょう}は{条件|じょうけん}しだい。') + '</b>' + rb('{重|おも}みを{変|か}えると{順位|じゅんい}が{変|か}わる。{点数|てんすう}が{高|たか}い{材料|ざいりょう}にも{弱|よわ}いところがある(トレードオフ)。') + '</div>' +
      '<div class="result-grid">' +
      '<div><canvas id="radar" width="560" height="560" role="img" aria-label="上位3つの材料のレーダーチャート"></canvas>' +
      '<div class="legend">' + top.map((x, i) => '<span>' + legendSvg(i) + rb(x.m.name) + '(' + rb(STYLES[i].name) + ')</span>').join('') + '</div>' +
      '<p class="hint">' + rb('{外側|そとがわ}ほどその{観点|かんてん}にすぐれる。{重|おも}みが0の{観点|かんてん}は{名前|なまえ}をうすく{表示|ひょうじ}。') + '</p></div>' +
      '<div class="top3">' + top.map((x, i) => topCard(x, i, top)).join('') + '</div>' +
      '</div>' +
      '<h3>' + rb('{全部|ぜんぶ}の{材料|ざいりょう}の{比較表|ひかくひょう}({重|おも}み × {評価|ひょうか})') + '</h3>' +
      tableHtml(r) +
      '<div class="notice"><strong>' + rb('{目安|めやす}') + '</strong> ' + rb(DATA.note) + '</div>' +
      '<p class="row-btns"><button type="button" id="back-cond">← ' + rb('{条件|じょうけん}を{変|か}える') + '</button>' +
      '<button type="button" class="primary" id="go-reflect">' + rb('{理由|りゆう}を{書|か}く') + ' →</button></p>';
    drawRadar($('#radar'), top);
    $('#back-cond').addEventListener('click', () => show('cond', true));
    $('#go-reflect').addEventListener('click', () => show('reflect', true));
  }
  function legendSvg(i) {
    const s = STYLES[i];
    const mk = s.marker === 'circle' ? '<circle cx="20" cy="8" r="4" fill="' + s.color + '"/>' :
      s.marker === 'square' ? '<rect x="16" y="4" width="8" height="8" fill="' + s.color + '"/>' :
        '<path d="M20 3 L25 12 L15 12 Z" fill="' + s.color + '"/>';
    return '<svg width="40" height="16" aria-hidden="true"><line x1="0" y1="8" x2="40" y2="8" stroke="' + s.color + '" stroke-width="3" stroke-dasharray="' + s.dash.join(' ') + '"/>' + mk + '</svg>';
  }
  function topCard(x, i, top) {
    const pros = [], cons = [];
    for (const k of KEYS) {
      if (!state.weights[k]) continue;
      const v = effVal(x.m, k);
      if (v >= 4) pros.push(propLabel(k));
      if (v <= 2) cons.push(propLabel(k));
    }
    // 1位との比較(トレードオフ)
    let vs = '';
    if (i > 0) {
      const a = top[0].m;
      const better = KEYS.filter(k => state.weights[k] && effVal(x.m, k) > effVal(a, k)).map(propLabel);
      vs = better.length
        ? '<p class="hint">' + rb('1{位|い}の' + a.name + 'より') + ' ' + better.map(rb).join('・') + ' ' + rb('がすぐれる。') + '</p>'
        : '<p class="hint">' + rb('{重視|じゅうし}した{観点|かんてん}では1{位|い}の' + a.name + 'を{上回|うわまわ}るものはない。') + '</p>';
    }
    const calc = x.s.parts.filter(p => p.w).map(p => p.w + '×' + p.v).join(' + ');
    return '<div class="panel">' +
      '<h3><span class="rank r' + (i + 1) + '">' + (i + 1) + rb('{位|い}') + '</span>' + rb(x.m.name) + ' <span>' + x.s.total.toFixed(1) + rb('{点|てん}') + '</span></h3>' +
      '<div class="tradeoff"><ul>' +
      (pros.length ? '<li class="pro">' + rb('よいところ: ') + pros.map(rb).join('、') + '</li>' : '') +
      (cons.length ? '<li class="con">' + rb('{弱|よわ}いところ: ') + cons.map(rb).join('、') + '</li>' : '<li class="con">' + rb('{重視|じゅうし}した{観点|かんてん}で{大|おお}きな{弱点|じゃくてん}はない') + '</li>') +
      '</ul></div>' + vs +
      '<div class="formula"><code>(' + calc + ') ÷ ' + x.s.den + ' × 100 = ' + x.s.total.toFixed(1) + '</code></div>' +
      '</div>';
  }
  function tableHtml(r) {
    const head = '<tr><th>' + rb('順位') + '</th><th>' + rb('材料') + '</th><th>' + rb('点数') + '</th>' +
      KEYS.map(k => '<th>' + rb(propLabel(k)) + '<br><small>' + rb('{重|おも}み') + state.weights[k] + '</small></th>').join('') + '</tr>';
    const rows = r.map((x, i) => '<tr' + (i < 3 ? ' class="toprow"' : '') + '><td>' + (i + 1) + '</td><td class="name">' + rb(x.m.name) +
      ' <small class="cat">' + rb(DATA.categories[x.m.category]) + '</small></td>' +
      '<td class="score"><span class="sbar" style="width:' + (x.s.total * 0.6).toFixed(0) + 'px"></span>' + x.s.total.toFixed(1) + '</td>' +
      x.s.parts.map(p => '<td' + (p.w ? '' : ' class="zero"') + '>' + p.v + (p.w ? ' <small>(' + p.p + ')</small>' : '') + '</td>').join('') + '</tr>').join('');
    return '<div class="table-wrap"><table><caption class="hint">' + rb('{各|かく}{欄|らん}は {評価|ひょうか}({重|おも}み×{評価|ひょうか})') + '</caption><thead>' + head + '</thead><tbody>' + rows + '</tbody></table></div>';
  }

  // レーダーチャート(Canvas 自作)
  function drawRadar(cv, top) {
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height, cx = W / 2, cy = H / 2, R = W * 0.29;
    const n = KEYS.length;
    ctx.clearRect(0, 0, W, H);
    const ang = i => -Math.PI / 2 + i * 2 * Math.PI / n;
    const pt = (i, v) => [cx + Math.cos(ang(i)) * R * v / MAX, cy + Math.sin(ang(i)) * R * v / MAX];
    // 目盛り
    ctx.lineWidth = 1;
    for (let lv = 1; lv <= MAX; lv++) {
      ctx.beginPath();
      for (let i = 0; i < n; i++) { const [x, y] = pt(i, lv); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.closePath();
      ctx.strokeStyle = lv === MAX ? '#999' : '#ddd';
      ctx.stroke();
    }
    ctx.fillStyle = '#888';
    ctx.font = '14px sans-serif';
    for (let lv = 1; lv <= MAX; lv++) { const [x, y] = pt(0, lv); ctx.fillText(String(lv), x + 4, y + 4); }
    // 軸と軸名
    const fs = Math.round(18 * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 17) / 17);
    ctx.font = 'bold ' + Math.min(fs, 24) + 'px sans-serif';
    for (let i = 0; i < n; i++) {
      const [x, y] = pt(i, MAX);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.strokeStyle = '#ccc'; ctx.stroke();
      const k = KEYS[i];
      const [lx, ly] = pt(i, MAX + 0.9);
      ctx.fillStyle = state.weights[k] ? '#222' : '#aaa';
      ctx.textAlign = Math.abs(lx - cx) < 10 ? 'center' : (lx < cx ? 'right' : 'left');
      ctx.textBaseline = 'middle';
      let label = plain(propLabel(k)).replace('電気・熱を', '電気・熱を\n');
      if (label.indexOf('\n') < 0 && label.length > 5) label = label.slice(0, Math.ceil(label.length / 2)) + '\n' + label.slice(Math.ceil(label.length / 2));
      const lines = label.split('\n');
      lines.forEach((ln, j) => ctx.fillText(ln, lx, ly + (j - (lines.length - 1) / 2) * (fs + 2)));
      if (state.weights[k]) {
        ctx.font = Math.min(fs - 4, 20) + 'px sans-serif';
        ctx.fillStyle = '#666';
        ctx.fillText('重み' + state.weights[k], lx, ly + (lines.length / 2 + 0.4) * (fs + 2));
        ctx.font = 'bold ' + Math.min(fs, 24) + 'px sans-serif';
      }
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    // 材料(色・線種・マーカーで区別)
    top.forEach((x, idx) => {
      const s = STYLES[idx];
      ctx.beginPath();
      KEYS.forEach((k, i) => { const [px, py] = pt(i, effVal(x.m, k)); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
      ctx.closePath();
      ctx.setLineDash(s.dash);
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = s.color;
      ctx.globalAlpha = 0.08; ctx.fillStyle = s.color; ctx.fill(); ctx.globalAlpha = 1;
      ctx.stroke();
      ctx.setLineDash([]);
      KEYS.forEach((k, i) => {
        // マーカーは少しずらして重なりを避ける
        const [px, py] = pt(i, effVal(x.m, k));
        const off = (idx - 1) * 5;
        const qx = px + off, qy = py;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        if (s.marker === 'circle') ctx.arc(qx, qy, 6, 0, Math.PI * 2);
        else if (s.marker === 'square') ctx.rect(qx - 5.5, qy - 5.5, 11, 11);
        else { ctx.moveTo(qx, qy - 7); ctx.lineTo(qx + 6.5, qy + 5); ctx.lineTo(qx - 6.5, qy + 5); ctx.closePath(); }
        ctx.fill();
      });
    });
  }

  // ---------- 画面: 理由記述(ふりかえり) ----------
  async function renderReflect() {
    const el = $('#view-reflect');
    const r = ranking();
    const sh = state.sheet;
    const opts = sel => '<option value="">(選ぶ)</option>' + DATA.materials.map(m => '<option value="' + m.id + '"' + (sel === m.id ? ' selected' : '') + '>' + esc(plain(m.name)) + '</option>').join('');
    const useName = (DATA.uses.find(u => u.id === state.useId) || {}).name || '';
    const snap = KEYS.filter(k => state.weights[k]).map(k => plain(propLabel(k)) + state.weights[k]).join('、');
    el.innerHTML =
      '<h2>' + rb('{理由|りゆう}を{書|か}こう') + '<span data-ef-reflect>' + rb('(ふりかえり)') + '</span></h2>' +
      '<p class="lead">' + rb('{点数|てんすう}が1{位|い}の{材料|ざいりょう}を{選|えら}ばなくてもよい。{条件|じょうけん}と{材料|ざいりょう}の{性質|せいしつ}を{結|むす}びつけて、{自分|じぶん}の{言葉|ことば}で{説明|せつめい}しよう。') + '</p>' +
      '<div class="snapshot">' + rb('いまの{条件|じょうけん}: ') + (useName ? rb(useName) + ' / ' : '') + esc(snap || '(重みなし)') +
      (r.length ? ' / ' + rb('1{位|い}: ') + rb(r[0].m.name) : '') + '</div>' +
      '<form id="sheet" class="panel" autocomplete="off">' +
      '<div class="form-row"><label for="f-product">' + rb('{作|つく}るもの') + '</label><input type="text" id="f-product" value="' + esc(sh.product) + '"></div>' +
      '<div class="form-row"><label for="f-chosen">' + rb('{選|えら}んだ{材料|ざいりょう}') + '</label><select id="f-chosen">' + opts(sh.chosen) + '</select></div>' +
      '<div class="form-row"><label for="f-chosen-r">' + rb('{選|えら}んだ{理由|りゆう}') + '</label>' +
      '<p class="hint">' + rb('{例|れい}:「〇〇を{重視|じゅうし}したので、△△が□□な◇◇を{選|えら}んだ。{弱|よわ}いところの××は、～で{補|おぎな}う。」') + '</p>' +
      '<textarea id="f-chosen-r">' + esc(sh.chosenReason) + '</textarea></div>' +
      '<div class="form-row"><label for="f-rejected">' + rb('{選|えら}ばなかった{材料|ざいりょう}') + '</label><select id="f-rejected">' + opts(sh.rejected) + '</select></div>' +
      '<div class="form-row"><label for="f-rejected-r">' + rb('{選|えら}ばなかった{理由|りゆう}') + '</label>' +
      '<p class="hint">' + rb('{例|れい}:「◇◇は〇〇にすぐれるが、△△が{弱|よわ}いので、この{用途|ようと}には{向|む}かない。」') + '</p>' +
      '<textarea id="f-rejected-r">' + esc(sh.rejectedReason) + '</textarea></div>' +
      '<div class="form-row"><label for="f-notice">' + rb('{重|おも}みを{変|か}えて{気|き}づいたこと') + '</label>' +
      '<textarea id="f-notice">' + esc(sh.notice) + '</textarea></div>' +
      '<div class="row-btns"><button type="submit" class="primary">' + rb('{保存|ほぞん}する') + '</button>' +
      '<button type="button" id="sheet-new">' + rb('{新|あたら}しく{書|か}く') + '</button>' +
      '<button type="button" id="sheet-print">' + rb('{印刷|いんさつ}') + '</button></div>' +
      '</form>' +
      '<h3>' + rb('{保存|ほぞん}したワークシート') + '</h3>' +
      '<ul class="saved" id="saved"></ul>' +
      '<div class="row-btns"><button type="button" id="exp">' + rb('ファイルに{書|か}き{出|だ}す') + '</button>' +
      '<label class="btnlike"><button type="button" id="imp">' + rb('ファイルから{読|よ}み{込|こ}む') + '</button><input type="file" id="imp-file" accept="application/json,.json" hidden></label></div>';

    const bind = (id, key) => $(id).addEventListener('input', e => { state.sheet[key] = e.target.value; });
    bind('#f-product', 'product'); bind('#f-chosen', 'chosen'); bind('#f-chosen-r', 'chosenReason');
    bind('#f-rejected', 'rejected'); bind('#f-rejected-r', 'rejectedReason'); bind('#f-notice', 'notice');
    $('#f-chosen').addEventListener('change', e => { state.sheet.chosen = e.target.value; });
    $('#f-rejected').addEventListener('change', e => { state.sheet.rejected = e.target.value; });
    $('#sheet').addEventListener('submit', e => { e.preventDefault(); saveSheet(); });
    $('#sheet-new').addEventListener('click', () => { state.sheet = blankSheet(); renderReflect(); });
    $('#sheet-print').addEventListener('click', () => window.print());
    $('#exp').addEventListener('click', exportAll);
    $('#imp').addEventListener('click', () => $('#imp-file').click());
    $('#imp-file').addEventListener('change', e => importFile(e.target.files[0]));
    renderSaved();
  }

  function matName(id) { const m = DATA.materials.find(x => x.id === id); return m ? plain(m.name) : ''; }

  // 共通スキーマ artifact
  function toArtifact(sh) {
    const now = new Date().toISOString();
    const r = ranking();
    return {
      schema: SCHEMA,
      id: sh.id || (APP_ID + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
      app: APP_ID,
      kind: 'material-selection',
      title: (sh.product || '材料選び') + '(' + (matName(sh.chosen) || '未選択') + ')',
      createdAt: sh.createdAt || now,
      updatedAt: now,
      data: {
        product: sh.product,
        useId: state.useId,
        weights: Object.assign({}, state.weights),
        conductMode: state.conductMode,
        categories: Object.assign({}, state.cats),
        ranking: r.slice(0, 3).map(x => ({ id: x.m.id, name: plain(x.m.name), score: x.s.total })),
        chosen: sh.chosen, chosenName: matName(sh.chosen), chosenReason: sh.chosenReason,
        rejected: sh.rejected, rejectedName: matName(sh.rejected), rejectedReason: sh.rejectedReason,
        notice: sh.notice,
      },
    };
  }
  async function saveSheet() {
    const sh = state.sheet;
    if (!sh.chosen || !sh.chosenReason.trim()) { toast('選んだ材料と理由を書いてから保存しよう'); return; }
    const a = toArtifact(sh);
    try {
      await Store.putArtifact(a);
      sh.id = a.id; sh.createdAt = a.createdAt;
      toast('保存しました');
      renderSaved();
    } catch (e) {
      toast('保存できませんでした。ファイルに書き出してください');
    }
  }
  async function renderSaved() {
    const ul = $('#saved');
    if (!ul) return;
    let list = [];
    try { list = await Store.allArtifacts(); } catch (e) { /* 保存が使えない環境 */ }
    if (!list.length) { ul.innerHTML = '<li>' + rb('まだありません') + '</li>'; return; }
    ul.innerHTML = list.map(a => '<li><span>' + esc(a.title) + ' <small class="cat">' + esc((a.updatedAt || '').slice(0, 16).replace('T', ' ')) + '</small></span>' +
      '<span class="row-btns" style="margin:0"><button type="button" data-open="' + esc(a.id) + '">' + rb('{開|ひら}く') + '</button>' +
      '<button type="button" data-del="' + esc(a.id) + '">' + rb('{削除|さくじょ}') + '</button></span></li>').join('');
    ul.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => openArtifact(list.find(a => a.id === b.dataset.open))));
    ul.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      const a = list.find(x => x.id === b.dataset.del);
      if (!confirm('「' + a.title + '」を削除しますか?')) return;
      await Store.deleteArtifact(a.id);
      if (state.sheet.id === a.id) state.sheet.id = null;
      renderSaved();
    }));
  }
  function openArtifact(a) {
    if (!a || !a.data) return;
    const d = a.data;
    state.sheet = {
      id: a.id, createdAt: a.createdAt, product: d.product || '', chosen: d.chosen || '', chosenReason: d.chosenReason || '',
      rejected: d.rejected || '', rejectedReason: d.rejectedReason || '', notice: d.notice || '',
    };
    if (d.weights) for (const k of KEYS) if (typeof d.weights[k] === 'number') state.weights[k] = clampW(d.weights[k]);
    if (d.conductMode === 'low' || d.conductMode === 'high') state.conductMode = d.conductMode;
    if (d.useId && DATA.uses.some(u => u.id === d.useId)) state.useId = d.useId;
    if (d.categories) for (const c of Object.keys(state.cats)) if (typeof d.categories[c] === 'boolean') state.cats[c] = d.categories[c];
    if (!Object.values(state.cats).some(Boolean)) state.cats = { wood: true, metal: true, plastic: true };
    persistCond();
    renderReflect();
    toast('開きました(条件も復元しました)');
  }
  const clampW = v => Math.max(0, Math.min(5, Math.round(v)));

  async function exportAll() {
    let list = [];
    try { list = await Store.allArtifacts(); } catch (e) { /* noop */ }
    if (!list.length && state.sheet.chosen) list = [toArtifact(state.sheet)];
    if (!list.length) { toast('書き出すワークシートがありません'); return; }
    const payload = { schema: 'gijutsu-bundle/1', app: APP_ID, exportedAt: new Date().toISOString(), artifacts: list };
    const name = 'material-navi-' + new Date().toISOString().slice(0, 10) + '.json';
    if (window.G && G.exportJSON) { G.exportJSON(payload, name); return; }  // 組・番号・名前も入る
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  async function importFile(file) {
    if (!file) return;
    try {
      const obj = JSON.parse(await file.text());
      const arr = (window.G && G.normalizeImport) ? G.normalizeImport(obj, APP_ID)
        : Array.isArray(obj) ? obj : obj.artifacts ? obj.artifacts : [obj];
      const ok = arr.filter(a => a && a.app === APP_ID && a.id && a.data && typeof a.data === 'object');
      for (const a of ok) await Store.putArtifact(a);
      toast(ok.length ? ok.length + '件 読み込みました' : 'このアプリのデータが見つかりませんでした');
      renderSaved();
    } catch (e) {
      toast('読み込めませんでした(JSONファイルか確認してください)');
    }
    $('#imp-file').value = '';
  }

  // ---------- 条件の保存・復元 ----------
  function persistCond() {
    LS.set('cond', { useId: state.useId, weights: state.weights, conductMode: state.conductMode, cats: state.cats });
  }
  function restore() {
    const c = LS.get('cond');
    if (c && c.weights) {
      for (const k of KEYS) if (typeof c.weights[k] === 'number') state.weights[k] = clampW(c.weights[k]);
      // 保存した値がこわれていても使えるように、openArtifact() と同じく型を確かめてから入れる
      if (c.conductMode === 'low' || c.conductMode === 'high') state.conductMode = c.conductMode;
      if (c.useId && DATA.uses.some(u => u.id === c.useId)) state.useId = c.useId;
      if (c.cats) for (const k of Object.keys(state.cats)) if (typeof c.cats[k] === 'boolean') state.cats[k] = c.cats[k];
      if (!Object.values(state.cats).some(Boolean)) state.cats = { wood: true, metal: true, plastic: true };
    }
    if (window.G && G.initApp) return; // ルビ・文字サイズは共通ヘッダーが管理
    if (LS.get('ruby') === false) setRuby(false);
    const zoom = LS.get('zoom');
    if (zoom) setZoom(zoom);
  }

  // ---------- ルビ・拡大 ----------
  function setRuby(on) {
    document.body.classList.toggle('no-ruby', !on);
    const b = $('#btn-ruby');
    b.setAttribute('aria-pressed', String(on));
    b.textContent = on ? 'ルビ あり' : 'ルビ なし';
  }
  const ZOOMS = [1, 1.25, 1.5];
  function setZoom(z) {
    if (!ZOOMS.includes(z)) z = 1;
    document.documentElement.style.setProperty('--zoom', z);
    $('#btn-zoom').textContent = '文字 ' + Math.round(z * 100) + '%';
    if (state.view === 'result') renderResult();
  }

  // ---------- タブ ----------
  const VIEWS = {
    list: { label: '{材料|ざいりょう}カード', render: renderList },
    cond: { label: '{条件設定|じょうけんせってい}', render: renderCond },
    result: { label: '{比較|ひかく}{結果|けっか}', render: renderResult },
    reflect: { label: '{理由|りゆう}を{書|か}く', render: renderReflect },
  };
  function show(view, focus) {
    state.view = view;
    document.querySelectorAll('[role=tab]').forEach(t => {
      const on = t.dataset.view === view;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    for (const v of Object.keys(VIEWS)) $('#view-' + v).hidden = v !== view;
    VIEWS[view].render();
    if (focus) { const t = $('#tab-' + view); t.focus(); window.scrollTo(0, 0); }
  }
  function setupTabs() {
    const tabs = Array.from(document.querySelectorAll('[role=tab]'));
    tabs.forEach((t, i) => {
      t.innerHTML = '<span class="num">' + String.fromCharCode(0x2460 + i) + '</span>' + rb(VIEWS[t.dataset.view].label);  // ①②③④
      t.addEventListener('click', () => show(t.dataset.view));
      t.addEventListener('keydown', e => {
        let j = null;
        if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
        if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
        if (e.key === 'Home') j = 0;
        if (e.key === 'End') j = tabs.length - 1;
        if (j !== null) { e.preventDefault(); show(tabs[j].dataset.view, true); }
      });
    });
  }

  // ---------- 起動 ----------
  async function init() {
    const common = !!(window.G && G.initApp);
    if (common) {
      document.body.classList.add('with-common');
      try { G.initApp({ app: APP_ID, title: '材料選択ナビ', files: FILES }); } catch (e) { document.body.classList.remove('with-common'); }
    }
    $('#app-title').innerHTML = rb('{材料|ざいりょう}{選択|せんたく}ナビ');
    setupTabs();
    $('#btn-ruby').addEventListener('click', () => {
      const on = document.body.classList.contains('no-ruby');
      setRuby(on);
      LS.set('ruby', on);
    });
    $('#btn-zoom').addEventListener('click', () => {
      const cur = parseFloat(document.documentElement.style.getPropertyValue('--zoom')) || 1;
      const z = ZOOMS[(ZOOMS.indexOf(cur) + 1) % ZOOMS.length];
      setZoom(z);
      LS.set('zoom', z);
    });
    try { restore(); } catch (e) { /* 保存が使えなくても動く */ }
    show('list');
    if (!common) registerOffline();
  }

  // オフライン対応: 共通基盤があれば G.initApp が登録する。なければこのフォルダの sw.js を使う
  const FILES = ['index.html', 'app.css', 'app.js', 'materials-data.js', 'materials.json'];
  function registerOffline() {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(() => { /* オフライン非対応でも動作は継続 */ });
    }
  }

  // テスト用
  window.A1 = { state, score, ranking, effVal, applyUse, toArtifact };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
