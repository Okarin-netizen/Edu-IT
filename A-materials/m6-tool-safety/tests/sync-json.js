// tools-data.js の内容から tools.json を作り直す: node tests/sync-json.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const dir = path.join(__dirname, '..');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(dir, 'tools-data.js'), 'utf8'), ctx);
fs.writeFileSync(path.join(dir, 'tools.json'), JSON.stringify(ctx.window.M6_DATA, null, 1) + '\n');
console.log('tools.json を更新しました');
