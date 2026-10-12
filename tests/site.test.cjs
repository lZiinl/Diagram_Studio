const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../web');
let pageCount = 0;

// 파일명을 변경하거나 페이지를 추가할 때 링크와 script/CSS 경로의 누락을 찾습니다.
function checkPageReferences(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      checkPageReferences(file);
      continue;
    }
    if (!file.endsWith('.html')) {
      continue;
    }

    pageCount++;
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (/^(https?:|#|data:)/.test(match[1])) {
        continue;
      }
      assert.ok(fs.existsSync(path.resolve(directory, match[1])), `${file}: missing ${match[1]}`);
    }
  }
}

checkPageReferences(root);
assert.equal(pageCount, 3);
console.log('PASS: all page links and script/style paths exist');

for (const page of [
  'diagram-hub.html',
  'pages/dynamic/dynamic-editor.html',
  'pages/architecture/architecture-overview.html',
]) {
  assert.ok(fs.existsSync(path.join(root, page)));
}

for (const legacy of ['index.html', 'pages/dynamic/index.html', 'pages/architecture/index.html']) {
  assert.ok(!fs.existsSync(path.join(root, legacy)), 'Legacy source page remains: ' + legacy);
}

const launcher = fs.readFileSync(path.resolve(root, '../open-diagram-studio.html'), 'utf8');
assert.ok(launcher.includes('web/diagram-hub.html'));
