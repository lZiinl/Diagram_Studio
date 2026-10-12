const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../web');
let count=0;
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory()){walk(file);continue;}if(!file.endsWith('.html'))continue;count++;for(const m of fs.readFileSync(file,'utf8').matchAll(/(?:href|src)="([^"]+)"/g)){if(/^(https?:|#|data:)/.test(m[1]))continue;assert.ok(fs.existsSync(path.resolve(dir,m[1])),`${file}: missing ${m[1]}`);}}}
walk(root);assert.equal(count,3);console.log('PASS: all page links and script/style paths exist');
