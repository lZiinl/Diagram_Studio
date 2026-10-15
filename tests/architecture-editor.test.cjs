const assert = require('node:assert/strict');
const vm = require('node:vm');
const { createEditor } = require('./editor-save.test.cjs');

async function run() {
  const saved = [];
  const picker = async () => ({
    createWritable: async () => ({
      write: async (blob) => saved.push(await blob.text()),
      close: async () => {},
    }),
  });
  const editor = createEditor(picker, [['dynamic-source', '기존 다이나믹 소스']], 'architecture');
  assert.equal(editor.elements.get('svg').disabled, false);
  assert.match(editor.elements.get('status').textContent, /연결/);
  assert.equal(editor.storage.get('dynamic-source'), '기존 다이나믹 소스');
  const original = editor.elements.get('source').value;
  vm.runInContext('duplicateTab(); reorderTab(project.activeTabId, 0)', editor.context);
  assert.equal(vm.runInContext('project.tabs.length', editor.context), 2);
  editor.elements.get('source').value = '잘못된 소스';
  vm.runInContext('refresh()', editor.context);
  assert.equal(editor.elements.get('png').disabled, true);
  const restored = createEditor(picker, [...editor.storage], 'architecture');
  assert.equal(restored.elements.get('source').value, '잘못된 소스');
  vm.runInContext('switchTab(project.tabs[1].id)', editor.context);
  assert.equal(editor.elements.get('source').value, original);
  await vm.runInContext('saveProject();', editor.context);
  assert.equal(JSON.parse(saved[0]).diagramType, 'architecture');
  editor.elements.get('project-file').files = [{ text: async () => saved[0] }];
  await vm.runInContext('importProject()', editor.context);
  assert.equal(vm.runInContext('project.tabs.length', editor.context), 2);
  await vm.runInContext('exportSvg()', editor.context);
  assert.match(saved[1], /<svg/);
  vm.runInContext("createPngBlob = async () => new Blob(['png'])", editor.context);
  await vm.runInContext('exportPng()', editor.context);
  assert.equal(saved[2], 'png');
  await vm.runInContext('saveSource()', editor.context);
  editor.elements.get('file').files = [{ name: 'architecture.uml', text: async () => saved[3] }];
  await vm.runInContext('importSource()', editor.context);
  assert.equal(editor.elements.get('svg').disabled, false);
  const legacy = createEditor(picker, [['architecture-example-source', original]], 'architecture');
  assert.equal(legacy.elements.get('source').value, original);
  assert.equal(editor.alerts.length, 0);
  const sourceBeforeHighlight = editor.elements.get('source').value;
  vm.runInContext(
    "EditorLayout.highlightSource({ target: { closest: () => ({ dataset: { sourceLines: '2,4' } }) } })",
    editor.context,
  );
  assert.equal(editor.elements.get('line-numbers').children[1].className, 'source-selected');
  assert.equal(editor.elements.get('line-numbers').children[3].className, 'source-selected');
  assert.match(editor.elements.get('source').style.backgroundImage, /linear-gradient/);
  assert.equal(editor.elements.get('source').value, sourceBeforeHighlight);
  const diagramArea = editor.elements.get('diagram');
  diagramArea.listeners.click({
    target: { closest: () => ({ dataset: { routeKey: 'adc.voltage:normal' } }) },
  });
  diagramArea.listeners.keydown({ key: 'ArrowRight', shiftKey: true, preventDefault() {} });
  diagramArea.listeners.keydown({ key: 'ArrowUp', shiftKey: true, preventDefault() {} });
  assert.match(editor.elements.get('source').value, /route adc.voltage normal 10 -10/);
  assert.match(editor.storage.get('architecture-project-v1'), /route adc.voltage normal 10 -10/);
  diagramArea.listeners.keydown({ key: 'ArrowDown', shiftKey: false, preventDefault() {} });
  assert.match(editor.elements.get('source').value, /route adc.voltage normal 10 -8/);
  editor.elements.get('routes-reset').onclick();
  assert.ok(!editor.elements.get('source').value.includes('route adc.voltage'));
  const boxTarget = {
    closest: (selector) =>
      selector === '[data-component-box]' ? { dataset: { componentBox: 'monitor' } } : null,
  };
  diagramArea.listeners.click({ target: boxTarget });
  diagramArea.listeners.keydown({ key: 'ArrowDown', shiftKey: false, preventDefault() {} });
  assert.match(editor.elements.get('source').value, /place monitor column 2 y 112/);
  diagramArea.listeners.keydown({ key: 'ArrowDown', shiftKey: true, preventDefault() {} });
  assert.match(editor.elements.get('source').value, /place monitor column 2 y 122/);
  assert.match(editor.storage.get('architecture-project-v1'), /place monitor column 2 y 122/);
  diagramArea.listeners.keydown({ key: 'ArrowRight', shiftKey: false, preventDefault() {} });
  assert.match(editor.elements.get('source').value, /place monitor column 2 y 122/);
  assert.equal(diagramArea.listeners.pointerdown, undefined);
  editor.elements.get('routes-reset').onclick();
  assert.ok(!editor.elements.get('source').value.includes('place monitor'));
  const unitTarget = {
    closest: (selector) =>
      selector === '[data-unit-box]' ? { dataset: { unitBox: 'func' } } : null,
  };
  diagramArea.listeners.click({ target: unitTarget });
  diagramArea.listeners.keydown({ key: 'ArrowRight', shiftKey: false, preventDefault() {} });
  assert.match(editor.elements.get('source').value, /unitplace func x \d+ y 42/);
  diagramArea.listeners.keydown({ key: 'ArrowDown', shiftKey: true, preventDefault() {} });
  assert.match(editor.elements.get('source').value, /unitplace func x \d+ y 52/);
  assert.match(editor.storage.get('architecture-project-v1'), /unitplace func/);
  assert.ok(!editor.elements.get('source').value.includes('place monitor'));
  editor.elements.get('routes-reset').onclick();
  assert.ok(!editor.elements.get('source').value.includes('unitplace'));
  console.log(
    'PASS: architecture shared UI, migration, independent storage, tabs, project and exports',
  );
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
