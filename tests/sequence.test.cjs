const assert = require('node:assert/strict');
const { parse, render } = require('../web/features/sequence/diagram.js');
// 실제 초기 화면에 사용하는 예제로 렌더링을 검증합니다.
// 편집기 소스 문자열을 잘라 실행하지 않으므로 코드 형식에 영향을 받지 않습니다.
const example = require('../web/features/sequence/example.js');
const exampleModel = parse(example);
const exampleSvg = render(exampleModel);
assert.equal(exampleModel.units.length, 6);
assert.equal(exampleModel.events.filter((e) => e.from).length, 9);
assert.match(exampleSvg, /<svg/);
assert.doesNotMatch(exampleSvg, /NaN|undefined/);

// 가장 긴 실제 유닛명은 한 줄로 유지하고, 메시지 길이는 가로 배치를 바꾸지 않습니다.
const fixedSource =
  'component "Long Component Title That Must Wrap" {\nunit a "Appl_WakeUpSleep"\nunit b "B"\nunit c "C"\n}\ncomponent "Next" {\nunit d "D"\n}\na -> b : ';
const shortLayout = parse(fixedSource + 'short');
const longLayout = parse(fixedSource + 'very long signal name '.repeat(15));
render(shortLayout);
render(longLayout);
assert.equal(longLayout.units[0].displayLabel, 'Appl_WakeUpSleep');
assert.ok(longLayout.units.every((unit) => unit.w === 160));
assert.deepEqual(
  longLayout.units.map((unit) => unit.x),
  shortLayout.units.map((unit) => unit.x),
);
assert.ok(longLayout.events[0].displayLabel.includes('\n'));
assert.equal(longLayout.units[1].x - longLayout.units[0].x - 160, 42);
assert.equal(longLayout.units[2].x - longLayout.units[1].x - 160, 42);
assert.equal(
  longLayout.components[1].x - longLayout.components[0].x - longLayout.components[0].w,
  50,
);
assert.equal(exampleModel.units.find((unit) => unit.id === 'func').color, '#CC99FF');
assert.equal(exampleModel.units.find((unit) => unit.id === 'func').ioColor, '#CC99FF');

// 상세설계용 독립 유닛과 컴포넌트 내부 유닛을 함께 사용할 수 있습니다.
const standalone = parse(
  'unit a "Input" #abc io #def\nunit b "Output"\na -> b : signal\na <-- b : return',
);
const standaloneSvg = render(standalone);
assert.equal(standalone.components.length, 0);
assert.equal(standalone.units.length, 2);
assert.doesNotMatch(standaloneSvg, /undefined|NaN/);
assert.equal((standaloneSvg.match(/<rect/g) || []).length, 7); // 배경 + 유닛 2 + 송수신 4
const mixed = parse('unit a "A"\ncomponent "Group" {\nunit b "B"\n}\nunit c "C"\na -> c : signal');
render(mixed);
assert.equal(mixed.components.length, 1);
assert.ok(mixed.units[0].x < mixed.units[1].x && mixed.units[1].x < mixed.units[2].x);

// 제목이 유닛보다 길거나 메시지 때문에 열이 넓어져도 좌우 안쪽 여백은 대칭입니다.
for (const component of exampleModel.components) {
  const first = component.units[0];
  const last = component.units.at(-1);
  const leftPadding = first.x - first.w / 2 - component.x;
  const rightPadding = component.x + component.w - last.x - last.w / 2;
  assert.ok(Math.abs(leftPadding - rightPadding) < 0.000001);
}

// 같은 전송을 왼쪽/오른쪽 문법으로 썼을 때 화살표와 송수신 색상이 같아야 합니다.
const declarations = 'component "C" {\nunit a "A" #aabbcc\nunit b "B" #ddeeff\n}\n';
for (const [left, right] of [
  ['a <- b', 'b -> a'],
  ['a <-- b', 'b --> a'],
  ['a <- a', 'a -> a'],
]) {
  assert.equal(
    render(parse(declarations + left + ' #123456 : signal')),
    render(parse(declarations + right + ' #123456 : signal')),
  );
}

// 긴 메시지의 자동 폭 보정이나 컴포넌트 경계와 무관하게 모든 열 간격이 변해야 합니다.
for (const [smallGap, largeGap] of [
  [24, 42],
  [42, 80],
  [80, 240],
]) {
  const compact = parse(example);
  const spacious = parse(example);
  render(compact, { gap: smallGap });
  render(spacious, { gap: largeGap });
  for (let index = 1; index < compact.units.length; index++) {
    const compactDistance = compact.units[index].x - compact.units[index - 1].x;
    const spaciousDistance = spacious.units[index].x - spacious.units[index - 1].x;
    assert.ok(Math.abs(spaciousDistance - compactDistance - (largeGap - smallGap)) < 0.000001);
  }
  for (let index = 1; index < spacious.components.length; index++) {
    const previous = spacious.components[index - 1];
    assert.ok(spacious.components[index].x >= previous.x + previous.w);
  }
}

// space가 자기 호출로 오인되지 않고 세로 길이만 늘리는지 확인합니다.
for (const spacing of [0, 30, 1000]) {
  const base = 'component "C" {\nunit a "A"\n}';
  const plain = render(parse(base));
  const spaced = render(parse(base + '\nspace ' + spacing));
  assert.equal(+spaced.match(/height="(\d+)"/)[1] - +plain.match(/height="(\d+)"/)[1], spacing);
}

// 일반 메시지, 역방향 응답, 자기 호출을 같은 모델에서 검증합니다.
const source =
  'component "C" #abc {\nunit a "A"\nunit b "B"\n}\na -> b : hello\nb --> a #123456 : return\na -> a : self';
const model = parse(source);
const svg = render(model);
assert.equal(model.events.length, 3);
assert.match(svg, /stroke-dasharray="6 4"/);
assert.match(svg, /#123456/);
assert.equal((svg.match(/data-role="io-box"/g) || []).length, 6);
assert.ok(!/<rect[^>]*stroke=/.test(svg));
assert.match(svg, /font-size="13\.333333333333334"/);
assert.match(svg, /font-size="12\.333333333333334"/);
assert.ok(!/^space /m.test(example));

// 작은 박스 색상은 유닛 색상에 종속되지 않고, 왼쪽 화살촉은 박스 오른쪽에 닿습니다.
const colored = parse(
  'component "C" {\nunit a "A" #abcdef io #123456\nunit b "B" #fedcba io #654321\n}\na <- b : left',
);
const coloredSvg = render(colored);
assert.equal(colored.units[0].ioColor, '#123456');
assert.match(coloredSvg, /data-role="io-box"[^>]*fill="#123456"/);
assert.ok(coloredSvg.includes(`points="${colored.units[0].x + 14},${colored.events[0].y} `));
assert.ok(coloredSvg.indexOf('data-role="io-box"') < coloredSvg.indexOf('<polygon'));
const originalSvg = render(parse(source));
const extendedSvg = render(parse(source + '\na -> b : extra'));
assert.ok(+extendedSvg.match(/height="(\d+)"/)[1] > +originalSvg.match(/height="(\d+)"/)[1]);

// 소스 오류와 SVG에 삽입되는 사용자 텍스트의 이스케이프를 검증합니다.
assert.throws(() => parse(source + '\na -> missing : fail'), /선언하지/);
assert.throws(() => parse('component "A" {\nunit a "A"'), /중괄호/);
assert.throws(() => parse('component "A" {\nunit a "A"\nunit a "A"\n}'), /중복/);
assert.ok(!render(parse('component "<script>" {\nunit a "<img>"\n}')).includes('<script>'));
console.log(
  'PASS: parsing, reverse/self messages, activation boxes, auto-height, validation, escaping',
);
