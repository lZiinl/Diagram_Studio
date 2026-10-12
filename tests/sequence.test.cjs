const assert=require('node:assert/strict');const {parse,render}=require('../web/features/sequence/diagram.js');
const fs=require('node:fs'),vm=require('node:vm');
const exampleSource=fs.readFileSync(require.resolve('../web/features/sequence/editor.js'),'utf8').split('const $=')[0];
const example=vm.runInNewContext(exampleSource+';example');
const exampleModel=parse(example),exampleSvg=render(exampleModel);
assert.equal(exampleModel.units.length,6);
assert.equal(exampleModel.events.filter(e=>e.from).length,9);
assert.match(exampleSvg,/<svg/);
assert.doesNotMatch(exampleSvg,/NaN|undefined/);
for(const spacing of [0,30,1000]){
 const base='component "C" {\nunit a "A"\n}';
 const plain=render(parse(base)),spaced=render(parse(base+'\nspace '+spacing));
 assert.equal(+spaced.match(/height="(\d+)"/)[1]-+plain.match(/height="(\d+)"/)[1],spacing);
}
const source='component "C" #abc {\nunit a "A"\nunit b "B"\n}\na -> b : hello\nb --> a #123456 : return\na -> a : self';
const m=parse(source),svg=render(m);assert.equal(m.events.length,3);assert.match(svg,/stroke-dasharray="6 4"/);assert.match(svg,/#123456/);assert.equal((svg.match(/stroke="#ecad3d"/g)||[]).length,6);
const short=render(parse(source)),long=render(parse(source+'\na -> b : extra'));assert.ok(+long.match(/height="(\d+)"/)[1]>+short.match(/height="(\d+)"/)[1]);
assert.throws(()=>parse(source+'\na -> missing : fail'),/선언하지/);assert.throws(()=>parse('component "A" {\nunit a "A"'),/중괄호/);assert.throws(()=>parse('component "A" {\nunit a "A"\nunit a "A"\n}'),/중복/);
assert.ok(!render(parse('component "<script>" {\nunit a "<img>"\n}')).includes('<script>'));console.log('PASS: parsing, reverse/self messages, activation boxes, auto-height, validation, escaping');

