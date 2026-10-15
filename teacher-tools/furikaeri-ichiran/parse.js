/* 振り返り一覧(先生用): 各教材が書き出した JSON を、同じ形の「行」にそろえる。
 * ブラウザでは window.FKR、node では require('./parse.js') で使う(classic script)。
 *
 *   FKR.parse(obj, fileName) → { ok, format, entries: [{ domain, app, student, rows }], error }
 *     student: { cls, num, name }   組・番号・名前(全角→半角、末尾の「組」「番」は取る)
 *     rows:    [{ part, type, label, value, at }]
 *       part  … 教材の中の場面(モジュール・課題・作品名など。なければ '')
 *       type  … 'ふりかえり' | '自己評価' | '成績'
 *       label … 問い・項目
 *       value … 書いた文・評価・点数(空のものは入れない)
 *       at    … 日時(ISO か、教材が書いたままの文字)
 *
 * 新しい教材を足すときは ADAPTERS に1つ足す(test で読めるか確かめる)。
 */
(function (root) {
  'use strict';

  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function str(v) { return v == null ? '' : String(v).trim(); }
  function nfkc(v) { var s = str(v); return s.normalize ? s.normalize('NFKC') : s; }

  /* 組・番号・名前をそろえる。「2組15番」のように1つの欄に書いたものも分ける */
  function student(cls, num, name) {
    var c = nfkc(cls).replace(/\s+/g, ''), n = nfkc(num).replace(/\s+/g, '');
    if (c && !n) {
      var m = c.match(/^(.*?)組[-・,、]?(\d+)番?$/);
      if (m) { c = m[1]; n = m[2]; }
    }
    return { cls: c.replace(/組$/, ''), num: n.replace(/番$/, ''), name: nfkc(name) };
  }
  var NOBODY = { cls: '', num: '', name: '' };

  /* 行を集める道具 */
  function Rows(defaultAt) {
    var rows = [];
    return {
      rows: rows,
      add: function (type, part, label, value, at) {
        var v = typeof value === 'number' ? String(value) : str(value);
        if (!v) return;
        rows.push({ part: str(part), type: type, label: str(label), value: v, at: str(at) || str(defaultAt) });
      }
    };
  }
  function pick(list, key) {
    for (var i = 0; i < list.length; i++) if (list[i][0] === key) return list[i][1];
    return key;
  }

  /* ================= A 材料と加工(gijutsu-artifact/1) ================= */
  var A_APPS = {
    'material-navi': 'M1 材料選択ナビ', 'wood-lab': 'M2 木材の繊維・収縮ラボ', 'structure-lab': 'M3 構造強化ラボ',
    'drawing-trainer': 'M4 製図トレーナー', 'kidori': 'M5 木取り・構想シミュレータ', 'tool-safety': 'M6 工具の使い方・安全トレーナー'
  };
  var M4_SELF = [['read', '三面図を見て、立体の形を思いうかべることができた'], ['draw', '第三角法で、正面図・平面図・右側面図を正しい位置にかけた'],
    ['iso', '等角図を、たて・横・おくの3つの向きの線でかけた'], ['line', '線の種類(外形線・かくれ線・中心線など)を使い分けられた']];
  var M4_LV = { '3': 'できた', '2': 'だいたいできた', '1': 'もう少し' };
  var M5_VIEW = [['society', '社会'], ['environment', '環境'], ['economy', '経済'], ['safety', '安全'], ['usability', '使いやすさ'], ['function', '機能']];
  var M6_SCORE = [['posture', '姿勢'], ['safety', '安全'], ['accuracy', '精度']];

  function aRows(a) {
    var d = a.data || {}, at = a.updatedAt || a.createdAt, R = Rows(at), title = str(a.title);
    switch (a.app) {
      case 'material-navi':
        R.add('ふりかえり', title, '選んだ理由', d.chosenReason);
        R.add('ふりかえり', title, '選ばなかった理由', d.rejectedReason);
        R.add('ふりかえり', title, '重みを変えて気づいたこと', d.notice);
        break;
      case 'wood-lab': {
        var n = d.notes || {};
        R.add('ふりかえり', '', '柾目と板目のちがい', n.nt1);
        R.add('ふりかえり', '', '反りや割れを防ぐ木取り・使い方の工夫', n.nt2);
        R.add('ふりかえり', '', '実物の板を観察して分かったこと', n.nt3);
        var log = Array.isArray(d.quizLog) ? d.quizLog : [];
        if (log.length) R.add('成績', '', '反りの予測', log.filter(function (x) { return x && x.correct; }).length + ' / ' + log.length + ' 回 正解');
        break;
      }
      case 'structure-lab': {
        var ch = d.challenge || {};
        R.add('ふりかえり', title, 'いちばんよいと思った設計と、その理由', ch.reflect);
        R.add('ふりかえり', title, '実際に作るとき、ほかに考えること', ch.reflect2);
        R.add('ふりかえり', title, '測定して気づいたこと', d.measuredNote);
        R.add('ふりかえり', title, '三角形の構造が使われているもの', (d.frame || {}).note);
        break;
      }
      case 'drawing-trainer': {
        var r = d.reflect || {}, self = r.self || {};
        M4_SELF.forEach(function (s) { R.add('自己評価', '', s[1], M4_LV[self[s[0]]]); });
        R.add('ふりかえり', '', 'わかったこと・できるようになったこと', r.learned);
        R.add('ふりかえり', '', 'むずかしかったこと・次にがんばりたいこと', r.hard);
        R.add('ふりかえり', '', '製作図をかくときにどう生かしたいか', r.use);
        var t = d.terms || {};
        if (t.best != null) R.add('成績', '', '用語クイズ(最高)', t.best);
        break;
      }
      case 'kidori': {
        var rv = d.review || {}, vp = rv.viewpoints || {};
        var vps = M5_VIEW.filter(function (v) { return vp[v[0]] != null && vp[v[0]] !== ''; })
          .map(function (v) { return v[1] + ' ' + vp[v[0]]; });
        if (vps.length) R.add('自己評価', title, '観点ごとの評価(0〜5)', vps.join(' / '));
        R.add('ふりかえり', title, '工夫したところ・よかったところ', rv.good);
        R.add('ふりかえり', title, '直したいところ(改善の案)', rv.improve);
        R.add('ふりかえり', title, '実物を作って気付いたこと', rv.real);
        break;
      }
      case 'tool-safety':
        if (a.kind === 'rubric') {
          var sc = d.scores || {};
          var part = [d.type === 'peer' ? '相互評価' : '自己評価', d.toolName, d.task].filter(Boolean).join(' ');
          var s = M6_SCORE.filter(function (x) { return sc[x[0]]; }).map(function (x) { return x[1] + ' ' + sc[x[0]]; }).join(' / ');
          if (d.type === 'peer' && s) s += '(' + [str(d.rater) && '評価した人: ' + str(d.rater), str(d.ratee) && '評価された人: ' + str(d.ratee)].filter(Boolean).join('、') + ')';
          R.add('自己評価', part, '姿勢・安全・精度', s);
          R.add('ふりかえり', part, 'よかったところ・次に気をつけること', d.comment);
        } else if (a.kind === 'kyt' && d.total) {
          R.add('成績', title, '危険を見つけた数', (d.found || []).length + ' / ' + d.total);
        } else if (a.kind === 'quiz' && d.total) {
          R.add('成績', title, '正しい順番', d.correctCount + ' / ' + d.total);
        }
        break;
    }
    return R.rows;
  }
  function isArtifact(a) { return isObj(a) && typeof a.app === 'string' && isObj(a.data); }
  function parseA(obj) {
    var list = Array.isArray(obj) ? obj : Array.isArray(obj.artifacts) ? obj.artifacts : [obj];
    list = list.filter(function (a) { return isArtifact(a) && A_APPS[a.app] && a.kind !== 'state'; });
    var base = isObj(obj.student) ? student(obj.student.class, obj.student.no, obj.student.name) : null;
    var by = {};
    list.forEach(function (a) {
      var st = base || (a.app === 'drawing-trainer' && str(a.data.name) ? student('', '', a.data.name) : NOBODY);
      var e = by[a.app] || (by[a.app] = { domain: 'A', app: A_APPS[a.app], student: st, rows: [] });
      e.rows = e.rows.concat(aRows(a));
    });
    return Object.keys(by).map(function (k) { return by[k]; });
  }

  /* ================= B 生物育成 ================= */
  var B1_Q = [['q1', '育てた生物と、自分が工夫した育成環境の調節方法'], ['q2', '記録(グラフ・写真)からわかったこと'], ['q3', '予測と実際をくらべて気づいたこと'],
    ['q4', 'うまくいかなかったことと、その原因'], ['q5', '次に育てるとき、どう改善するか'], ['q6', '生物育成の技術は社会や生活でどう役立っているか・これからどう使いたいか']];
  var B1_S = [['s1', '毎日の観察・記録を続けられた'], ['s2', '記録やグラフから成長の変化を読み取れた'], ['s3', '記録をもとに改善の方法を考えられた'], ['s4', '安全や環境に気をつけて育てられた']];
  var B1_EV = [['good', 'よかったこと'], ['bad', 'うまくいかなかったこと'], ['next', '次にどうするか'], ['society', '社会とのつながり']];
  function parseB1(obj) {
    var p = obj.profile || {}, r = p.refl || {}, R = Rows(r.savedTs || obj.exportedAt);
    B1_S.forEach(function (s) { R.add('自己評価', '', s[1], r[s[0]]); });
    B1_Q.forEach(function (q) { R.add('ふりかえり', '', q[1], r[q[0]]); });
    var plans = {};
    (p.plans || []).forEach(function (pl) { if (isObj(pl)) plans[pl.id] = pl; });
    Object.keys(p.evals || {}).forEach(function (id) {
      var ev = p.evals[id] || {}, pl = plans[id] || {};
      if (pl.demo) return;
      var part = '評価: ' + (str(pl.name) || '計画');
      B1_EV.forEach(function (x) { R.add('ふりかえり', part, x[1], ev[x[0]]); });
    });
    return [{ domain: 'B', app: 'B1 育成日誌', student: student(r.cls, r.no, r.fullname), rows: R.rows }];
  }
  var B3_Q = [['q1', '生き物を健康に育てるために大切な条件'], ['q2', 'うまくいかなかったことと、その原因・改善した方法'], ['q3', '生き物の様子から状態を読み取るとき大切だと思ったこと'],
    ['q4', '実際の飼育や観察で生かしたいこと'], ['q6', '世話の回数や量とコスト(健康とのバランス)'], ['q5', '生き物の命や生態系、水産業・畜産業について考えたこと']];
  var B3_EV = [['e1', '動物・水産生物に合った環境の条件が分かった'], ['e2', '様子やデータから原因を考え、世話の方法を改善できた'], ['e3', '命を大切にし、実際の飼育や社会に生かそうと考えた']];
  var B3_LV = ['◎ よくできた', '○ できた', '△ もう少し'];
  var B3_QUIZ = [['water', '水の生き物の診断'], ['land', '陸の動物の診断'], ['eco', '生態系と産業への配慮']];
  function parseB3(obj) {
    var d = obj.data || {}, r = d.refl || {}, ev = r.ev || {}, R = Rows(r.saved || obj.exported);
    B3_EV.forEach(function (e) { R.add('自己評価', '', e[1], B3_LV[ev[e[0]]]); });
    B3_Q.forEach(function (q) { R.add('ふりかえり', '', q[1], r[q[0]]); });
    var qz = d.quiz || {};
    B3_QUIZ.forEach(function (q) { var x = qz[q[0]]; if (isObj(x) && x.best != null) R.add('成績', '', q[1] + '(最高)', x.best, x.date); });
    return [{ domain: 'B', app: 'B3 動物飼育・水産', student: student(r.cls, r.no, r.name), rows: R.rows }];
  }
  var B4_Q = [['q1', '収穫日から逆算して計画を立てて気づいたこと'], ['q2', '地域や休業日を入れると計画はどう変わったか・なぜ考えるとよいか'],
    ['q3', '計画と実際のずれとその原因、次の改善案'], ['q4', '育成計画を立てる技術は社会や生活でどう役立つか']];
  var B4_S = [['a', '作物の性質をもとに、作業日を逆算して計画を立てられた'], ['b', '地域・休業日・連作などの条件を考えて計画を直せた'], ['c', '計画と実際をくらべて、原因と改善案を考えられた']];
  var B4_LV = { 3: '◎ よくできた', 2: '○ できた', 1: '△ もう少し' };
  function parseB4(obj) {
    var r = obj.reflection || {}, self = r.self || {}, R = Rows(r.saved);
    B4_S.forEach(function (s) { R.add('自己評価', '', s[1], B4_LV[self[s[0]]]); });
    B4_Q.forEach(function (q) { R.add('ふりかえり', '', q[1], r[q[0]]); });
    return [{ domain: 'B', app: 'B4 栽培暦ビルダー', student: student(r.kumi, r.ban, r.name), rows: R.rows }];
  }

  /* ================= C エネルギー変換(energyApps.artifact) ================= */
  var C_APPS = { E3: 'E3 機構ラボ', E4: 'E4 保守点検ラボ', E5: 'E5 回路設計シート' };
  function parseC(obj) {
    var R = Rows(obj.savedAt), d = obj.data || {}, who = obj.who || {};
    if (obj.app === 'E5') {
      var n = d.notes || {}, part = str(obj.name) || str(d.task);
      R.add('ふりかえり', part, '目的', n.goal);
      R.add('ふりかえり', part, '条件', n.cond);
      R.add('ふりかえり', part, '構想・設計の理由', n.idea);
      R.add('ふりかえり', part, 'うまくいったこと', n.good);
      R.add('ふりかえり', part, '改善案', n.improve);
    }
    return [{ domain: 'C', app: C_APPS[obj.app] || String(obj.app), student: student(who.cls, '', who.name), rows: R.rows }];
  }

  /* ================= D 情報 ================= */
  var D_NAMES = {
    'デジタル化ラボ': { image: '1 画像のデジタル化', sound: '2 音のデジタル化', binary: '3 2進数と文字コード', compress: '4 圧縮のしくみ', drill: '5 データ量の計算ドリル' },
    '仮想CPUラボ': { diagram: '1 図解: 5つの装置', sim: '2 仮想CPUを動かす', tasks: '3 課題', auto: '4 手計算くらべ' },
    'ネットワーク通信シミュレータ': { build: '1 ネットワークを組み立てる', flow: '2 Webページが届くまで', fault: '3 回線が切れたら？', spy: '4 のぞき見と暗号化', drill: '5 IPアドレス・ドリル' },
    '計測・制御シミュレータ': { streetlight: '1 街灯', door: '2 自動ドア', traffic: '3 信号機（時間で切りかえ）', 'traffic-button': '4 押しボタン式信号機', sandbox: '5 自由に作る（仮想マイコン）' }
  };
  var VCPU_Q = {
    diagram: 'コンピュータの5つの装置の役割と、データが流れる順', sim: '命令を「取り出し → 解読 → 実行」するようすを見て気づいたこと',
    tasks: 'プログラムが思ったとおりに動かなかったとき、どこを見てどう直したか', auto: '処理を自動化するよさと注意すること'
  };
  function stD(s) { s = s || {}; return student(s.cls, s.num, s.name); }
  function reflObj(R, app, refl, labels) {
    Object.keys(refl || {}).forEach(function (k) {
      var r = refl[k];
      var text = isObj(r) ? r.text : r, at = isObj(r) ? r.at : '';
      R.add('ふりかえり', (D_NAMES[app] || {})[k] || k, (labels || {})[k] || 'ふりかえり', text, at);
    });
  }
  function parseVcpu(obj) {
    var app = '仮想CPUラボ', R = Rows(obj.exportedAt);
    var tasks = Array.isArray(obj.tasks) ? obj.tasks : [];
    if (tasks.length) R.add('成績', '3 課題', 'クリアした課題', tasks.filter(function (t) { return t && t.cleared; }).length + ' / ' + tasks.length);
    var dg = (obj.done || {}).diagram;
    if (isObj(dg) && dg.total) R.add('成績', '1 図解: 5つの装置', 'クイズ', dg.score + ' / ' + dg.total, dg.at);
    reflObj(R, app, obj.reflections, VCPU_Q);
    return [{ domain: 'D', app: app, student: stD(obj.student), rows: R.rows }];
  }
  function parseDigi(obj) {
    var app = 'デジタル化ラボ', R = Rows(obj.exportedAt);
    (obj.modules || []).forEach(function (m) {
      if (!isObj(m)) return;
      var part = D_NAMES[app][m.id] || str(m.title);
      var best = ((m.score || {}).best) || null;
      if (isObj(best) && best.total) R.add('成績', part, 'ドリル(最高)', best.correct + ' / ' + best.total, best.at);
      R.add('ふりかえり', part, 'ふりかえり', m.reflection);
    });
    return [{ domain: 'D', app: app, student: stD(obj.student), rows: R.rows }];
  }
  function parseNet(obj) {
    var app = 'ネットワーク通信シミュレータ', R = Rows(obj.exportedAt);
    var dr = ((obj.modules || {}).drill || {}).score || {};
    if (dr.best != null) R.add('成績', D_NAMES[app].drill, 'ドリル(最高)', dr.best + ' / 10');
    reflObj(R, app, obj.reflections);
    return [{ domain: 'D', app: app, student: stD(obj.student), rows: R.rows }];
  }
  function parseSec(obj) {
    var R = Rows(obj.exportedAt), ck = obj.checks || {};
    R.add('成績', '理解度チェック', '事前テスト', ck.pre);
    R.add('成績', '理解度チェック', '事後テスト', ck.post);
    (obj.reflections || []).forEach(function (r) { if (isObj(r)) R.add('ふりかえり', str(r.title) || str(r.module), 'ふりかえり', r.text, r.at); });
    return [{ domain: 'D', app: '情報セキュリティ体験ラボ', student: stD(obj.student), rows: R.rows }];
  }
  function parseMc(obj) {
    var app = '計測・制御シミュレータ', R = Rows(obj.exportedAt), best = {};
    (obj.records || []).forEach(function (r) {
      if (!isObj(r) || !r.total) return;
      var b = best[r.sid];
      if (!b || r.passed > b.passed || (r.passed === b.passed && str(r.at) > str(b.at))) best[r.sid] = r;
    });
    Object.keys(best).forEach(function (sid) {
      var r = best[sid];
      R.add('成績', D_NAMES[app][sid] || str(r.title) || sid, 'テスト(いちばんよい結果)', r.passed + ' / ' + r.total, r.at);
    });
    reflObj(R, app, obj.reflections);
    return [{ domain: 'D', app: app, student: stD(obj.student), rows: R.rows }];
  }
  function studioRows(R, w, at) {
    var part = str(w.title) || '作品';
    R.add('ふりかえり', part, 'テストして直したこと(改善)', w.improve, at);
    R.add('ふりかえり', part, 'ふりかえり', w.reflect, at);
  }
  function parseStudio(obj) {
    var R = Rows(obj.exportedAt);
    (obj.works || []).forEach(function (w) { if (isObj(w)) studioRows(R, w, w.updatedAt); });
    return [{ domain: 'D', app: '双方向コンテンツ制作スタジオ', student: stD(obj.student), rows: R.rows }];
  }
  function parseStudioWork(obj) {
    var w = obj.work || {}, R = Rows(w.updatedAt);
    studioRows(R, w.plan || {}, w.updatedAt);
    R.rows.forEach(function (r) { r.part = str(w.title) || '作品'; });
    return [{ domain: 'D', app: '双方向コンテンツ制作スタジオ', student: NOBODY, rows: R.rows }];
  }
  var GENAI_Q = [['r1', '文章をつくるAIと画像をつくるAIは、それぞれどうやって作っていたか'], ['r2', 'ハルシネーションや個人情報について、気をつけたいこと'], ['r3', '生成AIを、どんな場面で、どのように使ってみたいか']];
  function parseGenai(obj) {
    var R = Rows(obj.exportedAt), q = obj.quiz || {}, r = obj.reflection || {};
    if (q.total) R.add('成績', 'クイズ', '正解', q.correct + ' / ' + q.total);
    GENAI_Q.forEach(function (x) { R.add('ふりかえり', '', x[1], r[x[0]]); });
    return [{ domain: 'D', app: '生成AIのしくみラボ', student: stD(obj.student), rows: R.rows }];
  }
  var HASH_Q = [['r1', 'ハッシュ関数の性質'], ['r2', 'パスワードを守るために、サービスを作る側と自分ができること'], ['r3', 'ハッシュ値が役に立っているところ']];
  function parseHash(obj) {
    var R = Rows(obj.exportedAt), q = obj.quiz || {}, r = obj.reflection || {};
    var ch = Array.isArray(obj.challenges) ? obj.challenges.filter(isObj) : [];
    if (ch.length) R.add('成績', '', 'チャレンジ達成', ch.filter(function (x) { return x.cleared; }).length + ' / ' + ch.length);
    ch.forEach(function (x) { if (x.cleared) R.add('成績', 'ステップ' + str(x.no), 'チャレンジ', '達成: ' + str(x.title), x.at); });
    if (q.total) R.add('成績', 'クイズ', '正解', q.correct + ' / ' + q.total);
    HASH_Q.forEach(function (x) { R.add('ふりかえり', '', x[1], r[x[0]]); });
    return [{ domain: 'D', app: 'ハッシュ化体験ラボ', student: stD(obj.student), rows: R.rows }];
  }
  function parseKyozai(obj) {
    var st = stD(obj.student);
    return (obj.materials || []).filter(function (m) { return isObj(m) && m.hasRecord; }).map(function (m) {
      var R = Rows(obj.exportedAt);
      (m.reflections || []).forEach(function (r) { if (isObj(r)) R.add('ふりかえり', r.page, 'ふりかえり', r.text, r.at); });
      return { domain: 'D', app: str(m.title), student: st, rows: R.rows };
    });
  }

  /* ================= 形の見分け(上から順に試す) ================= */
  var ADAPTERS = [
    ['情報の技術 体験教材集(記録まとめ)', function (o) { return o.kind === '記録まとめ' && Array.isArray(o.materials); }, parseKyozai],
    ['材料と加工', function (o) {
      return o.schema === 'gijutsu-bundle/1' || o.schema === 'gijutsu-artifact/1' ||
        (Array.isArray(o.artifacts) && o.artifacts.some(isArtifact)) || (isArtifact(o) && A_APPS[o.app]);
    }, parseA],
    ['B1 育成日誌', function (o) { return o.app === 'B1' && isObj(o.profile); }, parseB1],
    ['B3 動物飼育・水産', function (o) { return o.app === 'B3' && isObj(o.data); }, parseB3],
    ['B4 栽培暦ビルダー', function (o) { return o.app === 'b4' && (isObj(o.reflection) || isObj(o.state)); }, parseB4],
    ['エネルギー変換', function (o) { return o.schema === 'energyApps.artifact'; }, parseC],
    ['仮想CPUラボ', function (o) { return o.app === 'virtual-cpu'; }, parseVcpu],
    ['デジタル化ラボ', function (o) { return o.app === 'デジタル化ラボ'; }, parseDigi],
    ['ネットワーク通信シミュレータ', function (o) { return o.app === 'network-sim'; }, parseNet],
    ['情報セキュリティ体験ラボ', function (o) { return o.app === 'seclab' && o.student !== undefined; }, parseSec],
    ['計測・制御シミュレータ', function (o) { return o.app === '計測・制御シミュレータ'; }, parseMc],
    ['双方向コンテンツ制作スタジオ', function (o) { return o.app === 'interactive-studio' && Array.isArray(o.works); }, parseStudio],
    ['双方向コンテンツ制作スタジオ(作品ファイル)', function (o) { return o.format === 'interactive-studio-work' && isObj(o.work); }, parseStudioWork],
    ['生成AIのしくみラボ', function (o) { return o.app === '生成AIのしくみラボ'; }, parseGenai],
    ['ハッシュ化体験ラボ', function (o) { return o.app === 'ハッシュ化体験ラボ'; }, parseHash]
  ];

  /* ファイル名から組・番号・名前を拾う(JSON の中に名前がないとき用) */
  function studentFromFile(fileName) {
    var stem = nfkc(fileName).replace(/\.json$/i, '');
    var m = stem.match(/(\d+)組[-_]?(\d+)番[-_]?([^_\-\d][^_]*)?/);
    if (m) return student(m[1], m[2], m[3] && !/^\d/.test(m[3]) ? m[3] : '');
    return null;
  }

  function parse(obj, fileName) {
    if (!isObj(obj) && !Array.isArray(obj)) return { ok: false, error: 'JSON の形が教材の記録ではありません' };
    for (var i = 0; i < ADAPTERS.length; i++) {
      var a = ADAPTERS[i];
      if (!Array.isArray(obj) && !a[1](obj)) continue;
      if (Array.isArray(obj) && a[2] !== parseA) continue;
      var entries = a[2](obj);
      if (!entries.length) return { ok: false, format: a[0], error: '記録が入っていませんでした' };
      var fromFile = studentFromFile(fileName || '');
      entries.forEach(function (e) {
        var s = e.student;
        if (!s.cls && !s.num && !s.name && fromFile) {
          e.student = fromFile;
          e.fromFile = true;
        }
      });
      return { ok: true, format: a[0], entries: entries };
    }
    return { ok: false, error: 'どの教材の記録か分かりませんでした' };
  }

  /* 並べかえ用: 組 → 番号 → 名前(数字は数として比べる) */
  function natural(a, b) {
    var x = String(a), y = String(b);
    var nx = parseFloat(x.replace(/[^\d.]/g, '')), ny = parseFloat(y.replace(/[^\d.]/g, ''));
    if (x !== y && !isNaN(nx) && !isNaN(ny) && nx !== ny) return nx - ny;
    return x < y ? -1 : x > y ? 1 : 0;
  }
  function studentKey(s) { return [s.cls, s.num, s.name].join('\u0001'); }
  function compareStudent(a, b) {
    var pa = !a.cls && !a.num, pb = !b.cls && !b.num;
    if (pa !== pb) return pa ? 1 : -1;
    return natural(a.cls, b.cls) || natural(a.num, b.num) || natural(a.name, b.name);
  }

  /* CSV(Excel・スプレッドシートで文字化けしないように BOM と CRLF) */
  function csv(rows) {
    return '﻿' + rows.map(function (r) {
      return r.map(function (c) {
        var s = c == null ? '' : String(c);
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;  // 数式として動かないように
        return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\r\n') + '\r\n';
  }

  var api = { parse: parse, student: student, studentKey: studentKey, compareStudent: compareStudent, natural: natural, csv: csv, formats: ADAPTERS.map(function (a) { return a[0]; }) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FKR = api;
})(this);
