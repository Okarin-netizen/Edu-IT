/*
 * packing.js — 木取りの計算(衝突判定・歩留まり・配置の案)
 * ブラウザでは window.Kidori、Node では require('./packing.js')。
 * 座標: 板の左上を原点、x は板の長さ方向(木目の方向)、y は板の幅方向(画面の下向き)。単位 mm。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Kidori = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 部品の個数分の「実体」を作る。id は 部品id#番号
  function expand(parts) {
    var out = [];
    (parts || []).forEach(function (p) {
      var q = Math.max(0, Math.min(99, Math.floor(p.qty || 0)));
      for (var k = 0; k < q; k++) {
        out.push({ iid: p.id + '#' + (k + 1), partId: p.id, name: p.name, l: p.l, w: p.w, grain: !!p.grain, no: k + 1, qty: q });
      }
    });
    return out;
  }

  // 置いた向きでの板上の大きさ(rot=90 で長さと幅が入れかわる)
  function dims(inst, rot) { return rot ? { dx: inst.w, dy: inst.l } : { dx: inst.l, dy: inst.w }; }

  // 板からはみ出していないか
  function inside(r, stock) {
    var e = 1e-6;
    return r.x >= -e && r.y >= -e && r.x + r.dx <= stock.l + e && r.y + r.dy <= stock.w + e;
  }
  // 2つの部品の間が切りしろ(kerf)より狭いと重なりとみなす
  function conflict(a, b, kerf) {
    var e = 1e-6;
    return a.board === b.board &&
      a.x < b.x + b.dx + kerf - e && b.x < a.x + a.dx + kerf - e &&
      a.y < b.y + b.dy + kerf - e && b.y < a.y + a.dy + kerf - e;
  }

  // 板の上に置かれた矩形の一覧を作る: [{iid, board, x, y, dx, dy, rot, inst}]
  function rects(instances, placements) {
    var out = [];
    instances.forEach(function (inst) {
      var p = placements[inst.iid];
      if (!p) return;
      var d = dims(inst, p.rot);
      out.push({ iid: inst.iid, board: p.board, x: p.x, y: p.y, dx: d.dx, dy: d.dy, rot: p.rot ? 90 : 0, inst: inst });
    });
    return out;
  }

  // 問題点を調べる: { bad: {iid: ['重なり'|'はみ出し'|'木目']}, ok: bool }
  function check(instances, placements, stock, kerf) {
    var rs = rects(instances, placements), bad = {};
    function mark(id, why) { (bad[id] = bad[id] || []).indexOf(why) < 0 && bad[id].push(why); }
    rs.forEach(function (r, i) {
      if (!inside(r, stock) || r.board < 0 || r.board >= stock.count) mark(r.iid, 'はみ出し');
      if (r.inst.grain && r.rot) mark(r.iid, '木目');
      for (var j = i + 1; j < rs.length; j++) {
        if (conflict(r, rs[j], kerf)) { mark(r.iid, '重なり'); mark(rs[j].iid, '重なり'); }
      }
    });
    return { bad: bad, ok: Object.keys(bad).length === 0, rects: rs };
  }

  // 歩留まりなどの集計
  function stats(instances, placements, stock, kerf) {
    var rs = rects(instances, placements);
    var perBoard = [];
    for (var b = 0; b < stock.count; b++) perBoard.push({ board: b, used: 0, maxX: 0, maxY: 0, n: 0 });
    var placedArea = 0;
    rs.forEach(function (r) {
      var pb = perBoard[r.board];
      if (!pb) return;
      var a = r.dx * r.dy;
      pb.used += a; pb.n++; placedArea += a;
      pb.maxX = Math.max(pb.maxX, r.x + r.dx);
      pb.maxY = Math.max(pb.maxY, r.y + r.dy);
    });
    var boardArea = stock.l * stock.w;
    var usedBoards = perBoard.filter(function (p) { return p.n > 0; }).length;
    perBoard.forEach(function (p) {
      p.yield = boardArea > 0 ? p.used / boardArea : 0;
      // 右はしの残り(長さ方向に切り落とせる残材)
      p.restL = p.n ? Math.max(0, stock.l - p.maxX - kerf) : stock.l;
    });
    var totalArea = instances.reduce(function (s, i) { return s + i.l * i.w; }, 0);
    return {
      placed: rs.length, total: instances.length, unplaced: instances.length - rs.length,
      placedArea: placedArea, totalArea: totalArea, usedBoards: usedBoards,
      yield: usedBoards ? placedArea / (boardArea * usedBoards) : 0,
      perBoard: perBoard,
      // 面積だけから見た最低限の枚数(実際はこれより多くなることが多い)
      minBoardsByArea: boardArea > 0 ? Math.ceil(totalArea / boardArea) : 0
    };
  }

  // 1つの部品を、今の配置に重ならない「左下の空き」に置く場所を探す
  // 返り値: {board, x, y, rot} または null
  function findSpot(inst, placements, instances, stock, kerf, opts) {
    opts = opts || {};
    var rs = rects(instances, placements).filter(function (r) { return r.iid !== inst.iid; });
    var rots = inst.grain ? [0] : opts.preferRot ? [1, 0] : [0, 1];
    var boards = [];
    for (var b = 0; b < stock.count; b++) boards.push(b);
    if (opts.board !== undefined) boards = [opts.board].concat(boards.filter(function (x) { return x !== opts.board; }));
    for (var bi = 0; bi < boards.length; bi++) {
      var board = boards[bi];
      var mine = rs.filter(function (r) { return r.board === board; });
      var xs = [0], ys = [0];
      mine.forEach(function (r) { xs.push(r.x + r.dx + kerf); ys.push(r.y + r.dy + kerf); });
      xs.sort(function (a, b) { return a - b; });
      ys.sort(function (a, b) { return a - b; });
      var best = null;
      rots.forEach(function (rot) {
        var d = dims(inst, rot);
        for (var i = 0; i < xs.length; i++) {
          for (var j = 0; j < ys.length; j++) {
            var c = { board: board, x: xs[i], y: ys[j], dx: d.dx, dy: d.dy };
            if (!inside(c, stock)) continue;
            var hit = false;
            for (var k = 0; k < mine.length; k++) if (conflict(c, mine[k], kerf)) { hit = true; break; }
            if (hit) continue;
            if (!best || c.x < best.x - 1e-9 || (Math.abs(c.x - best.x) < 1e-9 && c.y < best.y)) best = { board: board, x: c.x, y: c.y, rot: rot };
          }
        }
      });
      if (best) return best;
    }
    return null;
  }

  /*
   * 配置の案(ギロチン法: のこぎりで端から端まで切っていける並べ方)
   * 面積の大きい順に、空き領域の中で最もぴったり合う場所へ置く。
   * maxBoards まで板を増やして全部置けるか試す。
   * 返り値: { placements, boardsUsed, unplaced:[iid...] }
   */
  function guillotine(instances, stock, kerf, maxBoards) {
    maxBoards = Math.max(1, maxBoards || stock.count || 1);
    var order = instances.slice().sort(function (a, b) {
      return b.l * b.w - a.l * a.w || Math.max(b.l, b.w) - Math.max(a.l, a.w) || (a.iid < b.iid ? -1 : 1);
    });
    var free = [], placements = {}, unplaced = [], boardsOpen = 0;
    function openBoard() { free.push({ board: boardsOpen, x: 0, y: 0, w: stock.l, h: stock.w }); boardsOpen++; }
    openBoard();
    order.forEach(function (inst) {
      var rots = inst.grain ? [0] : [0, 1];
      for (;;) {
        var best = null;
        free.forEach(function (f, fi) {
          rots.forEach(function (rot) {
            var d = dims(inst, rot);
            if (d.dx > f.w + 1e-9 || d.dy > f.h + 1e-9) return;
            // 余りの短い辺が小さいほど良い。同じなら板の番号が小さい方、x が小さい方
            var score = Math.min(f.w - d.dx, f.h - d.dy);
            var key = [f.board, score, f.x, f.y];
            if (!best || less(key, best.key)) best = { fi: fi, rot: rot, d: d, key: key };
          });
        });
        if (best) {
          var f = free[best.fi], d = best.d;
          placements[inst.iid] = { board: f.board, x: f.x, y: f.y, rot: best.rot };
          free.splice(best.fi, 1);
          // 2通りの分け方のうち、大きい空きが残る方を選ぶ
          var rw = f.w - d.dx - kerf, th = f.h - d.dy - kerf;
          var a1 = [{ x: f.x + d.dx + kerf, y: f.y, w: rw, h: d.dy }, { x: f.x, y: f.y + d.dy + kerf, w: f.w, h: th }];
          var a2 = [{ x: f.x + d.dx + kerf, y: f.y, w: rw, h: f.h }, { x: f.x, y: f.y + d.dy + kerf, w: d.dx, h: th }];
          var m1 = Math.max(area(a1[0]), area(a1[1])), m2 = Math.max(area(a2[0]), area(a2[1]));
          (m1 >= m2 ? a1 : a2).forEach(function (r) {
            if (r.w > 0 && r.h > 0) { r.board = f.board; free.push(r); }
          });
          return;
        }
        if (boardsOpen < maxBoards) { openBoard(); continue; }
        unplaced.push(inst.iid);
        return;
      }
    });
    var used = {};
    Object.keys(placements).forEach(function (k) { used[placements[k].board] = 1; });
    return { placements: placements, boardsUsed: Object.keys(used).length, unplaced: unplaced };
  }
  function area(r) { return r.w > 0 && r.h > 0 ? r.w * r.h : 0; }
  function less(a, b) { for (var i = 0; i < a.length; i++) { if (a[i] < b[i] - 1e-9) return true; if (a[i] > b[i] + 1e-9) return false; } return false; }

  // 部品が板にそもそも入るか(回転を考えても)
  function fitsStock(part, stock) {
    if (part.l <= stock.l && part.w <= stock.w) return true;
    return !part.grain && part.w <= stock.l && part.l <= stock.w;
  }

  return { expand: expand, dims: dims, inside: inside, conflict: conflict, rects: rects, check: check, stats: stats, findSpot: findSpot, guillotine: guillotine, fitsStock: fitsStock };
});
