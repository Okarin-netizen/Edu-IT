#!/usr/bin/env node
/*
 * 撮影の道具: 生徒に配る統一版を開き、メニューと全教材を PC とスマホのはばで撮る。
 * 見た目を直す前と後を見くらべるために使う(見た目の設定をそろえる計画 4-5)。
 *
 * 使い方:
 *   node shared/tools/shots.js <出す先のフォルダ>              # 全分野
 *   node shared/tools/shots.js <出す先のフォルダ> A C          # 分野をえらぶ(A B C D G T M F Z)
 *   node shared/tools/shots.js <出す先のフォルダ> --pc          # PC だけ(--sp でスマホだけ)
 *
 * できるファイル(PC は _PC、スマホは _SP):
 *   メニューのある分野(A B C D): menu_A_PC.png と、各教材の開いた画面 A1_PC.png・2つ目のタブを開いた画面 A1_b_PC.png(タブがあるときだけ)
 *   メニューのない1枚の教材(G T M F Z): G_PC.png と G_b_PC.png
 *
 * しくみ: メニューのカード(.ef-mcard[data-code])を基本編・発展編の順に集め、
 * 1枚ずつ「ページを開き直す → カードを押す → 撮る」をくりかえす(前の教材の状態が残らないように)。
 * A はメニューと教材が iframe の中、D は教材が iframe の中にあるので、どの部品も全部のフレームから探す。
 * Playwright が必要(この環境では require('playwright') で使える)。
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const DIST = path.join(ROOT, 'クラスルーム配布', '生徒に配る');
const AREAS = {
  G: 'G_技術分野のガイダンス.html',
  T: '教科書の順に進む_学習コース.html',
  A: 'A_材料と加工_統一版.html',
  B: 'B_生物育成_統一版.html',
  C: 'C_エネルギー変換_統一版.html',
  D: 'D_情報の技術_統一版.html',
  M: 'M_身の回りの技術さがし.html',
  F: 'F_これからの技術ラボ.html',
  Z: 'Z_学習を終えて.html',
};
const SIZES = { PC: { width: 1280, height: 800 }, SP: { width: 390, height: 844 } };
// アプリの中のタブ(段 2 で .ef-apptab にそろえるまでは、分野ごとに名前がちがう)
const TAB = ['.ef-apptab', '[role=tablist] [role=tab]', '.chapter-nav a', '.chapter-nav button', '[class*="-tabs"] > button', '[class*="-tabs"] > a'].join(', ');

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith('-') && !AREAS[a]);
if (!out) { console.error('使い方: node shared/tools/shots.js <出す先のフォルダ> [A B C D G T M F Z] [--pc|--sp]'); process.exit(1); }
const areas = args.filter((a) => AREAS[a]);
const sizes = Object.keys(SIZES).filter((k) => !(args.includes('--pc') && k === 'SP') && !(args.includes('--sp') && k === 'PC'));
fs.mkdirSync(out, { recursive: true });

const wait = (pg, ms) => pg.waitForTimeout(ms);

// すべてのフレーム(ページと iframe)から、見えている部品を探す
async function find(pg, sel) {
  for (const f of pg.frames()) {
    const l = f.locator(sel).filter({ visible: true });
    if (await l.count().catch(() => 0)) return l;
  }
  return null;
}

// メニューを開いて、教材のカードの記号を集める(基本編 → 発展編、同じ記号は1回)
async function cardCodes(pg) {
  const codes = [];
  const levelTabs = await find(pg, '.ef-level-tab');
  const n = levelTabs ? await levelTabs.count() : 0;
  for (let i = 0; i < Math.max(n, 1); i++) {
    if (n) { await levelTabs.nth(i).click(); await wait(pg, 200); }
    const cards = await find(pg, '.ef-mcard[data-code]');
    for (const c of cards ? await cards.evaluateAll((els) => els.map((e) => e.dataset.code)) : []) {
      if (!codes.includes(c)) codes.push(c);
    }
  }
  return codes;
}

async function openCard(pg, code) {
  const levelTabs = await find(pg, '.ef-level-tab');
  for (let i = 0; i < (levelTabs ? await levelTabs.count() : 1); i++) {
    if (levelTabs) { await levelTabs.nth(i).click(); await wait(pg, 150); }
    const go = await find(pg, `.ef-mcard[data-code="${code}"] .ef-mcard-go`);
    if (go) { await go.first().click(); return true; }
  }
  return false;
}

// 開いた教材の中の2つ目のタブ
async function secondTab(pg) {
  const tabs = await find(pg, TAB);
  if (!tabs || (await tabs.count()) < 2) return false;
  await tabs.nth(1).click().catch(() => {});
  return true;
}

async function overflow(pg, name) {
  const over = await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (over > 1) console.warn(`  ${name}: スマホで横に ${over}px はみ出している`);
}

async function shoot(browser, area, size) {
  const url = 'file://' + path.join(DIST, AREAS[area]);
  const ctx = await browser.newContext({ viewport: SIZES[size] });
  const pg = await ctx.newPage();
  const fresh = async () => {
    await pg.goto(url); await wait(pg, 800);
    await pg.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await pg.goto(url); await wait(pg, 800);
  };
  await fresh();
  const codes = await cardCodes(pg);
  if (!codes.length) {
    // メニューのない1枚の教材
    await pg.screenshot({ path: path.join(out, `${area}_${size}.png`) });
    if (size === 'SP') await overflow(pg, area);
    if (await secondTab(pg)) { await wait(pg, 600); await pg.screenshot({ path: path.join(out, `${area}_b_${size}.png`) }); }
    await ctx.close();
    return [area];
  }
  await fresh();
  await pg.screenshot({ path: path.join(out, `menu_${area}_${size}.png`) });
  for (const code of codes) {
    await fresh();
    if (!(await openCard(pg, code))) { console.warn(`  ${code}: カードが見つからない`); continue; }
    await wait(pg, 1200);
    // はじめて開いたときに出る説明の画面・自習ガイドは閉じる
    await pg.keyboard.press('Escape').catch(() => {});
    await wait(pg, 200);
    await pg.screenshot({ path: path.join(out, `${code}_${size}.png`) });
    if (size === 'SP') await overflow(pg, code);
    if (await secondTab(pg)) {
      await wait(pg, 600);
      await pg.screenshot({ path: path.join(out, `${code}_b_${size}.png`) });
    }
  }
  await ctx.close();
  return codes;
}

(async () => {
  const browser = await chromium.launch();
  for (const area of areas.length ? areas : Object.keys(AREAS)) {
    for (const size of sizes) {
      const codes = await shoot(browser, area, size);
      console.log(`${area} ${size}: ${codes.length > 1 || codes[0] !== area ? `メニューと ${codes.length} 教材(${codes.join(' ')})` : '1枚の教材'}`);
    }
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
