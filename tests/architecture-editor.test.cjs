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
  console.log(
    'PASS: architecture shared UI, migration, independent storage, tabs, project and exports',
  );
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
