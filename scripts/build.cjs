const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const output=path.join(root,'dist');
if(fs.existsSync(output)&&fs.lstatSync(output).isSymbolicLink())throw Error('dist must not be a symlink');
fs.mkdirSync(output,{recursive:true});
fs.cpSync(path.join(root,'web'),output,{recursive:true});
console.log('Static site copied to '+output);
