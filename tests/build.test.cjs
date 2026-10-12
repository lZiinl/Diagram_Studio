const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
require('../scripts/build.cjs');
const root=path.resolve(__dirname,'../dist');
for(const [file,target] of Object.entries({'index.html':'diagram-hub.html','pages/sequence/index.html':'sequence-editor.html','pages/architecture/index.html':'architecture-overview.html'})){
 const html=fs.readFileSync(path.join(root,file),'utf8');
 assert.ok(html.includes(`content="0;url=${target}"`));
 assert.ok(fs.existsSync(path.resolve(root,path.dirname(file),target)));
}
console.log('PASS: deployment entry points redirect to existing named pages');
