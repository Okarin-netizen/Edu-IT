/*
 * A6 工具の使い方・安全トレーナー
 * 画面: 工具の手順 / 作業前チェック / 危険を見つける(KYT) / 手順ならべかえ / 実技の評価 / 記録
 */
(function () {
  'use strict';
  var APP = 'tool-safety';
  var D = window.A6_DATA, L = window.A6Logic, F = window.A6Fig, h = G.h;
  var STATE_ID = APP + '-checklist-state';

  G.ruby.add(D.ruby || {});
  G.initApp({
    app: APP,
    title: '工具の使い方・安全トレーナー',
    files: ['index.html', 'style.css', 'app.js', 'logic.js', 'figures.js', 'tools-data.js', 'tools.json']
  });
  G.$('#notice').textContent = D.notice;

  function toolById(id) { return D.tools.filter(function (t) { return t.id === id; })[0]; }
  function svgNode(markup) {
    var wrap = document.createElement('div');
    wrap.innerHTML = markup;
    return wrap.firstChild;
  }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function when(iso) {
    return new Date(iso).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function clear(el) { el.innerHTML = ''; return el; }
  function save(kind, title, data) {
    return G.store.put(G.newArtifact(APP, title, data, kind)).then(function () {
      G.toast('記録しました');
      if (records.refresh) records.refresh();
    }).catch(function () { G.toast('記録できませんでした'); });
  }

  /* =========================================================
   * 1. 工具の手順
   * ======================================================= */
  var tools = (function () {
    var root = G.$('#p-tools');
    var cur = null, step = 0;

    function list() {
      cur = null;
      clear(root);
      root.appendChild(h('p', null, '使う工具を選ぶと、使い方の手順と注意を1つずつ確かめられます。'));
      var grid = h('ul', { class: 'a6-toolgrid' });
      D.tools.forEach(function (t) {
        grid.appendChild(h('li', null, h('button', { type: 'button', class: 'a6-toolcard', onclick: function () { open(t.id); } },
          svgNode(F.draw(t.icon, '', '0 0 320 180')),
          h('span', { class: 'a6-toolname' }, t.name),
          h('span', { class: 'badge' }, t.kind),
          h('span', { class: 'a6-toolsum' }, t.summary))));
      });
      root.appendChild(grid);
    }

    function open(id, s) {
      cur = toolById(id);
      step = s || 0;
      render();
      var head = G.$('h2', root);
      if (head) head.focus();
    }

    // 手順を最後まで読んだら記録に残す(工具ごとに1つ。読み直したら日時を新しくする)
    function markRead(t) {
      var a = G.newArtifact(APP, '手順を読んだ ' + t.name, { toolId: t.id, toolName: t.name, steps: t.steps.length }, 'read');
      a.id = APP + '-read-' + t.id;
      G.store.put(a).then(function () { if (records.refresh) records.refresh(); }).catch(function () {});
    }

    function render() {
      var t = cur, st = t.steps[step];
      if (step === t.steps.length - 1) markRead(t);
      clear(root);
      root.appendChild(h('div', { class: 'g-row' },
        h('button', { type: 'button', class: 'btn', onclick: list }, '◀ 工具の一覧'),
        h('h2', { tabindex: '-1', class: 'a6-h' }, t.name, h('span', { class: 'badge' }, t.kind))));
      // 手順の目次
      var nav = h('ol', { class: 'a6-stepnav', 'aria-label': '手順の一覧' });
      t.steps.forEach(function (x, i) {
        nav.appendChild(h('li', null, h('button', {
          type: 'button', class: 'a6-stepdot' + (i === step ? ' on' : ''), 'aria-current': i === step ? 'step' : null,
          onclick: function () { step = i; render(); }
        }, h('span', { class: 'a6-stepno' }, String(i + 1)), x.title)));
      });
      root.appendChild(nav);
      // 手順カード
      var card = h('article', { class: 'card a6-stepcard', 'aria-live': 'polite' },
        h('div', { class: 'a6-stepfig' }, svgNode(F.draw(st.fig, t.name + ' 手順' + (step + 1) + ' ' + st.title))),
        h('div', { class: 'a6-steptext' },
          h('p', { class: 'a6-stepcount' }, '手順 ' + (step + 1) + ' / ' + t.steps.length),
          h('h3', null, st.title),
          h('p', null, st.text),
          h('p', { class: 'a6-caution' }, h('strong', null, '⚠ 注意 '), st.caution)));
      root.appendChild(card);
      root.appendChild(h('div', { class: 'g-row a6-stepbtns' },
        h('button', { type: 'button', class: 'btn', disabled: step === 0, onclick: function () { step--; render(); } }, '◀ 前の手順'),
        step < t.steps.length - 1
          ? h('button', { type: 'button', class: 'btn primary', onclick: function () { step++; render(); } }, '次の手順 ▶')
          : h('button', { type: 'button', class: 'btn primary', onclick: function () { quiz.start(t.id); tabs.show('quiz'); } }, 'ならべかえで確かめる ▶')));
    }

    root.addEventListener('keydown', function (e) {
      if (!cur || /INPUT|TEXTAREA|SELECT/.test(e.target.nodeName)) return;
      if (e.key === 'ArrowRight' && step < cur.steps.length - 1) { step++; render(); }
      if (e.key === 'ArrowLeft' && step > 0) { step--; render(); }
    });

    list();
    return { open: open };
  })();

  /* =========================================================
   * 2. 作業前チェック
   * ======================================================= */
  var check = (function () {
    var root = G.$('#p-check');
    var checked = {}, doneAt = null;

    function load() {
      return G.store.get(STATE_ID).then(function (a) {
        if (a && a.data && a.data.date === today()) { checked = a.data.checked || {}; doneAt = a.data.doneAt || null; }
      }).catch(function () {}).then(render);
    }
    function persist() {
      var a = G.newArtifact(APP, '作業前チェック(途中)', { date: today(), checked: checked, doneAt: doneAt }, 'state');
      a.id = STATE_ID;
      return G.store.put(a).catch(function () {});
    }

    function render() {
      clear(root);
      var n = D.checklist.filter(function (it) { return checked[it.id]; }).length;
      var all = L.checklistDone(D.checklist, checked);
      var box = h('div', { class: 'card' });
      box.appendChild(h('h2', null, '作業開始チェックリスト'));
      box.appendChild(h('p', null, '作業を始める前に、1つずつ自分の目で確かめてからチェックしよう。すべて確かめるまで「完了」は押せません。'));
      box.appendChild(h('p', { class: 'g-muted' }, '工作室で作業する日に使います。教室の外で自習するときは、チェックを付けずに、各項目の説明を読んで「なぜ必要か」を確かめておこう。'));
      box.appendChild(h('p', { class: 'a6-progress', 'aria-live': 'polite' },
        h('progress', { max: D.checklist.length, value: n, 'aria-hidden': 'true' }),
        ' ' + n + ' / ' + D.checklist.length + ' 確認ずみ'));
      var lastGroup = null;
      D.checklist.forEach(function (it) {
        if (it.group !== lastGroup) { box.appendChild(h('h3', { class: 'a6-group' }, it.group)); lastGroup = it.group; }
        var id = 'chk-' + it.id;
        box.appendChild(h('div', { class: 'g-check a6-checkrow' + (checked[it.id] ? ' on' : '') },
          h('input', { type: 'checkbox', id: id, checked: !!checked[it.id], disabled: !!doneAt, onchange: function (e) {
            if (e.target.checked) checked[it.id] = true; else delete checked[it.id];
            persist(); render();
            var again = G.$('#' + id); if (again) again.focus();
          } }),
          h('label', { for: id }, it.text,
            h('span', { class: 'g-muted a6-hint' }, it.hint))));
      });
      if (doneAt) {
        root.appendChild(h('div', { class: 'card a6-done', role: 'status' },
          h('p', null, h('strong', null, '✔ 完了 '), when(doneAt) + ' にすべて確かめました。先生の合図で作業を始めよう。'),
          h('button', { type: 'button', class: 'btn', onclick: function () { checked = {}; doneAt = null; persist(); render(); } }, 'もう一度チェックする')));
      } else {
        box.appendChild(h('div', { class: 'g-row a6-checkbtns' },
          h('button', { type: 'button', class: 'btn primary', disabled: !all, 'aria-describedby': 'chk-left', onclick: complete }, '完了'),
          h('span', { id: 'chk-left', class: 'g-muted' }, all ? 'すべて確かめました。' : 'あと ' + (D.checklist.length - n) + ' こ'),
          n ? h('button', { type: 'button', class: 'btn ghost', onclick: function () { checked = {}; persist(); render(); } }, 'チェックを外す') : null));
      }
      root.insertBefore(box, root.firstChild);
    }

    function complete() {
      if (!L.checklistDone(D.checklist, checked)) return;
      doneAt = new Date().toISOString();
      persist();
      save('checklist', '作業前チェック ' + today(), {
        date: today(), doneAt: doneAt,
        items: D.checklist.map(function (it) { return { id: it.id, text: it.text, checked: true }; })
      });
      render();
    }

    load();
    return {};
  })();

  /* =========================================================
   * 3. 危険を見つける(KYT)
   * ======================================================= */
  var kyt = (function () {
    var root = G.$('#p-kyt');
    var cur = null, taps = [], result = null, cursor = { x: 200, y: 130 }, svg = null;
    var NEAR = 16;

    function list() {
      cur = null;
      clear(root);
      var card = h('div', { class: 'card' },
        h('h2', null, '危険を見つけよう(危険予知トレーニング)'),
        h('p', null, '作業の場面の絵から、けがや事故につながりそうなところを見つけて、タップしよう。'));
      root.appendChild(card);
      var grid = h('ul', { class: 'a6-toolgrid' });
      D.kyt.forEach(function (k) {
        grid.appendChild(h('li', null, h('button', { type: 'button', class: 'a6-toolcard', onclick: function () { open(k.id); } },
          svgNode(F.scene(k.scene, '')),
          h('span', { class: 'a6-toolname' }, k.title),
          h('span', { class: 'a6-toolsum' }, '危険は ' + k.hazards.length + ' こ'))));
      });
      card.appendChild(grid);
    }

    function open(id) {
      cur = D.kyt.filter(function (k) { return k.id === id; })[0];
      taps = []; result = null;
      render();
    }

    function toSvg(ev) {
      var pt = svg.createSVGPoint();
      pt.x = ev.clientX; pt.y = ev.clientY;
      var p = pt.matrixTransform(svg.getScreenCTM().inverse());
      return { x: Math.round(p.x), y: Math.round(p.y) };
    }

    function toggleAt(p) {
      if (result) return;
      var idx = -1;
      taps.forEach(function (t, i) { if (Math.abs(t.x - p.x) <= NEAR && Math.abs(t.y - p.y) <= NEAR) idx = i; });
      if (idx >= 0) taps.splice(idx, 1); else taps.push(p);
      drawMarks();
      renderTapList();
    }

    function drawMarks() {
      var g = G.$('.k-marks', svg);
      var s = '';
      if (result) {
        cur.hazards.forEach(function (hz, hi) {
          var found = result.found.indexOf(hz.id) >= 0;
          hz.regions.forEach(function (r) {
            s += '<circle class="k-region ' + (found ? 'found' : 'missed') + '" cx="' + r.cx + '" cy="' + r.cy + '" r="' + r.r + '"/>';
          });
          var r0 = hz.regions[0];
          s += '<g class="k-tag ' + (found ? 'found' : 'missed') + '"><rect x="' + (r0.cx - 11) + '" y="' + (r0.cy - r0.r - 12) + '" width="22" height="20" rx="4"/>' +
            '<text x="' + r0.cx + '" y="' + (r0.cy - r0.r + 3) + '" text-anchor="middle">' + String.fromCharCode(65 + hi) + '</text></g>';
        });
      }
      taps.forEach(function (t, i) {
        var bad = result && result.tapHits[i] === null;
        s += '<g class="k-tap' + (bad ? ' wrong' : '') + '"><circle cx="' + t.x + '" cy="' + t.y + '" r="10"/>' +
          '<text x="' + t.x + '" y="' + (t.y + 4) + '" text-anchor="middle">' + (bad ? '×' : String(i + 1)) + '</text></g>';
      });
      g.innerHTML = s;
      var c = G.$('.k-cursor', svg);
      c.innerHTML = svg.classList.contains('kbd') && !result
        ? '<path d="M' + (cursor.x - 14) + ' ' + cursor.y + ' h28 M' + cursor.x + ' ' + (cursor.y - 14) + ' v28"/><circle cx="' + cursor.x + '" cy="' + cursor.y + '" r="9"/>'
        : '';
    }

    function renderTapList() {
      var box = G.$('#kyt-taps', root);
      if (!box) return;
      clear(box);
      if (!taps.length) { box.appendChild(h('p', { class: 'g-muted' }, 'まだ印はありません。')); return; }
      var ol = h('ol', { class: 'a6-taplist' });
      taps.forEach(function (t, i) {
        ol.appendChild(h('li', null, '印 ' + (i + 1) + ' ',
          result ? null : h('button', { type: 'button', class: 'btn small', 'aria-label': '印 ' + (i + 1) + ' を消す', onclick: function () { taps.splice(i, 1); drawMarks(); renderTapList(); } }, '消す')));
      });
      box.appendChild(ol);
    }

    function render() {
      clear(root);
      root.appendChild(h('div', { class: 'g-row a6-back' },
        h('button', { type: 'button', class: 'btn', onclick: list }, '◀ 場面の一覧')));
      var wrap = h('div', { class: 'a6-kyt' });
      var figBox = h('div', { class: 'card a6-scenebox' }, h('h2', null, cur.title), h('p', null, cur.intro));
      svg = svgNode(F.scene(cur.scene, cur.title + 'の場面。危険だと思うところに印をつける'));
      svg.setAttribute('tabindex', '0');
      svg.setAttribute('aria-describedby', 'kyt-help');
      svg.addEventListener('click', function (ev) { svg.classList.remove('kbd'); toggleAt(toSvg(ev)); });
      svg.addEventListener('keydown', function (e) {
        var step = e.shiftKey ? 2 : 10, moved = true;
        if (e.key === 'ArrowLeft') cursor.x -= step;
        else if (e.key === 'ArrowRight') cursor.x += step;
        else if (e.key === 'ArrowUp') cursor.y -= step;
        else if (e.key === 'ArrowDown') cursor.y += step;
        else if (e.key === 'Enter' || e.key === ' ') { moved = false; toggleAt({ x: cursor.x, y: cursor.y }); }
        else return;
        e.preventDefault();
        cursor.x = G.clamp(cursor.x, 0, 400); cursor.y = G.clamp(cursor.y, 30, 260);
        svg.classList.add('kbd');
        if (moved) drawMarks();
      });
      svg.addEventListener('focus', function () { if (!result) { svg.classList.add('kbd'); drawMarks(); } });
      svg.addEventListener('blur', function () { svg.classList.remove('kbd'); drawMarks(); });
      figBox.appendChild(svg);
      figBox.appendChild(h('p', { id: 'kyt-help', class: 'g-muted' },
        'タップすると印がつき、もう一度タップすると消えます。キーボードでは矢印キーで十字を動かし、Enter で印をつけます。'));
      wrap.appendChild(figBox);

      var side = h('div', { class: 'card a6-kytside' });
      side.appendChild(h('h3', null, '自分がつけた印'));
      side.appendChild(h('div', { id: 'kyt-taps', 'aria-live': 'polite' }));
      if (!result) {
        side.appendChild(h('div', { class: 'g-row' },
          h('button', { type: 'button', class: 'btn primary', onclick: judge }, '答え合わせ'),
          h('button', { type: 'button', class: 'btn ghost', onclick: function () { taps = []; drawMarks(); renderTapList(); } }, '印を全部消す')));
      } else {
        side.appendChild(resultView());
      }
      wrap.appendChild(side);
      root.appendChild(wrap);
      drawMarks();
      renderTapList();
    }

    function judge() {
      if (!taps.length) { G.toast('危険だと思うところに印をつけてから答え合わせをしよう'); return; }
      result = L.judgeKyt(cur.hazards, taps);
      render();
      var r = G.$('#kyt-result', root); if (r) r.focus();
      save('kyt', 'KYT ' + cur.title, {
        sceneId: cur.id, taps: taps, found: result.found, missed: result.missed,
        wrongTaps: result.wrongTaps.length, total: result.total
      });
    }

    function resultView() {
      var box = h('div', { id: 'kyt-result', tabindex: '-1' });
      box.appendChild(h('p', { class: 'a6-score' }, '見つけた危険 ', h('strong', null, result.found.length + ' / ' + result.total),
        result.wrongTaps.length ? '(危険ではないところの印 ' + result.wrongTaps.length + ' こ)' : ''));
      if (result.perfect) box.appendChild(h('p', { class: 'g-ok' }, '◎ すべて見つけました。'));
      var ul = h('ul', { class: 'a6-hazlist' });
      cur.hazards.forEach(function (hz, i) {
        var ok = result.found.indexOf(hz.id) >= 0;
        ul.appendChild(h('li', { class: ok ? 'found' : 'missed' },
          h('span', { class: 'a6-haztag' }, String.fromCharCode(65 + i)),
          h('span', { class: 'badge ' + (ok ? 'ok' : 'ng') }, ok ? '✔ 見つけた' : '✖ 見のがし'),
          ' ', h('strong', null, hz.label),
          h('span', { class: 'a6-explain' }, hz.explain)));
      });
      box.appendChild(ul);
      box.appendChild(h('p', { class: 'g-muted' }, '絵の中の実線の丸は見つけた危険、点線の丸は見のがした危険です。'));
      box.appendChild(h('button', { type: 'button', class: 'btn', onclick: function () { open(cur.id); } }, 'もう一度やる'));
      return box;
    }

    list();
    return {};
  })();

  /* =========================================================
   * 4. 手順ならべかえ
   * ======================================================= */
  var quiz = (function () {
    var root = G.$('#p-quiz');
    var cur = null, order = [], result = null;

    function start(id) {
      cur = toolById(id || (cur && cur.id) || D.tools[0].id);
      order = L.shuffledOrder(cur.quiz.length);
      result = null;
      render();
    }

    function render() {
      clear(root);
      var card = h('div', { class: 'card' }, h('h2', null, '手順ならべかえクイズ'));
      root.appendChild(card);
      var sel = h('select', { id: 'quiz-tool', onchange: function () { start(sel.value); } },
        D.tools.map(function (t) { return h('option', { value: t.id, selected: t.id === cur.id ? true : null }, t.name); }));
      card.appendChild(h('div', { class: 'g-row' }, h('label', { for: 'quiz-tool' }, '工具'), sel));
      card.appendChild(h('p', null, '作業の正しい順番になるように、↑↓ボタンで入れかえよう。'));
      var ol = h('ol', { class: 'a6-order' });
      order.forEach(function (v, i) {
        var pos = result ? result.positions[i] : null;
        ol.appendChild(h('li', { class: pos === null ? '' : pos ? 'ok' : 'ng' },
          h('span', { class: 'a6-orderno' }, String(i + 1)),
          h('span', { class: 'a6-ordertext' }, cur.quiz[v]),
          result
            ? h('span', { class: 'badge ' + (pos ? 'ok' : 'ng') }, pos ? '○ 正しい' : '× 正しくは ' + (v + 1) + ' 番目')
            : h('span', { class: 'a6-orderbtns' },
              h('button', { type: 'button', class: 'btn small', 'data-i': i, 'data-d': -1, disabled: i === 0, 'aria-label': (i + 1) + '番目を上へ', onclick: mv }, '↑'),
              h('button', { type: 'button', class: 'btn small', 'data-i': i, 'data-d': 1, disabled: i === order.length - 1, 'aria-label': (i + 1) + '番目を下へ', onclick: mv }, '↓'))));
      });
      card.appendChild(ol);
      if (!result) {
        card.appendChild(h('button', { type: 'button', class: 'btn primary', onclick: judge }, '答え合わせ'));
      } else {
        card.appendChild(h('p', { class: 'a6-score', role: 'status' },
          result.allCorrect ? h('strong', { class: 'g-ok' }, '◎ 全部正しい順番です。') : h('strong', null, result.correctCount + ' / ' + order.length + ' こ 正しい位置')));
        card.appendChild(h('div', { class: 'g-row' },
          h('button', { type: 'button', class: 'btn primary', onclick: function () { start(cur.id); } }, 'もう一度'),
          h('button', { type: 'button', class: 'btn', onclick: function () { tools.open(cur.id); tabs.show('tools'); } }, '手順カードで確かめる')));
      }
    }

    function mv(e) {
      var i = +e.currentTarget.getAttribute('data-i'), d = +e.currentTarget.getAttribute('data-d');
      order = L.move(order, i, i + d);
      render();
      var b = G.$('[data-i="' + (i + d) + '"][data-d="' + d + '"]', root) || G.$('[data-i="' + (i + d) + '"]', root);
      if (b) b.focus();
    }

    function judge() {
      result = L.judgeOrder(order);
      render();
      save('quiz', 'ならべかえ ' + cur.name, {
        toolId: cur.id, answer: order, correctCount: result.correctCount, total: order.length
      });
    }

    start(D.tools[0].id);
    return { start: start };
  })();

  /* =========================================================
   * 5. 実技の評価(ルーブリック)
   * ======================================================= */
  var rubric = (function () {
    var root = G.$('#p-rubric');
    var form = { type: 'self', toolId: D.tools[0].id, task: '', rater: '', ratee: '', scores: {}, comment: '' };

    function radio(name, value, label, checked, onchange) {
      var id = name + '-' + value;
      return h('label', { class: 'a6-choice', for: id },
        h('input', { type: 'radio', name: name, id: id, value: value, checked: checked, onchange: onchange }), ' ', label);
    }

    function render() {
      clear(root);
      var card = h('div', { class: 'card' },
        h('h2', null, '実技の評価(自己評価・相互評価)'),
        h('p', null, '実際に工具を使ったあとに、姿勢・安全・精度の3つの観点でふり返ろう。'),
        h('p', { class: 'g-muted' }, 'まだ実技をしていないときは保存せずに、観点ごとの A・B・C の説明を読んで、実技で何に気をつけるかを確かめておこう。'));
      card.appendChild(h('fieldset', { class: 'a6-fs' }, h('legend', null, '評価の種類'),
        radio('rtype', 'self', '自己評価(自分の作業)', form.type === 'self', function () { form.type = 'self'; render(); }),
        radio('rtype', 'peer', '相互評価(友だちの作業)', form.type === 'peer', function () { form.type = 'peer'; render(); })));
      var sel = h('select', { id: 'r-tool', onchange: function () { form.toolId = sel.value; } },
        D.tools.map(function (t) { return h('option', { value: t.id, selected: t.id === form.toolId ? true : null }, t.name); }));
      card.appendChild(h('div', { class: 'g-grid a6-fields' },
        h('div', { class: 'g-field' }, h('label', { for: 'r-tool' }, '使った工具'), sel),
        h('div', { class: 'g-field' }, h('label', { for: 'r-task' }, '作業の内容(例: 側板を切る)'),
          h('input', { id: 'r-task', value: form.task, maxlength: 60, oninput: function (e) { form.task = e.target.value; } })),
        h('div', { class: 'g-field' }, h('label', { for: 'r-rater' }, '評価した人(なくてもよい)'),
          h('input', { id: 'r-rater', value: form.rater, maxlength: 30, oninput: function (e) { form.rater = e.target.value; } })),
        form.type === 'peer' ? h('div', { class: 'g-field' }, h('label', { for: 'r-ratee' }, '評価された人'),
          h('input', { id: 'r-ratee', value: form.ratee, maxlength: 30, oninput: function (e) { form.ratee = e.target.value; } })) : null));
      D.rubric.criteria.forEach(function (c) {
        var fs = h('fieldset', { class: 'a6-fs a6-crit' }, h('legend', null, c.name));
        var row = h('div', { class: 'a6-levels' });
        ['A', 'B', 'C'].forEach(function (lv) {
          var id = 'r-' + c.id + '-' + lv, on = form.scores[c.id] === lv;
          row.appendChild(h('label', { class: 'a6-level' + (on ? ' on' : ''), for: id },
            h('input', { type: 'radio', name: 'r-' + c.id, id: id, value: lv, checked: on, onchange: function () { form.scores[c.id] = lv; render(); G.$('#' + id).focus(); } }),
            h('span', { class: 'a6-lv' }, lv), h('span', null, c.levels[lv])));
        });
        fs.appendChild(row);
        card.appendChild(fs);
      });
      card.appendChild(h('div', { class: 'g-field' }, h('label', { for: 'r-comment' }, 'よかったところ・次に気をつけること'),
        h('textarea', { id: 'r-comment', maxlength: 400, oninput: function (e) { form.comment = e.target.value; } }, form.comment)));
      var ok = L.rubricComplete(D.rubric.criteria, form.scores);
      card.appendChild(h('div', { class: 'g-row' },
        h('button', { type: 'button', class: 'btn primary', disabled: !ok, onclick: submit }, '保存する'),
        h('span', { class: 'g-muted' }, ok ? '' : '3つの観点すべてを選ぶと保存できます。')));
      root.appendChild(card);
    }

    function submit() {
      if (!L.rubricComplete(D.rubric.criteria, form.scores)) return;
      var t = toolById(form.toolId), tname = t.name;
      var data = {
        type: form.type, toolId: form.toolId, toolName: tname, task: form.task.trim(),
        rater: form.rater.trim(), ratee: form.type === 'peer' ? form.ratee.trim() : '',
        scores: Object.assign({}, form.scores), comment: form.comment.trim()
      };
      save('rubric', (form.type === 'self' ? '自己評価 ' : '相互評価 ') + tname + (data.task ? ' ' + data.task : ''), data);
      form.scores = {}; form.comment = ''; form.task = '';
      render();
    }

    render();
    return {};
  })();

  /* =========================================================
   * 6. 記録
   * ======================================================= */
  var KIND = { read: '工具の手順', checklist: '作業前チェック', kyt: '危険を見つける', quiz: 'ならべかえ', rubric: '実技の評価' };
  var records = (function () {
    var root = G.$('#p-records');

    function summary(a) {
      var d = a.data || {};
      if (a.kind === 'read') return '最後まで読んだ(' + (d.steps || 0) + ' の手順)';
      if (a.kind === 'checklist') return 'すべて確認(' + (d.items ? d.items.length : 0) + ' こ)';
      if (a.kind === 'kyt') return d.found ? d.found.length + ' / ' + d.total + ' こ発見' : '';
      if (a.kind === 'quiz') return d.correctCount + ' / ' + d.total + ' こ正しい位置';
      if (a.kind === 'rubric') {
        return D.rubric.criteria.map(function (c) { return c.name + ' ' + ((d.scores || {})[c.id] || '-'); }).join('  ') +
          (d.ratee ? '(' + d.ratee + ' さん)' : '');
      }
      return '';
    }

    function refresh() {
      return G.store.list(APP).then(function (list) {
        list = list.filter(function (a) { return KIND[a.kind]; });
        var card = h('div', { class: 'card' },
          h('h2', null, '記録'),
          h('p', null, '記録はこの端末の中だけに保存されます。先生に提出するときや別の端末に移すときは「ファイルに書き出す」を使います。'));
        clear(root).appendChild(card);
        card.appendChild(h('div', { class: 'g-row' },
          h('button', { type: 'button', class: 'btn', disabled: !list.length, onclick: function () {
            G.exportJSON({ schema: 'gijutsu-bundle/1', app: APP, exportedAt: new Date().toISOString(), artifacts: list }, 'tool-safety-' + today() + '.json');
          } }, 'ファイルに書き出す'),
          h('button', { type: 'button', class: 'btn', onclick: importJSON }, 'ファイルから読み込む')));
        if (!list.length) { card.appendChild(h('p', { class: 'g-muted' }, 'まだ記録はありません。')); return; }
        var wrap = h('div', { class: 'g-table-wrap' });
        var tb = h('tbody');
        list.forEach(function (a) {
          tb.appendChild(h('tr', null,
            h('td', null, when(a.createdAt)),
            h('td', null, KIND[a.kind]),
            h('td', null, a.title, a.kind === 'rubric' && a.data.comment ? h('div', { class: 'g-muted' }, a.data.comment) : null),
            h('td', null, summary(a)),
            h('td', null, h('button', { type: 'button', class: 'btn small danger', 'aria-label': a.title + ' を削除', onclick: function () {
              G.confirm('「' + a.title + '」を削除します。もとに戻せません。', '削除する').then(function (ok) { if (ok) G.store.del(a.id).then(refresh); });
            } }, '削除'))));
        });
        wrap.appendChild(h('table', { class: 'g-table' },
          h('thead', null, h('tr', null, h('th', null, '日時'), h('th', null, '種類'), h('th', null, '内容'), h('th', null, '結果'), h('th', null, h('span', { class: 'sr-only' }, '操作')))),
          tb));
        card.appendChild(wrap);
      });
    }

    function importJSON() {
      G.pickJSON().then(function (obj) {
        var list = G.normalizeImport(obj, APP).filter(function (a) { return KIND[a.kind]; });
        if (!list.length) { G.toast('このアプリの記録が見つかりませんでした'); return; }
        return Promise.all(list.map(function (a) { return G.store.put(a); })).then(function () {
          G.toast(list.length + ' こ の記録を読み込みました');
          refresh();
        });
      }).catch(function (e) { G.toast(e.message || '読み込めませんでした'); });
    }

    refresh();
    return { refresh: refresh };
  })();

  var tabs = G.tabs(G.$('[data-g-tabs]'));
})();
