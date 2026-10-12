// 개발용 정적 서버입니다. 정식 배포의 인증과 HTTPS는 호스팅 서버에서 처리합니다.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = fs.realpathSync(path.resolve(__dirname, '../web'));
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 8765);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};

http
  .createServer((req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      let target = path.resolve(root, '.' + pathname);

      // URL의 상위 경로 이동으로 웹 루트 밖 파일을 읽지 못하도록 검사합니다.
      if (target !== root && !target.startsWith(root + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      // 파일명이 바뀌기 전의 북마크와 디렉터리 URL을 새 페이지로 안내합니다.
      const routes = {
        '/': '/diagram-hub.html',
        '/index.html': '/diagram-hub.html',
        '/pages/dynamic/': '/pages/dynamic/dynamic-editor.html',
        '/pages/dynamic/index.html': '/pages/dynamic/dynamic-editor.html',
        '/pages/sequence/': '/pages/dynamic/dynamic-editor.html',
        '/pages/sequence/index.html': '/pages/dynamic/dynamic-editor.html',
        '/pages/sequence/sequence-editor.html': '/pages/dynamic/dynamic-editor.html',
        '/pages/architecture/': '/pages/architecture/architecture-overview.html',
        '/pages/architecture/index.html': '/pages/architecture/architecture-overview.html',
      };
      const route = routes[pathname] || routes[pathname + '/'];
      if (route) {
        res.writeHead(302, { Location: route }).end();
        return;
      }
      target = fs.realpathSync(target);
      // 심볼릭 링크가 루트 밖을 가리키는 경우도 허용하지 않습니다.
      if (!target.startsWith(root + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      if (!['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(405).end();
        return;
      }
      const data = fs.readFileSync(target);
      res.writeHead(200, {
        'Content-Type': types[path.extname(target)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch {
      res.writeHead(404).end('Not found');
    }
  })
  .listen(port, host, () => console.log(`Diagram Studio: http://${host}:${port}`));
