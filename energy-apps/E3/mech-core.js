/* ===================================================================
   機構コア(部品データ+運動学) — E3 機構ラボ / E4 保守点検クイズ 共用
   window.EnergyApps.Mech
   ・力学(物理エンジン)は使わず、運動学(動きの幾何と比)だけで計算する
   ・回転を伝える列 train = { wheels:[{kind,size}], links:[type] }
       kind: 'gear'(歯車:size=歯数) 'pulley'(プーリー:size=直径mm) 'sprocket'(スプロケット:size=歯数)
       links[i] は wheels[i] と wheels[i+1] のつなぎ方:
       'mesh'(かみ合い) 'belt'(平ベルト) 'cross'(十字掛けベルト) 'chain'(チェーン) 'shaft'(同じ軸に固定)
   ・回転の向き: +1 = 入力(モーター)と同じ向き(時計回り)、-1 = 逆向き
   =================================================================== */
(function () {
'use strict';
var NS = window.EnergyApps = window.EnergyApps || {};
if (NS.Mech) return;

/* ---------- 部品データ(E4 の部品図鑑と共用) ---------- */
var PARTS = {
  gear: { name: '歯車', yomi: 'はぐるま', cat: '回転を伝える', unit: '枚', sizeName: '歯数', sizeUnit: '', min: 8, max: 80,
    role: '歯と歯がかみ合って、すべらずに回転を伝える。かみ合った2枚は逆向きに回る。',
    where: ['時計', 'ミシン', '自動車の変速機', '電動ドリル'],
    care: ['歯が欠けていないか', '油(グリース)が切れていないか', '異音がしないか'] },
  pulley: { name: 'プーリー(ベルト車)', yomi: 'ぷーりー(べるとぐるま)', cat: '回転を伝える', sizeName: '直径', sizeUnit: 'mm', min: 20, max: 200,
    role: 'ベルトをかけて、離れた軸に回転を伝える。ベルトがすべると伝わる回転が減る。',
    where: ['洗濯機', '自動車のエンジン', 'ボール盤'],
    care: ['ベルトがゆるんで、すべっていないか', 'ベルトにひびやすりへり(摩耗)がないか'] },
  sprocket: { name: 'スプロケット', yomi: 'すぷろけっと', cat: '回転を伝える', sizeName: '歯数', sizeUnit: '', min: 10, max: 60,
    role: 'チェーンとかみ合う歯をもつ車。すべらずに、離れた軸へ回転を伝える。',
    where: ['自転車', 'オートバイ'],
    care: ['歯がすりへって、先がとがっていないか', 'さびや油切れがないか', 'かけたチェーンがたるんでいないか'] },
  belt: { name: '平ベルト', yomi: 'ひらべると', cat: '回転を伝える',
    role: '2つのプーリーにかけて回転を伝える。ふつうにかけると同じ向き、十字にかけると逆向きに回る。断面がV字のVベルトは、みぞにはまってすべりにくい。',
    where: ['洗濯機', 'ボール盤', '農業機械'], care: ['張りがゆるすぎたり強すぎたりしないか', 'ひび割れがないか'] },
  chain: { name: 'チェーン(ローラチェーン)', yomi: 'ちぇーん(ろーらちぇーん)', cat: '回転を伝える',
    role: '2つのスプロケットにかけて、すべらずに回転を伝える。両方とも同じ向きに回る。',
    where: ['自転車', 'オートバイ'], care: ['たるみが10〜20mmか', '油が切れていないか', 'さびていないか'] },
  shaft: { name: '軸', yomi: 'じく', cat: '支える・つなぐ',
    role: '歯車やプーリーを固定して回転を伝える棒。同じ軸に付いた部品は同じ速さ・同じ向きに回る。',
    where: ['すべての回転する機械'], care: ['曲がっていないか', 'ガタつきがないか'] },
  bearing: { name: '軸受(ベアリング)', yomi: 'じくうけ(べありんぐ)', cat: '支える・つなぐ',
    role: '回転する軸を支え、摩擦(まさつ)を小さくする。玉などが転がる「転がり軸受」(玉軸受=ボールベアリングなど)と、軸が面の上をすべる「滑り(すべり)軸受」がある。',
    where: ['自転車の車輪', '扇風機', 'スケートボード'], care: ['回すと異音やガタがないか', '油が切れていないか'] },
  rack: { name: 'ラックとピニオン', yomi: 'らっく・ぴにおん', cat: '運動を変える',
    role: '小さな歯車(ピニオン)の回転を、まっすぐな歯(ラック)の直線運動に変える。',
    where: ['自動車のハンドル', 'ボール盤の上下', '鉄道(登山電車)'], care: ['歯がすりへっていないか', '油が切れていないか'] },
  cam: { name: 'カム', yomi: 'かむ', cat: '運動を変える',
    role: '特別な形の板(カム)の回転を、従動節(じゅうどうせつ。カムに押されて動く棒)の上下の往復運動に変える。形で動き方が決まる。',
    where: ['エンジンの弁', 'ミシンの糸巻き', 'おもちゃ'], care: ['カムの面がすりへっていないか', '従動節が引っかからないか'] },
  link: { name: 'リンク機構(四節リンク)', yomi: 'りんくきこう(よんせつりんく)', cat: '運動を変える',
    role: '4本の棒(リンク)を組み合わせ、回転運動を揺動(ようどう。決まった角度の間を行ったり来たりする動き)などに変える。',
    where: ['ワイパー', '足踏みミシン', 'パンタグラフ', '自転車のペダルと足'], care: ['ピン(つなぎ目)にガタがないか', 'ゆるんでいないか'] },
  crank: { name: 'スライダクランク機構', yomi: 'すらいだくらんくきこう', cat: '運動を変える',
    role: 'クランクの回転とスライダの往復直線運動を変換する。エンジンではピストンの往復で軸を回す。',
    where: ['自動車のエンジン', 'ポンプ', 'コンプレッサ'], care: ['油が切れていないか', 'ピストンがすりへっていないか'] },
  screw: { name: 'ねじ(送りねじ)', yomi: 'ねじ(おくりねじ)', cat: '運動を変える',
    role: 'ねじを1回転させると、ナットがねじ山1つ分(ピッチ。山と山の間かく)だけ進む。小さな力で大きな力が出せる。',
    where: ['万力', 'ジャッキ', '工作機械の送り'], care: ['ねじ山がつぶれていないか', '油が切れていないか', 'ゆるんでいないか'] }
};

var LINKS = {
  mesh:  { name: '歯車のかみ合い', kind: 'gear', flip: -1, eff: 0.95 },
  belt:  { name: '平ベルト', kind: 'pulley', flip: 1, eff: 0.90 },
  cross: { name: '十字掛けベルト', kind: 'pulley', flip: -1, eff: 0.88 },
  chain: { name: 'チェーン', kind: 'sprocket', flip: 1, eff: 0.95 },
  shaft: { name: '同じ軸', kind: null, flip: 1, eff: 1 }
};

function round(x, d) { var m = Math.pow(10, d == null ? 3 : d); return Math.round(x * m) / m; }
function gcd(a, b) { a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b)); while (b) { var t = a % b; a = b; b = t; } return a || 1; }

/* 列の正しさチェック(エラーの配列。空ならOK) */
function checkTrain(t) {
  var errs = [], W = t.wheels, L = t.links;
  if (!W.length) errs.push('部品がありません');
  if (L.length !== W.length - 1) errs.push('つなぎ方の数が合いません');
  L.forEach(function (l, i) {
    var d = LINKS[l];
    if (!d) { errs.push((i + 1) + '番目のつなぎ方が不明'); return; }
    if (d.kind && (W[i].kind !== d.kind || W[i + 1].kind !== d.kind)) errs.push((i + 1) + '番目: ' + d.name + 'には' + PARTS[d.kind].name + 'どうしが必要');
    if (l === 'shaft' && i > 0 && L[i - 1] === 'shaft') errs.push('同じ軸に3枚は重ねられません');
  });
  return errs;
}

/* 列を解く: 各車の回転比 g(入力に対する符号つき倍率)・回転速度・トルク倍率 */
function solveTrain(t, opt) {
  opt = opt || {};
  var rpm = t.rpm || 60, W = t.wheels, L = t.links, loss = !!opt.loss;
  var out = [], g = 1, tq = 1, shaft = 0;
  for (var i = 0; i < W.length; i++) {
    if (i > 0) {
      var l = L[i - 1], d = LINKS[l] || LINKS.shaft;
      if (l === 'shaft') { /* 同じ軸: そのまま */ }
      else {
        var r = W[i - 1].size / W[i].size;      // 原動車/従動車 の大きさ比 = 回転速度の倍率
        g = g * r * d.flip;
        tq = tq / r * (loss ? d.eff : 1);
        shaft++;
      }
    }
    out.push({ kind: W[i].kind, size: W[i].size, shaft: shaft, g: g, rpm: Math.abs(g) * rpm, dir: g >= 0 ? 1 : -1, torque: tq });
  }
  var last = out[out.length - 1] || { g: 1, torque: 1 };
  var stages = [];
  L.forEach(function (l, i) {
    if (l === 'shaft') return;
    stages.push({ link: l, from: i, to: i + 1, drv: W[i].size, drn: W[i + 1].size, ratio: W[i + 1].size / W[i].size });
  });
  return {
    wheels: out, stages: stages, shafts: shaft + 1,
    inRpm: rpm, outRpm: Math.abs(last.g) * rpm, outG: last.g,
    dir: last.g >= 0 ? 1 : -1,
    ratio: 1 / Math.abs(last.g),          // 速度伝達比 = 入力の回転速度 / 出力の回転速度
    torque: last.torque, errors: checkTrain(t)
  };
}

/* 見た目の半径(世界座標) */
function wheelR(w) {
  if (w.kind === 'gear') return w.size * 1.6;
  if (w.kind === 'sprocket') return w.size * 1.7;
  return w.size * 0.55;
}
/* 配置: 左から右へ。かみ合いは半径の和、ベルト・チェーンはすきまを空ける、同じ軸は重ねる。
   さらに、かみ合いの歯がずれないよう各車の初期角 a0 を決める */
function layoutTrain(t) {
  var W = t.wheels, L = t.links, pos = [], x = 0, sol = solveTrain(t), layer = 0;
  for (var i = 0; i < W.length; i++) {
    var r = wheelR(W[i]), a0 = 0;
    if (i > 0) {
      var l = L[i - 1], pr = pos[i - 1];
      if (l === 'shaft') layer++;
      else if (l === 'mesh') x += pr.r + r;
      else x += Math.max(pr.r + r + 50, 2.4 * Math.max(pr.r, r));
      if (l === 'mesh') {
        // 前の歯車の「接点(右向き=角0)での歯の位相」p に対し、こちらは半歯ずらす
        var zp = W[i - 1].size, z = W[i].size;
        var p = (((-pr.a0) * zp / (2 * Math.PI)) % 1 + 1) % 1;
        a0 = Math.PI - (0.5 - p) * 2 * Math.PI / z;
      }
    }
    pos.push({ x: x, y: 0, r: r, a0: a0, layer: layer, g: sol.wheels[i].g });
  }
  return pos;
}

/* ---------- 四節リンク ----------
   固定節 d: 原点O2=(0,0) 〜 O4=(d,0)。クランク(入力) a、連結棒 b、てこ(出力) c。
   座標は数学の向き(上が+y)。theta はクランクの角度 */
function fourBar(a, b, c, d, theta, prevB) {
  var A = { x: a * Math.cos(theta), y: a * Math.sin(theta) };
  if (Math.abs(a - c) < 1e-9 && Math.abs(b - d) < 1e-9) {
    var Bp = { x: A.x + d, y: A.y };         // 平行クランク: 平行四辺形のまま
    return { ok: true, A: A, B: Bp, phi: Math.atan2(Bp.y, Bp.x - d) };
  }
  var dx = d - A.x, dy = -A.y, e = Math.hypot(dx, dy);
  if (e > b + c + 1e-9 || e < Math.abs(b - c) - 1e-9 || e < 1e-9) return { ok: false, A: A };
  var k = (b * b - c * c + e * e) / (2 * e), h2 = b * b - k * k, h = Math.sqrt(Math.max(0, h2));
  var mx = A.x + dx * k / e, my = A.y + dy * k / e;
  var B1 = { x: mx - dy * h / e, y: my + dx * h / e }, B2 = { x: mx + dy * h / e, y: my - dx * h / e };
  var B;
  if (prevB) B = Math.hypot(B1.x - prevB.x, B1.y - prevB.y) <= Math.hypot(B2.x - prevB.x, B2.y - prevB.y) ? B1 : B2;
  else B = B1.y >= B2.y ? B1 : B2;           // はじめは上側(開いた形)
  return { ok: true, A: A, B: B, phi: Math.atan2(B.y, B.x - d) };
}
/* グラスホフの条件で種類を判定
   a: クランク(入力) b: 連結棒 c: てこ(出力) d: 固定リンク
   最短+最長 < 残り2本の和 のとき、いちばん短い棒が固定リンクのとなり(a か c)にあれば、その棒が1回転できる。
   いちばん短いのが固定リンク d なら両方が1回転、連結棒 b なら どちらも1回転できない。
   shortest: いちばん短い棒('a'|'b'|'c'|'d')。full: 入力が1回転できるか。outFull: 出力が1回転できるか */
function linkType(a, b, c, d) {
  if (Math.abs(a - c) < 1e-9 && Math.abs(b - d) < 1e-9) return { id: 'parallel', name: '平行クランク機構', full: true, outFull: true, shortest: null, note: '向かい合う棒が同じ長さで、平行四辺形のまま動く' };
  var arr = [a, b, c, d], s = Math.min.apply(null, arr), l = Math.max.apply(null, arr), pq = a + b + c + d - s - l;
  var sh = d === s ? 'd' : (a === s ? 'a' : (c === s ? 'c' : 'b'));
  if (s + l > pq + 1e-9) return { id: 'rocker2', name: '両てこ機構', full: false, outFull: false, shortest: sh, note: '最短+最長が残り2本の和より長いので、どの棒も1回転できない' };
  if (s + l > pq - 1e-9) return { id: 'change', name: '変化点のあるリンク機構', full: false, outFull: false, shortest: sh, note: '最短+最長が残り2本の和と同じなので、棒が一直線にそろう所(変化点)で動く向きが決まらなくなる' };
  if (sh === 'd') return { id: 'crank2', name: '両クランク機構', full: true, outFull: true, shortest: sh, note: 'いちばん短いのが固定リンクなので、クランクもてこも1回転できる' };
  if (sh === 'a') return { id: 'crankrocker', name: 'てこクランク機構', full: true, outFull: false, shortest: sh, note: 'いちばん短いクランクが固定リンクのとなりにあるので、クランクが1回転し、てこは往復する' };
  if (sh === 'c') return { id: 'rockercrank', name: 'てこクランク機構(出力側が回る)', full: false, outFull: true, shortest: sh, note: 'いちばん短いのは出力側の棒。入力の棒は1回転できずに往復し、出力側が1回転する(足踏みミシンと同じ)' };
  return { id: 'rocker2', name: '両てこ機構', full: false, outFull: false, shortest: sh, note: 'いちばん短いのは連結棒で、固定リンクのとなりにないので、クランクもてこも1回転できない' };
}
/* クランクを1周動かして、てこの振れ角などを調べる */
function fourBarSweep(a, b, c, d) {
  // 動ける角度の区間の始まりから1周たどる(区間が0°をまたいでもよい)
  var valid = [], i, st = 0;
  for (i = 0; i < 360; i++) valid.push(fourBar(a, b, c, d, i * Math.PI / 180).ok);
  var okN = valid.filter(Boolean).length;
  if (!okN) return { full: false, okDeg: 0, swing: 0, outFull: false, tmin: null, tmax: null };
  if (okN < 360) { for (i = 0; i < 360; i++) if (valid[i] && !valid[(i + 359) % 360]) { st = i; break; } }
  var prev = null, last = null, unwrap = 0, mn = 0, mx = 0, n = 0;
  for (i = 0; i <= 360; i++) {
    var deg = st + i, r = fourBar(a, b, c, d, deg * Math.PI / 180, prev);
    if (!r.ok) break;
    n++; prev = r.B;
    if (last !== null) { var dp = r.phi - last; if (dp > Math.PI) dp -= 2 * Math.PI; if (dp < -Math.PI) dp += 2 * Math.PI; unwrap += dp; mn = Math.min(mn, unwrap); mx = Math.max(mx, unwrap); }
    last = r.phi;
  }
  var sw = mx - mn, lt = linkType(a, b, c, d);
  // 出力側がいちばん短い(てこクランクを逆に使う形)ときは、入力が往復するあいだに出力側が1回転する
  var outFull = (okN === 360 && Math.abs(unwrap) > 2 * Math.PI - 0.05) || lt.id === 'rockercrank';
  return { full: okN === 360, okDeg: Math.max(0, n - 1), swing: outFull ? 360 : sw * 180 / Math.PI, outFull: outFull, change: lt.id === 'change', tmin: okN < 360 ? st : 0, tmax: okN < 360 ? (st + n - 1) % 360 : 360 };
}

/* ---------- スライダクランク ---------- */
function sliderX(r, l, theta) { return r * Math.cos(theta) + Math.sqrt(Math.max(0, l * l - Math.pow(r * Math.sin(theta), 2))); }

/* ---------- カム ----------
   形を極座標の多角形で返す(回転中心が原点、数学の向き) */
var CAMS = {
  ecc:   { name: '偏心円カム', bumps: 1, desc: '円の中心をずらして付けたカム。なめらかに上下する。' },
  egg:   { name: '卵形カム', bumps: 1, desc: '一部だけ出っぱった板カム。しばらく止まってから、ぐっと上がる。' },
  heart: { name: 'ハート形カム', bumps: 1, desc: '一定の速さで上がって、一定の速さで下がる。ミシンの糸巻きなどに使う。' },
  two:   { name: '2山カム', bumps: 2, desc: '山が2つ。1回転で2往復する。' }
};
function camPoly(type, h, base) {
  base = base || 30; var pts = [], N = 180;
  for (var i = 0; i < N; i++) {
    var f = i / N * 2 * Math.PI, r;
    if (type === 'ecc') { var e = h / 2, R = base + e; pts.push({ x: e + R * Math.cos(f), y: R * Math.sin(f) }); continue; }
    if (type === 'egg') { var c = Math.cos(f); r = base + h * (c > 0 ? Math.pow(c, 2.2) : 0); }
    else if (type === 'heart') { var ang = Math.abs(((f + Math.PI) % (2 * Math.PI)) - Math.PI); r = base + h * (1 - ang / Math.PI); }
    else r = base + h * (1 + Math.cos(2 * f)) / 2;
    pts.push({ x: r * Math.cos(f), y: r * Math.sin(f) });
  }
  return pts;
}
/* 回転角 theta(時計回りを+) のときの、真上にある先のとがった従動節の高さ */
function camLift(poly, theta) {
  var c = Math.cos(-theta), s = Math.sin(-theta), best = -Infinity, n = poly.length;
  for (var i = 0; i < n; i++) {
    var p = poly[i], q = poly[(i + 1) % n];
    var x1 = p.x * c - p.y * s, y1 = p.x * s + p.y * c, x2 = q.x * c - q.y * s, y2 = q.x * s + q.y * c;
    if ((x1 <= 0 && x2 >= 0) || (x1 >= 0 && x2 <= 0)) {
      var t = x1 === x2 ? 0 : x1 / (x1 - x2), y = y1 + (y2 - y1) * t;
      if (y > best) best = y;
    }
  }
  return best;
}
function camStroke(poly) {
  var mn = Infinity, mx = -Infinity;
  for (var i = 0; i < 360; i += 2) { var y = camLift(poly, i * Math.PI / 180); mn = Math.min(mn, y); mx = Math.max(mx, y); }
  return { min: mn, max: mx, stroke: mx - mn };
}

/* ---------- ラックとピニオン・ねじ ---------- */
var RACK_PITCH = 5;                                   // 歯の間隔 mm
function rackPerTurn(z) { return z * RACK_PITCH; }    // 1回転で進む距離 mm
function screwLead(p, n) { return p * n; }            // リード = ピッチ × 条数

/* 速度伝達比を中学生向けの文に */
function ratioText(ratio) {
  if (Math.abs(ratio - 1) < 1e-6) return '同じ速さ';
  if (ratio > 1) return '1/' + fmt(ratio) + ' に減速';
  return fmt(1 / ratio) + ' 倍に増速';
}
function fmt(x, d) {
  if (!isFinite(x)) return '−';
  var r = round(x, d == null ? 2 : d);
  return String(r);
}

NS.Mech = {
  PARTS: PARTS, LINKS: LINKS, CAMS: CAMS, RACK_PITCH: RACK_PITCH,
  checkTrain: checkTrain, solveTrain: solveTrain, layoutTrain: layoutTrain, wheelR: wheelR,
  fourBar: fourBar, linkType: linkType, fourBarSweep: fourBarSweep,
  sliderX: sliderX, camPoly: camPoly, camLift: camLift, camStroke: camStroke,
  rackPerTurn: rackPerTurn, screwLead: screwLead, ratioText: ratioText, fmt: fmt, gcd: gcd, round: round
};
})();
