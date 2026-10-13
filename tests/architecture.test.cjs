const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const diagram = require('../web/features/architecture/diagram.js');
const example = vm.runInNewContext(
  fs.readFileSync('web/features/architecture/example.js', 'utf8') + '\narchitectureExample',
);
const model = diagram.parse(example);
const customSource =
  'signal fault "사용자 오류" #123456 dashed\nsignal diagnostic "진단 <통신>" #8050cc dashdot\n' +
  example
    .replace(/^signal fault .*\n/m, '')
    .replace('adc.bin -> bin.value', 'adc.bin -> bin.value diagnostic');
const custom = diagram.parse(customSource);
const customSvg = diagram.render(custom);
assert.equal(custom.signals.get('fault').name, '사용자 오류');
assert.match(customSvg, /stroke="#123456" stroke-dasharray="8 5"/);
assert.match(customSvg, /stroke="#8050cc" stroke-dasharray="8 4 2 4"/);
assert.match(customSvg, /진단 &lt;통신&gt;/);
assert.match(
  diagram.render(
    diagram.parse(example.replace(/^signal hw .*$/m, 'signal hw "하드웨어" #112233 dotted')),
  ),
  /stroke="#112233" stroke-dasharray="2 5"/,
);
assert.throws(() => diagram.parse(example + '\nadc.bin -> bin.value missing'), /정의되지 않은/);
assert.throws(() => diagram.parse('signal fault "오류" #ff0000 invalid\n' + example), /1행/);
assert.equal(model.components.length, 7);
assert.equal(model.links.length, 15);
const svg = diagram.render(model);
const ports = (direction) =>
  Array.from({ length: 40 }, (_, index) => `${direction} p${index}`).join('\n');
const links = Array.from({ length: 40 }, (_, index) => `a.p${index} -> b.p${index}`).join('\n');
const dense = diagram.parse(
  `component a "A" #ffffff column 1 {\nunit a "A" #ffffff {\n${ports('out')}\n}\n}\ncomponent b "B" #ffffff column 2 {\nunit b "B" #ffffff {\n${ports('in')}\n}\n}\n${links}`,
);
diagram.render(dense);

assert.equal(dense.components[0].routeKeys.length, 40);
for (const component of model.components) {
  for (const unit of component.units) {
    const count = Math.max(
      ...['in', 'out'].map(
        (direction) => unit.ports.filter((port) => port.direction === direction).length,
      ),
    );
    assert.ok(unit.height <= Math.max(100, count * 36 + 80));
  }
}
assert.ok(model.components.every((component) => component.y >= 110));
assert.match(svg, /aria-label="신호 종류 범례"/);
assert.ok(!/NaN|undefined/.test(svg));
assert.match(svg, /stroke="#ef4444"/);
assert.match(svg, /stroke="#16a34a"/);
assert.match(svg, /r="3" fill="#475569"/);
assert.throws(() => diagram.parse(example + '\nunknown.out -> led.mode'), /out 포트/);
assert.throws(() => diagram.parse(example + '\nled.tail -> func.voltage'), /오른쪽 열/);
assert.throws(
  () => diagram.parse(example.replace('in tail "Vcc_Tail"', 'in tail\nin tail')),
  /중복/,
);
assert.match(
  diagram.render(diagram.parse(example.replace('Vcc_Tail', '<script>'))),
  /&lt;script&gt;/,
);
assert.equal(diagram.render(model), svg);
// 출력 라벨 오른쪽에 배선 구간이 확보되어 세로선이 이름을 가르지 않습니다.
for (const port of model.ports.values()) {
  if (port.direction === 'out') {
    assert.ok(port.unit.component.routeStart >= port.x + 8 + port.name.length * 7);
  }
}
for (const component of model.components) {
  assert.equal(new Set(component.routeKeys).size, component.routeKeys.length);
}
console.log(
  'PASS: architecture example, validation, branching, colors, escaping and stable layout',
);

const narrow = diagram.render(diagram.parse(example), { gap: 24, row: 30 });
const wide = diagram.render(diagram.parse(example), { gap: 100, row: 100 });
assert.ok(
  Number(wide.match(/width="([0-9.]+)"/)[1]) > Number(narrow.match(/width="([0-9.]+)"/)[1]),
);
assert.ok(
  Number(wide.match(/height="([0-9.]+)"/)[1]) > Number(narrow.match(/height="([0-9.]+)"/)[1]),
);
