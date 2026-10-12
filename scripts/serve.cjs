const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=fs.realpathSync(path.resolve(__dirname,'../web'));
const host=process.env.HOST||'127.0.0.1',port=Number(process.env.PORT||8765);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
http.createServer((req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let target=path.resolve(root,'.'+pathname);
  if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  if(fs.statSync(target).isDirectory())target=path.join(target,'index.html');
  target=fs.realpathSync(target);
  if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
  const data=fs.readFileSync(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);
 }catch{res.writeHead(404).end('Not found');}
}).listen(port,host,()=>console.log(`Diagram Studio: http://${host}:${port}`));
