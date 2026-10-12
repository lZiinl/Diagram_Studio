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
    assert.equal(spaciousDistance - compactDistance, largeGap - smallGap);
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
assert.equal((svg.match(/stroke="#ecad3d"/g) || []).length, 6);
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
