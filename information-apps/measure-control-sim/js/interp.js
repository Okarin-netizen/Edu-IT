// インタプリタ: プログラムの木を1文ずつ実行する（ジェネレータで、いつでも止められる）
// yield するもの:
//   { kind: "stmt", id }      … これから実行する文（ステップ実行で光らせる）
//   { kind: "wait", secs }    … 待つ（シミュレーションの時間が進むまで止まる）
//   { kind: "loopStart", id } … くり返しの始まり
//   { kind: "loop", id, tick } … くり返しの1周の終わり（tick: true なら、1周に時間がかかっていないとき0.1秒進める）
import { evalExpr, truthy, LangError } from "./lang.js";

export function* execute(program, ctx) {
  yield* block(program, ctx);
}

function* block(list, ctx) {
  for (const n of list) yield* stmt(n, ctx);
}

function val(e, ctx, n) {
  try {
    return evalExpr(e, ctx.get);
  } catch (err) {
    if (err instanceof LangError) throw new LangError(err.plain, n.line);
    throw err;
  }
}

function* stmt(n, ctx) {
  if (n.type === "comment") return;
  yield { kind: "stmt", id: n.id };
  switch (n.type) {
    case "assign":
      ctx.set(n.name, val(n.value, ctx, n), n);
      return;
    case "wait": {
      const s = Number(val(n.secs, ctx, n));
      if (!(s >= 0)) throw new LangError("待つ時間は0以上の数にします", n.line);
      if (s > 0) yield { kind: "wait", secs: s };
      return;
    }
    case "if":
      if (truthy(val(n.cond, ctx, n))) yield* block(n.then, ctx);
      else if (n.else) yield* block(n.else, ctx);
      return;
    case "forever":
      yield { kind: "loopStart", id: n.id };
      for (;;) {
        yield* block(n.body, ctx);
        yield { kind: "loop", id: n.id, tick: true };
      }
    case "while":
      yield { kind: "loopStart", id: n.id };
      while (truthy(val(n.cond, ctx, n))) {
        yield* block(n.body, ctx);
        yield { kind: "loop", id: n.id, tick: true };
        yield { kind: "stmt", id: n.id };
      }
      return;
    case "repeat": {
      const count = Math.floor(Number(val(n.count, ctx, n)));
      if (!(count >= 0)) throw new LangError("くり返す回数は0以上の数にします", n.line);
      if (count > 100000) throw new LangError("くり返す回数が多すぎます（10万回まで）", n.line);
      for (let i = 0; i < count; i++) {
        yield* block(n.body, ctx);
        yield { kind: "loop", id: n.id, tick: false };
      }
      return;
    }
  }
}
