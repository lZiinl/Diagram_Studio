const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../web');
let count=0;
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory()){walk(file);continue;}if(!file.endsWith('.html'))continue;count++;for(const m of fs.readFileSync(file,'utf8').matchAll(/(?:href|src)="([^"]+)"/g)){if(/^(https?:|#|data:)/.test(m[1]))continue;assert.ok(fs.existsSync(path.resolve(dir,m[1])),`${file}: missing ${m[1]}`);}}}
walk(root);assert.equal(count,3);console.log('PASS: all page links and script/style paths exist');
for(const page of ['diagram-hub.html','pages/sequence/sequence-editor.html','pages/architecture/architecture-overview.html'])assert.ok(fs.existsSync(path.join(root,page)));
for(const legacy of ['index.html','pages/sequence/index.html','pages/architecture/index.html'])assert.ok(!fs.existsSync(path.join(root,legacy)),'Legacy source page remains: '+legacy);
const launcher=fs.readFileSync(path.resolve(root,'../open-diagram-studio.html'),'utf8');
assert.ok(launcher.includes('web/diagram-hub.html'));
