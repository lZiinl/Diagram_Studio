const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

// 실제 빌드 결과에서 예전 진입 주소가 새 페이지로 연결되는지 검사합니다.
require('../scripts/build.cjs');
const root = path.resolve(__dirname, '../dist');

for (const [file, target] of Object.entries({
  'index.html': 'diagram-hub.html',
  'pages/sequence/index.html': 'sequence-editor.html',
  'pages/architecture/index.html': 'architecture-overview.html',
})) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  assert.ok(html.includes(`content="0;url=${target}"`));
  assert.ok(fs.existsSync(path.resolve(root, path.dirname(file), target)));
}
console.log('PASS: deployment entry points redirect to existing named pages');
