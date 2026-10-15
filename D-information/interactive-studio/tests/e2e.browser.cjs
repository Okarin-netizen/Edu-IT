// ブラウザでの自動テスト（npm i -D playwright のあと、npm run build してから node tests/e2e.browser.cjs）
const { chromium } = require('playwright');
const fs = require('fs');
const URL = 'file://' + require('path').join(__dirname, '../dist/interactive-studio.html');
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = []; const reqs = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  ctx.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) reqs.push(r.url()); });
  page.on('dialog', d => d.accept());
  await page.goto(URL);
  // --- quiz sample
  await page.click('button.sample:has-text("3問クイズ")');
  await page.waitForSelector('.workspace .block');
  ok((await page.$$('.workspace .block')).length > 10, 'quiz blocks rendered');
  await page.click('#chapter-nav a[href="#/run"]');
  await page.click('.run-controls .btn >> nth=0');
  await page.click('.prompt-choices .choice:has-text("富士山")');
  await page.fill('.prompt-input', '８');
  await page.press('.prompt-input', 'Enter');
  await page.click('.prompt-choices .choice:has-text("長くて")');
  await page.waitForTimeout(200);
  const out = await page.textContent('.stage-output');
  ok(out.includes('3 / 3 点') && out.includes('全問正解'), 'quiz full score with full-width digit: ' + out.slice(-40));
  // --- editor: palette insert + field edit + code edit
  await page.click('#chapter-nav a[href="#/works"]');
  await page.click('button.sample:has-text("空の作品")');
  await page.waitForSelector('.workspace .block');
  await page.click('.pal-item:has-text("回数くり返す")');
  await page.click('.pal-item:has-text("表示する")'); // goes into repeat body
  let code = await page.inputValue('.code-input');
  ok(/repeat \(3\) \{\n  show\("こんにちは"\);\n\}/.test(code), 'palette insert into repeat body');
  const inp = page.locator('.workspace .block.cat-io .slot input').last();
  await inp.fill('やあ');
  code = await page.inputValue('.code-input');
  ok(code.includes('show("やあ");'), 'text slot edit updates code');
  await page.fill('.code-input', 'let n = 5;\nif (n > 3) {\n  show("大きい");\n}\n');
  await page.waitForTimeout(500);
  ok((await page.$$('.workspace .block.cat-ctrl')).length === 1, 'code edit updates blocks');
  await page.fill('.code-input', 'show(（1);\n');
  await page.waitForTimeout(500);
  const banner = await page.textContent('.explain.warn');
  ok(banner.includes('全角'), 'fullwidth error banner: ' + banner);
  await page.click('button:has-text("元に戻す")');
  code = await page.inputValue('.code-input');
  ok(code.includes('大きい'), 'undo restores');
  // drag: move the show block out of if, to the very top gap
  const handle = page.locator('.workspace .block.cat-io .handle').first();
  const hb = await handle.boundingBox();
  const topGap = await page.locator('.workspace > .gap').first().boundingBox();
  await page.mouse.move(hb.x + 5, hb.y + 5); await page.mouse.down();
  await page.mouse.move(hb.x + 20, hb.y - 20, { steps: 4 });
  await page.mouse.move(topGap.x + 30, topGap.y + topGap.height / 2, { steps: 6 });
  await page.mouse.up();
  code = await page.inputValue('.code-input');
  ok(code.startsWith('show("大きい");'), 'drag moved block to top: ' + JSON.stringify(code.slice(0, 30)));
  // --- infinite loop safety
  await page.fill('.code-input', 'let i = 0;\nwhile (true) {\n  i += 1;\n}\n');
  await page.waitForTimeout(500);
  await page.click('#chapter-nav a[href="#/run"]');
  const t0 = Date.now();
  await page.click('.run-controls .btn >> nth=0');
  await page.waitForTimeout(800);
  const responsive = await page.evaluate(() => { const t = performance.now(); return new Promise(r => setTimeout(() => r(performance.now() - t), 0)); });
  ok(responsive < 200, 'UI responsive during infinite loop (' + Math.round(responsive) + 'ms)');
  await page.waitForSelector('.error-box:not([hidden])', { timeout: 8000 });
  ok(Date.now() - t0 < 7000 && (await page.textContent('.error-box')).includes('無限ループ'), 'infinite loop stopped with message: ' + (await page.textContent('.error-box')).slice(0, 60));
  // huge output
  await page.click('#chapter-nav a[href="#/editor"]');
  await page.fill('.code-input', 'let s = "x";\nrepeat (30) {\n  s = s + s;\n}\n');
  await page.waitForTimeout(500);
  await page.click('#chapter-nav a[href="#/run"]');
  await page.click('.run-controls .btn >> nth=0');
  await page.waitForSelector('.error-box:not([hidden])', { timeout: 8000 });
  ok((await page.textContent('.error-box')).includes('長くなりすぎ'), 'huge string limited');
  await page.click('#chapter-nav a[href="#/editor"]');
  await page.fill('.code-input', 'repeat (5000) {\n  show("line");\n}\nshow("end");\n');
  await page.waitForTimeout(500);
  await page.click('#chapter-nav a[href="#/run"]');
  await page.click('.run-controls .btn >> nth=0');
  await page.waitForFunction(() => document.querySelector('.run-status').textContent.includes('最後まで'), null, { timeout: 8000 });
  ok((await page.$$('.stage-output .out-line')).length <= 302, 'output capped at 300 lines');
  // --- debug sample
  await page.click('#chapter-nav a[href="#/works"]');
  await page.click('button.sample:has-text("バグを直そう")');
  await page.click('#chapter-nav a[href="#/debug"]');
  await page.click('button:has-text("1つずつ実行")');
  await page.waitForTimeout(100);
  ok((await page.textContent('.debug-status')).includes('3行目'), 'step starts paused at line 3: ' + await page.textContent('.debug-status'));
  for (let k = 0; k < 4; k++) await page.click('button:has-text("1つ進む")');
  const watch = await page.textContent('table.watch');
  ok(watch.includes('total') && watch.includes('i'), 'watch shows vars: ' + watch.replace(/\s+/g, ' ').slice(0, 80));
  await page.click('button:has-text("続ける")');
  await page.waitForSelector('.error-box:not([hidden])');
  const err = await page.textContent('.error-box');
  ok(err.includes('9行目') && err.includes('total'), 'bug error with suggestion: ' + err.slice(0, 80));
  // breakpoint
  await page.click('.listing .bp >> nth=5');
  await page.click('.debug-controls button:has-text("▶ 実行")');
  await page.waitForTimeout(150);
  ok((await page.textContent('.debug-status')).includes('6行目'), 'breakpoint pause at 6');
  await page.click('button:has-text("■ 停止")');
  // blocks view in debug
  await page.click('.segmented .seg:has-text("ブロック")');
  await page.click('button:has-text("1つずつ実行")');
  await page.waitForTimeout(100);
  ok((await page.$$('.workspace.readonly .block-head.running')).length === 1, 'debug block highlight');
  await page.click('button:has-text("■ 停止")');
  await page.click('.segmented .seg:has-text("コード")');
  // IS-12: 2つのボタンの印がちがう
  ok(!(await page.textContent('.debug-controls button:has-text("1つ進む")')).includes('⏭'), 'step button has its own mark');
  // IS-17: デバッグの下の「つぎはこれ」
  const dnext = await page.textContent('.next-here');
  ok(dnext.includes('友だちに使ってもらい') && await page.$('.next-here a.btn[href="#/server"]') && await page.$('.next-here a.btn[href="#/records"]'), 'debug next-here: ' + dnext.replace(/\s+/g, ' '));
  // IS-12: 「エディタで直す」で、9行目が選ばれて見える
  await page.click('.listing .bp >> nth=5'); // ブレークポイントを外す
  await page.click('.debug-controls button:has-text("▶ 実行")');
  await page.waitForSelector('.error-box:not([hidden])');
  await page.click('.error-box button:has-text("エディタで直す")');
  await page.waitForTimeout(150);
  const sel = await page.evaluate(() => { const t = document.activeElement; return t && t.classList.contains('code-input') ? t.value.slice(t.selectionStart, t.selectionEnd) : null; });
  ok(sel && sel.includes('totl'), 'goto line selects line 9 with focus: ' + sel);
  ok(await page.evaluate(() => { const r = document.querySelector('.code-input').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }), 'code input visible after goto line');
  ok(await page.evaluate(() => { const b = document.querySelector('.workspace .block-head.error-line'); if (!b) return false; const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }), 'error block visible after goto line');
  // IS-12: 一時停止中にコードを変えたら、実行を終わらせて知らせる
  await page.click('#chapter-nav a[href="#/debug"]');
  await page.click('button:has-text("1つずつ実行")');
  await page.waitForTimeout(100);
  await page.click('#chapter-nav a[href="#/editor"]');
  await page.fill('.code-input', 'let a = 1;\n' + (await page.inputValue('.code-input')));
  await page.waitForTimeout(500);
  await page.click('#chapter-nav a[href="#/debug"]');
  await page.waitForTimeout(100);
  ok((await page.textContent('.debug-status')).includes('コードが変わったので'), 'stale pause ended: ' + await page.textContent('.debug-status'));
  ok((await page.$$('.listing li.now')).length === 0 && await page.isDisabled('button:has-text("1つ進む")'), 'no stale yellow line');
  await page.click('button:has-text("1つずつ実行")');
  await page.waitForTimeout(100);
  ok((await page.textContent('.debug-status')).includes('1行目'), 'restart after change: ' + await page.textContent('.debug-status'));
  await page.click('button:has-text("■ 停止")');
  // --- survey + server
  await page.click('#chapter-nav a[href="#/works"]');
  await page.click('button.sample:has-text("アンケート集計")');
  await page.click('#chapter-nav a[href="#/run"]');
  for (const a of ['毎日', 'ときどき', '毎日']) {
    await page.click('.run-controls .btn >> nth=0');
    await page.click(`.prompt-choices .choice:has-text("${a}")`);
    await page.waitForFunction(() => document.querySelector('.run-status').textContent.includes('最後まで'), null, { timeout: 8000 });
  }
  const sout = await page.textContent('.stage-output');
  ok(sout.includes('毎日: 2人') && sout.includes('合計: 3人'), 'survey tally');
  await page.click('#chapter-nav a[href="#/server"]'); await page.waitForTimeout(200);
  ok(await page.$('.next-here a.btn[href="#/editor"]') && await page.$('.next-here a.btn[href="#/records"]'), 'server next-here: editor + records');
  const srv = await page.textContent('#view');
  ok(srv.includes('朝ごはん') && srv.includes('3件') && srv.includes('件数を問い合わせ'), 'server tab shows box + log (Japanese op names)');
  await page.screenshot({ path: 'shot-server.png', fullPage: true });
  // --- ranking sample with parts
  await page.click('#chapter-nav a[href="#/works"]');
  await page.click('button.sample:has-text("計算チャレンジ")');
  await page.click('#chapter-nav a[href="#/run"]');
  await page.click('.run-controls .btn >> nth=0');
  await page.fill('.part-input', 'はなこ');
  await page.click('.part-button:has-text("スタート")');
  for (let k = 0; k < 5; k++) {
    await page.waitForSelector('.prompt-input');
    const q = await page.textContent('.prompt-q');
    const [x, y] = q.match(/\d+/g).map(Number);
    await page.fill('.prompt-input', String(x * y));
    await page.press('.prompt-input', 'Enter');
  }
  await page.waitForFunction(() => document.querySelector('.stage-output').textContent.includes('位'), null, { timeout: 8000 });
  ok((await page.textContent('[data-part="result"]')).includes('5 点'), 'ranking result label');
  ok((await page.textContent('.stage-output')).includes('1位 はなこ 5点'), 'ranking list');
  await page.screenshot({ path: 'shot-ranking.png', fullPage: true });
  // rename part id updates code
  const idInput = page.locator('.part-row-edit input.mono').nth(2);
  await idInput.fill('go'); await idInput.press('Tab');
  await page.waitForTimeout(100);
  await page.click('#chapter-nav a[href="#/editor"]');
  ok((await page.inputValue('.code-input')).includes('when ("go")'), 'rename part updates code');
  // --- export HTML + JSON
  await page.click('#chapter-nav a[href="#/works"]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("HTMLで書き出す")')]);
  const htmlPath = require('os').tmpdir() + '/exported.html'; await dl.saveAs(htmlPath);
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("ファイルに保存（.json）")')]);
  const jsonPath = require('os').tmpdir() + '/exported.json'; await dl2.saveAs(jsonPath);
  ok(JSON.parse(fs.readFileSync(jsonPath, 'utf8')).work.code.includes('when ("go")'), 'JSON export');
  // import json
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('button:has-text("ファイルから読み込む")')]);
  await fc.setFiles(jsonPath);
  await page.waitForTimeout(300);
  ok((await page.$$('.work-list li')).length >= 6, 'import adds work');
  const [fc2] = await Promise.all([page.waitForEvent('filechooser'), page.click('button:has-text("ファイルから読み込む")')]);
  await fc2.setFiles(htmlPath);
  await page.waitForTimeout(300);
  ok((await page.textContent('#work-title').catch(() => '')) !== null, 'import html ok');
  // player
  const p2 = await ctx.newPage();
  p2.on('pageerror', e => errors.push('player: ' + e.message));
  await p2.goto('file://' + htmlPath);
  await p2.waitForTimeout(300);
  ok((await p2.title()).includes('計算チャレンジ'), 'player title');
  await p2.fill('.part-input', 'じろう');
  await p2.click('.part-button:has-text("スタート")');
  await p2.waitForSelector('.prompt-input');
  ok(true, 'player runs and asks');
  await p2.screenshot({ path: 'shot-player.png', fullPage: true });
  // --- IS-02: 元に戻すは作品ごと（ほかの作品のコードに置きかわらない）・やり直す
  await page.click('#chapter-nav a[href="#/works"]');
  await page.click('button.sample:has-text("空の作品")');
  await page.waitForSelector('.code-input');
  await page.fill('#work-title', '').catch(() => {});
  const mine = 'let a = choose("好きな教科は？", "数学", "技術");\nshow(a);\n';
  await page.fill('.code-input', mine);
  await page.waitForTimeout(500);
  await page.click('#chapter-nav a[href="#/works"]');
  await page.fill('#work-title', 'わたしのクイズ'); await page.press('#work-title', 'Tab');
  await page.click('button.sample:has-text("3問クイズ")');
  // IS-09: 同じ見本がもうあるので「前のを開く／もう1つ作る」を選ぶ
  await page.waitForSelector('.sample-choice:not([hidden])');
  ok((await page.textContent('.sample-choice')).includes('「3問クイズ」は、作品の一覧にもうあります'), 'IS-09 duplicate sample asks open/new');
  await page.click('.sample-choice button:has-text("もう1つ作る")');
  await page.waitForSelector('.workspace .block');
  await page.click('.pal-item:has-text("表示する")');
  await page.click('#chapter-nav a[href="#/works"]');
  await page.click('.work-list li:has-text("わたしのクイズ") button:has-text("開く")');
  await page.click('#chapter-nav a[href="#/editor"]');
  ok(await page.isDisabled('button:has-text("元に戻す")'), 'IS-02 undo disabled right after opening another work');
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('元に戻す')).click());
  await page.waitForTimeout(100);
  ok(await page.inputValue('.code-input') === mine, 'IS-02 undo does not bring another work\'s code');
  await page.fill('.code-input', mine + 'show("追加");\n');
  await page.waitForTimeout(500);
  await page.click('button:has-text("元に戻す")');
  ok(await page.inputValue('.code-input') === mine, 'IS-02 undo restores own previous code');
  ok(await page.isDisabled('button:has-text("元に戻す")'), 'IS-02 nothing more to undo in this work');
  await page.click('button:has-text("やり直す")');
  ok((await page.inputValue('.code-input')).includes('show("追加");'), 'IS-02 redo re-applies the change');
  // --- IS-06: " " の付け忘れ・++ のエラーが直し方を正しく示す
  await page.fill('.code-input', 'let score = 0;\nscore++;\n');
  await page.waitForTimeout(500);
  ok((await page.textContent('.explain.warn')).includes('score += 1;'), 'IS-06 ++ banner suggests += 1');
  await page.fill('.code-input', 'show(こんにちは);\n');
  await page.waitForTimeout(500);
  await page.click('#chapter-nav a[href="#/run"]');
  await page.click('.run-controls .btn >> nth=0');
  await page.waitForSelector('.error-box:not([hidden])');
  ok((await page.textContent('.error-box')).includes('"こんにちは" のように " でかこもう'), 'IS-06 missing quotes message');
  await page.click('#chapter-nav a[href="#/editor"]');
  await page.fill('.code-input', mine);
  await page.waitForTimeout(500);
  // --- IS-10: ふりかえり・企画メモは、保存ボタンを押さずに移っても残る
  await page.click('#chapter-nav a[href="#/records"]');
  ok((await page.textContent('.reflection')).includes('書いた文は、自動でこの端末に保存されます。'), 'IS-10 autosave hint under reflection');
  ok((await page.textContent('.reflection label')).includes('サーバーとのやりとり（通信）'), 'IS-03 reflection asks about communication');
  await page.fill('#reflect-work', '選ぶだけで答えられるようにした。');
  await page.click('#chapter-nav a[href="#/editor"]'); // 0.4秒より前に移る
  await page.click('#chapter-nav a[href="#/records"]');
  ok(await page.inputValue('#reflect-work') === '選ぶだけで答えられるようにした。', 'IS-10 reflection kept after leaving the tab without saving');
  await page.fill('#reflect-work', '選ぶだけで答えられるようにした。友だちがすぐ使えた。');
  await page.waitForTimeout(700);
  ok((await page.textContent('.reflection .saved-note')).includes('保存しました'), 'IS-10 quiet saved status');
  ok((await page.textContent('table.data')).includes('友だちがすぐ使えた'), 'IS-10 autosave goes to the same record (table/export)');
  ok((await page.textContent('#view')).includes('この端末にも残るので'), 'IS-14 name note matches reality');
  await page.click('#chapter-nav a[href="#/works"]');
  ok((await page.textContent('.plan')).includes('書いた文は、自動でこの端末に保存されます。'), 'IS-10 autosave hint under plan memo');
  await page.click('.plan summary').catch(() => {});
  if (!(await page.isVisible('#plan-who'))) await page.click('.plan summary');
  await page.fill('#plan-who', 'クラスの友だち');
  await page.click('#chapter-nav a[href="#/records"]');
  ok((await page.textContent('table.data')).includes('クラスの友だち'), 'IS-10 plan memo saved when leaving the tab');
  // --- IS-03: 双方向性とネットワークの説明
  await page.click('#chapter-nav a[href="#/works"]'); await page.waitForTimeout(200);
  const worksText = await page.textContent('#view');
  ok(worksText.includes('ネットワークを通してほかのコンピュータ（サーバー）とデータをやりとりする') && worksText.includes('通信はまだない') && worksText.includes('サーバーと通信する') && worksText.includes('1つには集まりません'), 'IS-03 works page explains interactivity + communication');
  await page.click('#chapter-nav a[href="#/server"]'); await page.waitForTimeout(200);
  const srvText = await page.textContent('#view');
  ok(srvText.includes('本物では') && srvText.includes('この教材では') && srvText.includes('学校のLANやインターネット'), 'IS-03 server tab real vs model');
  ok(srvText.includes('ランキングにはニックネームを使おう'), 'IS-14 ranking nickname note');
  // --- IS-01: 作品を作る → 開き直す → 残っている
  await page.click('#chapter-nav a[href="#/works"]');
  await page.waitForSelector('.work-list');
  const before = await page.$$eval('.work-list .wl-title', els => els.map(e => e.firstChild.textContent));
  await page.reload();
  await page.waitForSelector('.work-list');
  const after = await page.$$eval('.work-list .wl-title', els => els.map(e => e.firstChild.textContent));
  ok(before.length >= 8 && JSON.stringify(before) === JSON.stringify(after), 'IS-01 works survive reload (' + before.length + ' -> ' + after.length + ')');
  ok(!(await page.$('.load-problem')), 'IS-01 no load-problem banner on normal reload');
  ok(!/null|undefined|NaN/.test(await page.textContent('#view')), 'works page shows no null/undefined/NaN');
  await page.click('#chapter-nav a[href="#/records"]');
  ok((await page.inputValue('#reflect-work')).includes('友だちがすぐ使えた'), 'IS-01 reflection survives reload');
  // 読みこめないデータ: 上書きせず控えを残し、お知らせを出す
  await page.evaluate(() => { localStorage.setItem('istudio.works.v1', '{"works": [ {"title": "こわれ'); location.hash = '#/works'; });
  await page.reload();
  await page.waitForSelector('.load-problem');
  ok((await page.textContent('.load-problem')).includes('前の作品を読みこめませんでした'), 'IS-01 load failure message');
  const bk = await page.evaluate(() => JSON.parse(localStorage.getItem('istudio.works.v1.backup')));
  ok(Array.isArray(bk) && bk[0].raw === '{"works": [ {"title": "こわれ', 'IS-01 broken data kept as backup');
  // 次の時間のために、ふつうの状態にもどす（控えを消す）
  await page.click('.load-problem button:has-text("控えを消す")');
  ok(!(await page.$('.load-problem')), 'IS-01 backup can be removed');
  // help & mobile
  await page.click('#chapter-nav a[href="#/help"]'); await page.waitForTimeout(200);
  ok((await page.textContent('#view')).includes('server.ranking'), 'help lists builtins');
  await page.setViewportSize({ width: 390, height: 800 });
  await page.click('#chapter-nav a[href="#/editor"]');
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  ok(sw <= 392, 'no horizontal scroll on phone width: ' + sw);
  await page.screenshot({ path: 'shot-mobile.png', fullPage: false });
  // ===== 第2段（IS-04, 05, 07, 08, 09, 11, 13, 15, 16、先生の決定、記録の書き出し） =====
  const c2 = await browser.newContext({ viewport: { width: 1366, height: 650 }, acceptDownloads: true });
  c2.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) reqs.push(r.url()); });
  const q = await c2.newPage();
  q.on('pageerror', e => errors.push('stage2: ' + e.message));
  q.on('console', m => { if (m.type() === 'error') errors.push('stage2 console: ' + m.text()); });
  const dialogs = [];
  q.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
  await q.goto(URL);
  const code2 = () => q.inputValue('.code-input');
  // 先生の決定: サーバーとのやりとりを1つ以上入れる（いまの作品にあるかどうか）
  let wt = await q.textContent('#view');
  ok(wt.includes('作品には、サーバーとのやりとり（server の命令）を1つ以上入れよう') && wt.includes('この作品には、まだ server の命令がありません'), 'teacher rule shown + current work has no server command');
  // IS-09: メモの見出しに作品名。見本のままの作品に書いたメモは、新しい作品に移すか聞く
  ok((await q.textContent('.plan summary')).includes('「ボタンでカウンター」のメモ'), 'IS-09 plan memo heading names the work');
  await q.click('.plan summary');
  await q.fill('#plan-problem', 'アンケートを紙で集計するのが大変');
  await q.click('button.sample:has-text("空の作品")');
  await q.waitForSelector('.workspace .block');
  ok(dialogs.some(m => m.includes('企画・改善メモを、新しい作品に移しますか')), 'IS-09 asks to move memo to the new work');
  // IS-04: 開いたときの位置は、いちばん下
  const lastIsCursor = await q.evaluate(() => { const ws = document.querySelector('.workspace'); const last = ws.lastElementChild; return last.classList.contains('gap') && last.classList.contains('cursor'); });
  ok(lastIsCursor, 'IS-04 cursor starts after the last block');
  ok((await q.textContent('.pane-blocks .pane-title')).includes('すき間を押すと'), 'IS-04 hint explains tapping gaps');
  ok((await q.$$('.workspace .gap .gap-plus')).length >= 2 && (await q.locator('.workspace .gap').first().boundingBox()).height >= 20, 'IS-04 gaps show + and are >= 20px');
  await q.click('.pal-item:has-text("もし〜でなければ")');
  ok(await q.isVisible('.gap.exit:has-text("「もし」の外（この下）に入れる")'), 'IS-04 exit button shown while inside もし');
  await q.click('.gap.exit');
  await q.click('.pal-item:has-text("表示を消す")');
  ok(/\}\nclear\(\);\n$/.test(await code2()), 'IS-04 exit puts next block after the if');
  // 複製・↑↓のあとは、そのブロックの下へ
  await q.click('.workspace > .block >> nth=1 >> .tools button[aria-label="複製"]');
  await q.click('.pal-item:has-text("待つ")');
  ok((await code2()).includes('show("こんにちは！");\nshow("こんにちは！");\nwait(1);'), 'IS-04 cursor follows duplicate');
  await q.click('.workspace > .block >> nth=0 >> .tools button[aria-label="下へ"]');
  await q.click('.pal-item:has-text("表示を消す")');
  ok((await code2()).startsWith('show("こんにちは！");\n// ここにプログラムを作ろう\nclear();'), 'IS-04 cursor follows move down');
  // IS-05: 条件は［左］［記号］［右（文字）］。富士山 と打てば " " が付く
  const right = q.locator('.cond-wrap .slot-outer').nth(1).locator('input');
  await right.fill('富士山');
  ok((await code2()).includes('if (answer == "富士山") {'), 'IS-05 compare right side in text mode adds quotes');
  await q.selectOption('.cond-wrap select.op', '!=');
  ok((await code2()).includes('if (answer != "富士山") {'), 'IS-05 compare operator select');
  await q.click('.cond-wrap button:has-text("まとめて書く")');
  await q.locator('.cond-wrap input').fill('answer == 北岳');
  ok((await q.textContent('.slot-note:not([hidden])')).includes('"北岳" のように " " でかこもう'), 'IS-05 visible hint for Japanese word without quotes');
  await q.locator('.cond-wrap input').fill('answer == "北岳"');
  // 「文字」のまま " や + を打ったら「式」をすすめ、\ を付けずに移す
  await q.click('.pal-item:has-text("変数に入れる")');
  await q.click('.pal-item:has-text("表示する") >> nth=0');
  const shIdx = await q.$$eval('.block.cat-io .slot input', els => els.findIndex(e => e.value === 'こんにちは'));
  const sh = q.locator('.block.cat-io .slot input').nth(shIdx);
  await sh.fill('"得点は" + score + "点"');
  ok(await q.isVisible('.slot-note .note-btn:has-text("式に切りかえる")'), 'IS-05 suggests switching to 式');
  await q.click('.slot-note .note-btn:has-text("式に切りかえる")');
  ok((await code2()).includes('show("得点は" + score + "点");'), 'IS-05 text->expr moves content without backslashes');
  ok(await q.isVisible('.pal-item:has-text("文字と変数をつなげて表示")') && await q.isVisible('.pal-item:has-text("さいころの目を表示する（例）")') && !(await q.isVisible('.pal-item:text-is("コードで書く")')), 'IS-05 palette: join block + renamed dice example');
  // IS-07: エディタから部品を置く・画面にないボタンはすぐ置ける・実行時に知らせる
  await q.fill('.code-input', 'show("こんにちは！");\n');
  await q.waitForTimeout(500);
  await q.click('.pal-item:has-text("ボタンが押されたとき")');
  ok((await q.textContent('.part-pick')).includes('画面にない'), 'IS-07 missing part marked');
  await q.click('#chapter-nav a[href="#/run"]');
  await q.click('.run-controls .btn >> nth=0');
  await q.waitForSelector('.out-warn');
  ok((await q.textContent('.out-warn')).includes('ボタン「button1」が画面にありません'), 'IS-07 run warns when the button is missing');
  await q.click('.run-controls button:has-text("停止")');
  await q.click('#chapter-nav a[href="#/editor"]');
  await q.click('.part-pick button:has-text("画面に置く")');
  ok(!(await q.$('.part-pick')) && (await q.textContent('.pal-note')).includes('button1'), 'IS-07 place missing part from the block');
  await q.click('.pal-item:has-text("＋ ラベルを置く")');
  ok((await q.textContent('.pal-note')).includes('label1'), 'IS-07 palette places a label');
  await q.click('.seg:has-text("ブロック＋実行")');
  ok(await q.isVisible('.pane-preview .stage') && await q.isVisible('.pane-preview .part-button'), 'IS-07 editor shows a run screen (preview) with parts');
  await q.click('.pane-preview .run-controls .btn >> nth=0');
  await q.waitForFunction(() => document.querySelector('.pane-preview .run-status').textContent.includes('待って'));
  ok((await q.textContent('.pane-preview .stage-output')).includes('こんにちは！'), 'IS-07 preview runs the program');
  await q.click('.pane-preview button:has-text("停止")');
  await q.click('.seg:has-text("両方")');
  await q.click('#chapter-nav a[href="#/run"]');
  dialogs.length = 0;
  await q.click('.part-row-edit >> nth=1 >> button[aria-label="削除"]');
  ok(dialogs.some(m => m.includes('画面から消しますか')), 'IS-07 deleting a part asks first');
  await q.click('#chapter-nav a[href="#/editor"]');
  // IS-13: 文字のコードにまちがいがある間は、ブロックとパレットを使えない（書いた行が消えない）
  const typed = (await code2()) + 'show("a");\nshow("b";\n';
  await q.fill('.code-input', typed);
  await q.waitForTimeout(500);
  ok(await q.isVisible('.lock-note') && await q.isDisabled('.pal-item:has-text("表示を消す")'), 'IS-13 palette locked while code has an error');
  await q.click('.pal-item:has-text("表示を消す")', { force: true }).catch(() => {});
  ok(await code2() === typed, 'IS-13 typed lines are not lost');
  await q.fill('.code-input', typed.replace('show("b";', 'show("b");'));
  await q.waitForTimeout(500);
  ok(!(await q.isVisible('.lock-note')) && !(await q.isDisabled('.pal-item:has-text("表示を消す")')), 'IS-13 unlocked after fixing');
  // IS-11: ブロックの欄は大文字にしない
  ok(await q.$$eval('.workspace input.fld', els => els.length > 0 && els.every(e => e.getAttribute('autocapitalize') === 'off' && e.getAttribute('autocorrect') === 'off')), 'IS-11 block inputs autocapitalize/autocorrect off');
  // IS-08: アンケートの箱の名前がちがうと、実行画面に知らせる
  await q.click('#chapter-nav a[href="#/works"]');
  await q.click('button.sample:has-text("アンケート集計")');
  await q.waitForSelector('.workspace .block');
  ok(!(await q.$('.block .fld.wide.mono')), 'IS-08 survey sample has no raw code block');
  await q.fill('.code-input', (await code2()).replace('server.save(box, ans)', 'server.save("好きな教科", ans)'));
  await q.waitForTimeout(500);
  await q.click('#chapter-nav a[href="#/run"]');
  await q.click('.run-controls .btn >> nth=0');
  await q.click('.prompt-choices .choice >> nth=0');
  await q.waitForFunction(() => document.querySelector('.run-status').textContent.includes('最後まで'), null, { timeout: 8000 });
  ok((await q.textContent('.out-warn')).includes('箱「朝ごはん」はまだありません（今ある箱: 好きな教科）'), 'IS-08 warning for a box that does not exist');
  // IS-15・先生の決定2: サーバーのログは日本語・班で1台の端末を回す
  await q.click('#chapter-nav a[href="#/server"]'); await q.waitForTimeout(200);
  const st2 = await q.textContent('#view');
  ok(st2.includes('件数を問い合わせ') && !(await q.$$eval('.log-wrap td', tds => tds.some(t => /^(save|count)$/.test(t.textContent)))), 'IS-15 server log op names in Japanese');
  ok(st2.includes('クラスのアンケートは、班の中で1台の端末を回して答えてもらおう（この教材のサーバーは、端末ごとの模型です）'), 'teacher tip on server tab');
  await q.click('#chapter-nav a[href="#/works"]'); await q.waitForSelector('.server-rule');
  wt = await q.textContent('#view');
  ok(wt.includes('この作品はサーバーとやりとりしています（server.save・server.count）'), 'teacher rule: current work uses server');
  ok(wt.includes('ファイルに保存（.json）') && !wt.includes('JSONで保存'), 'IS-15 JSON save renamed');
  // IS-15: ヘルプに順次・分岐・反復・イベント。ブロックの名前はパレットと同じ
  await q.click('#chapter-nav a[href="#/help"]'); await q.waitForTimeout(200);
  const ht = await q.textContent('#view');
  ok(['順次', '分岐', '反復', 'イベント', '回数くり返す', '条件でくり返す', '変数に入れる', '分岐と反復（くり返し）'].every(t => ht.includes(t)) && !ht.includes('〜 のあいだ、くり返す'), 'IS-15 help uses textbook terms and palette names');
  // 記録: さわっただけの見本は出さない・サーバーの列・組と番号がないと書き出さない
  await q.click('#chapter-nav a[href="#/works"]');
  await q.click('button.sample:has-text("3問クイズ")'); // さわっただけ
  await q.click('#chapter-nav a[href="#/records"]');
  await q.waitForSelector('table.data tbody tr');
  const rows = await q.$$eval('table.data tbody tr', trs => trs.map(t => t.textContent));
  ok(!rows.some(r => r.includes('3問クイズ')) && rows.some(r => r.includes('アンケート集計') && r.includes('あり')), 'IS-09 records skip untouched samples; server column');
  ok((await q.textContent('#view')).includes('先生に出すのは JSON のファイルです'), 'records: which file to hand in');
  let downloaded = 0;
  q.on('download', () => downloaded++);
  await q.click('button:has-text("記録を書き出す（JSON）")');
  await q.waitForTimeout(300);
  ok(downloaded === 0 && (await q.textContent('.export-note')).includes('組と番号を入れてから書き出そう'), 'records: no export without class/number');
  await q.fill('#stu-cls', '2'); await q.fill('#stu-num', '15');
  const [rd] = await Promise.all([q.waitForEvent('download'), q.click('button:has-text("記録を書き出す（JSON）")')]);
  const rec = JSON.parse(fs.readFileSync(await rd.path(), 'utf8'));
  ok((await q.textContent('.export-note')).includes('ファイルを保存しました（ファイル名: 制作スタジオ_2-15.json）。先生に言われた場所に出そう。'), 'records: saved message with file name');
  ok(rec.works.every(w => w.title !== '3問クイズ') && rec.works.some(w => w.usesServer === true && w.serverCommands.includes('server.save')), 'records JSON has usesServer and no untouched samples');
  const [cd] = await Promise.all([q.waitForEvent('download'), q.click('button:has-text("CSVで書き出す")')]);
  ok(fs.readFileSync(await cd.path(), 'utf8').includes('"サーバーとのやりとり"'), 'records CSV has server column');
  // IS-16: 大きな文字（開き直しても残る）
  await q.click('.display-toggles .toggle:has-text("大きな文字")');
  ok(await q.evaluate(() => document.documentElement.classList.contains('large-text') && getComputedStyle(document.documentElement).fontSize === '20px'), 'IS-16 large text on');
  await q.reload();
  ok(await q.evaluate(() => document.documentElement.classList.contains('large-text')) && (await q.getAttribute('.display-toggles .toggle', 'aria-pressed')) === 'true', 'IS-16 large text remembered');
  await q.click('#chapter-nav a[href="#/editor"]');
  ok(await q.evaluate(() => document.documentElement.scrollWidth) <= 1366, 'IS-16 no overflow with large text');
  await c2.close();
  // IS-11: タブレット（指）では、↑↓⧉✕ が40px以上で濃く、部品の名前の欄が広い
  const c3 = await browser.newContext({ viewport: { width: 1080, height: 810 }, hasTouch: true });
  const t = await c3.newPage();
  t.on('pageerror', e => errors.push('tablet: ' + e.message));
  await t.goto(URL);
  await t.click('#chapter-nav a[href="#/editor"]');
  const tb = await t.locator('.block .tools .tool').first().boundingBox();
  const op = await t.$eval('.block .tools .tool', e => getComputedStyle(e).opacity);
  ok(tb.width >= 40 && tb.height >= 40 && op === '1', 'IS-11 block tools >= 40px and not faint on touch: ' + JSON.stringify([tb.width, tb.height, op]));
  await t.click('#chapter-nav a[href="#/run"]');
  const nameW = (await t.locator('.part-row-edit input.mono').first().boundingBox()).width;
  ok(nameW >= 120, 'IS-11 part name field wide enough on tablet: ' + Math.round(nameW));
  ok(await t.evaluate(() => document.documentElement.scrollWidth) <= 1080, 'IS-11 no overflow on tablet run tab');
  await c3.close();
  ok(errors.length === 0, 'no page errors ' + JSON.stringify(errors));
  ok(reqs.length === 0, 'no external requests ' + JSON.stringify(reqs));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
