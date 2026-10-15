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
assert.match(svg, /data-external-port="adc.tail"/);
assert.match(svg, /data-external-port="uart.tx"/);
assert.ok(!svg.includes('data-external-port="adc.voltage"'));
for (const port of model.ports.values()) {
  if (!model.links.some((link) => link.from === port.id || link.to === port.id)) {
    const endX = port.x + (port.direction === 'in' ? -24 : 24);
    assert.ok(svg.includes(`data-external-port="${port.id}" d="M ${port.x} ${port.y} H ${endX}"`));
  }
}
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

// 1개 연결의 굴곡에는 점이 없고 2개 출력 분기에는 실제 T자 지점 하나만 표시합니다.
const branchSource =
  'component a "A" #ffffff column 1 {\nunit a "A" #ffffff {\nout p\n}\n}\ncomponent b "B" #ffffff column 2 {\nunit b "B" #ffffff {\nin p\nin q\n}\n}\n';
const single = diagram.render(diagram.parse(branchSource + 'a.p -> b.p'));
assert.equal((single.match(/<circle /g) || []).length, 0);
const branching = diagram.render(diagram.parse(branchSource + 'a.p -> b.p\na.p -> b.q'));
assert.equal((branching.match(/<circle /g) || []).length, 1);
const movedModel = diagram.parse(branchSource + 'a.p -> b.p\na.p -> b.q\nroute a.p normal 20 -30');
const movedSvg = diagram.render(movedModel);
const startPort = movedModel.ports.get('a.p');
const endPort = movedModel.ports.get('b.p');
assert.ok(
  movedSvg.includes(`M ${startPort.x} ${startPort.y} H ${startPort.x + 16} V ${startPort.y - 30}`),
);
assert.ok(movedSvg.includes(`H ${endPort.unit.component.x - 20} V ${endPort.y} H ${endPort.x}`));
assert.equal((movedSvg.match(/<circle /g) || []).length, 1);
assert.throws(() => diagram.parse(branchSource + 'a.p -> b.p\nroute a.p normal 501 0'), /-500~500/);

// 외부 입출력은 포트에 지정한 신호 스타일을 따르고 연결은 기존 문법을 유지합니다.
const externalSource = `signal custom "외부" #112233 dashdot
component external "External" #ffffff column 1 {
  unit externalUnit "Driver" #ffffff {
    in incoming "Input" signal custom
    out outgoing signal custom
    in defaultPort
  }
}`;
const externalSvg = diagram.render(diagram.parse(externalSource));
for (const id of ['incoming', 'outgoing']) {
  const tag = externalSvg.match(
    new RegExp('<path[^>]*data-external-port="externalUnit.' + id + '"[^>]*>'),
  )[0];
  assert.match(tag, /stroke="#112233" stroke-dasharray="8 4 2 4"/);
}
assert.throws(
  () => diagram.parse(externalSource.replace('signal custom\n', 'signal missing\n')),
  /정의되지 않은 신호/,
);

// 중간 열의 컴포넌트가 늘어나도 우회 경로의 모든 선분이 박스 내부를 통과하지 않습니다.
for (const count of [1, 5]) {
  const blockers = Array.from(
    { length: count },
    (_, index) => `component obstacle${index} "Obstacle" #ffffff column 2 {
    unit obstacleUnit${index} "Block" #ffffff {
      in unused
    }
  }`,
  ).join('\n');
  const source = `component sender "Sender" #ffffff column 1 {
    unit senderUnit "Sender" #ffffff {
      out value
    }
  }
  ${blockers}
  component receiver "Receiver" #ffffff column 3 {
    unit receiverUnit "Receiver" #ffffff {
      in value
    }
  }
  senderUnit.value -> receiverUnit.value`;
  for (const offset of ['', '2 0', '-2 0', '20 -10', '500 500', '-500 -500']) {
    const routedModel = diagram.parse(
      source + (offset ? '\nroute senderUnit.value normal ' + offset : ''),
    );
    const routedSvg = diagram.render(routedModel);
    const path = routedSvg.match(
      /data-route-key="senderUnit.value:normal"[^>]*><path d="([^"]+)"/,
    )[1];
    let x = 0;
    let y = 0;
    const obstacles = routedModel.components.filter((item) => item.column === 2);
    for (const command of path.matchAll(/([MHV])\s+(-?[\d.]+)(?:\s+(-?[\d.]+))?/g)) {
      const nextX = command[1] === 'V' ? x : Number(command[2]);
      const nextY =
        command[1] === 'M' ? Number(command[3]) : command[1] === 'V' ? Number(command[2]) : y;
      if (command[1] !== 'M') {
        for (const box of obstacles) {
          const crosses =
            command[1] === 'H'
              ? y > box.y &&
                y < box.y + box.height &&
                Math.max(x, nextX) > box.x &&
                Math.min(x, nextX) < box.x + box.width
              : x > box.x &&
                x < box.x + box.width &&
                Math.max(y, nextY) > box.y &&
                Math.min(y, nextY) < box.y + box.height;
          assert.equal(crosses, false, '우회 경로가 중간 박스를 통과함');
        }
      }
      x = nextX;
      y = nextY;
    }
    const bottom = Math.max(...obstacles.map((box) => box.y + box.height));
    assert.ok(Number(routedSvg.match(/height="([\d.]+)"/)[1]) > bottom + 24);
  }
}

// 수신 진입선은 여러 신호와 극단적인 수동 이동에서도 서로 다른 x 좌표를 유지합니다.
let previousWidth = 0;
for (const count of [3, 12]) {
  const ports = Array.from({ length: count }, (_, index) => index);
  const denseSource = `component source "Source" #ffffff column 1 {
    unit source "Source" #ffffff {
      ${ports.map((index) => 'out p' + index).join('\n')}
    }
  }
  component middle "Middle" #ffffff column 2 {
    unit middle "Middle" #ffffff {
      in unused
    }
  }
  component destination "Destination" #ffffff column 3 {
    unit destination "Destination" #ffffff {
      ${ports.map((index) => 'in p' + index).join('\n')}
    }
  }
  ${ports.map((index) => 'source.p' + index + ' -> destination.p' + index).join('\n')}`;
  const normalModel = diagram.parse(denseSource);
  const normalSvg = diagram.render(normalModel);
  const width = Number(normalSvg.match(/width="([\d.]+)"/)[1]);
  assert.ok(width > previousWidth);
  previousWidth = width;
  const moved = diagram.parse(
    denseSource +
      '\n' +
      ports
        .map((index) => 'route source.p' + index + ' normal ' + (index % 2 ? -500 : 500) + ' -10')
        .join('\n'),
  );
  const svg = diagram.render(moved);
  const destination = moved.components[2];
  const entryPositions = [];
  for (const index of ports) {
    const path = svg.match(
      new RegExp('data-route-key="source.p' + index + ':normal"[^>]*><path d="([^"]+)"'),
    )[1];
    const turns = [...path.matchAll(/H (-?[\d.]+) V (-?[\d.]+)/g)];
    const entry = Number(turns.at(-1)[1]);
    assert.ok(entry < destination.x);
    entryPositions.push(entry);
  }
  entryPositions.sort((a, b) => a - b);
  entryPositions.slice(1).forEach((x, index) => assert.ok(x - entryPositions[index] >= 16));
  assert.equal(destination.width, normalModel.components[2].width);
  assert.equal(destination.height, normalModel.components[2].height);
}
