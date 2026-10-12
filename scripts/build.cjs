const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');

// 다른 위치를 가리키는 링크에 쓰지 않도록 출력 경로를 검사합니다.
if (fs.existsSync(output) && fs.lstatSync(output).isSymbolicLink()) {
  throw Error('dist must not be a symlink');
}

fs.mkdirSync(output, { recursive: true });
fs.cpSync(path.join(root, 'web'), output, { recursive: true });

// 소스는 목적별 이름을 유지하고 호스팅과 기존 URL의 진입 파일만 생성합니다.
const redirects = {
  'index.html': 'diagram-hub.html',
  'pages/sequence/index.html': 'sequence-editor.html',
  'pages/architecture/index.html': 'architecture-overview.html',
};

for (const [file, target] of Object.entries(redirects)) {
  fs.writeFileSync(
    path.join(output, file),
    `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="refresh" content="0;url=${target}">
    <title>Diagram Studio 이동</title>
  </head>
  <body>
    <a href="${target}">페이지 열기</a>
  </body>
</html>
`,
  );
}

console.log('Static site copied to ' + output);
