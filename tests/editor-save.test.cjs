const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// 실제 스크립트 순서로 초기화하여 저장 창 호출과 파일 내용의 연결을 검사합니다.
function createEditor(picker, initialStorage = []) {
  const elements = new Map();
  const storage = new Map(initialStorage);
  const alerts = [];
  const document = {
    body: { appendChild() {} },
    createElement() {
      return {
        style: {},
        getBoundingClientRect: () => ({ height: 22 }),
        setAttribute() {},
        focus() {},
      };
    },
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, {
          value: '',
          files: [],
          textContent: '',
          listeners: {},
          addEventListener(name, listener) {
            this.listeners[name] = listener;
          },
          clientWidth: 1200,
          style: {
            setProperty(name, value) {
              this[name] = value;
            },
          },
          setAttribute(name, value) {
            this[name] = value;
          },
          setPointerCapture() {},
          getBoundingClientRect() {
            return { left: 0 };
          },
          children: [],
          replaceChildren() {
            this.children = [];
          },
          appendChild(child) {
            this.children.push(child);
          },
          firstElementChild: { style: {}, getAttribute: () => '100' },
        });
      }
      return elements.get(id);
    },
  };
  const context = vm.createContext({
    document,
    Blob,
    addEventListener() {},
    confirm: () => true,
    showSaveFilePicker: picker,
    localStorage: {
      getItem: (key) => storage.get(key),
      setItem: (key, value) => storage.set(key, value),
    },
    alert: (message) => alerts.push(message),
  });
  for (const filename of [
    'diagram',
    'example',
    'file-save',
    'project',
    'editor-layout',
    'editor',
  ]) {
    vm.runInContext(fs.readFileSync(`web/features/dynamic/${filename}.js`, 'utf8'), context);
  }
  return { context, elements, storage, alerts };
}

async function run() {
  const toolsEditor = createEditor();
  const toolsSource = toolsEditor.elements.get('source');
  vm.runInContext('addTab(); addTab()', toolsEditor.context);
  toolsSource.value = '작성 중 소스';
  const lastId = vm.runInContext('project.activeTabId', toolsEditor.context);
  const tabButtons = toolsEditor.elements.get('diagram-tabs').children;
  tabButtons[2].ondragstart({ dataTransfer: { setData() {} } });
  tabButtons[1].ondrop({ preventDefault() {} });
  let reordered = JSON.parse(toolsEditor.storage.get('dynamic-project-v1'));
  assert.equal(reordered.tabs[1].id, lastId);
  assert.equal(reordered.activeTabId, lastId);
  assert.equal(reordered.tabs[1].source, '작성 중 소스');
  vm.runInContext(
    'reorderTab(project.activeTabId, 0); reorderTab(project.activeTabId, -1)',
    toolsEditor.context,
  );
  reordered = JSON.parse(toolsEditor.storage.get('dynamic-project-v1'));
  assert.equal(reordered.tabs[0].id, lastId);
  const restoredOrder = createEditor(undefined, [...toolsEditor.storage]);
  assert.equal(vm.runInContext('project.tabs[0].id', restoredOrder.context), lastId);

  const requests = [];
  const savedBlobs = [];
  const editor = createEditor(async (options) => {
    requests.push(options);
    return {
      createWritable: async () => ({
        write: async (blob) => savedBlobs.push(blob),
        close: async () => {},
      }),
    };
  });

  assert.match(editor.elements.get('source').value, /}\n\n\ncomponent/);
  assert.equal(editor.elements.get('editor-main').style['--sidebar-width'], '312px');
  assert.equal(
    editor.elements.get('line-numbers').children.length,
    editor.elements.get('source').value.split('\n').length,
  );
  const splitter = editor.elements.get('panel-splitter');
  splitter.listeners.pointerdown({ button: 0, pointerId: 1, preventDefault() {} });
  splitter.listeners.pointermove({ clientX: 460 });
  splitter.listeners.pointerup();
  assert.equal(editor.elements.get('editor-main').style['--sidebar-width'], '460px');
  assert.equal(editor.storage.get('dynamic-sidebar-width'), '460');
  // 임의 배율, 양 끝 범위, 범위 밖 입력과 입력 중 빈 값을 검사합니다.
  for (const [requested, expected] of [
    ['50', 50],
    ['137', 137],
    ['200', 200],
    ['500', 200],
    ['20', 50],
    ['', 50],
  ]) {
    editor.elements.get('zoom').value = requested;
    vm.runInContext('normalizeZoomInput()', editor.context);
    assert.equal(editor.elements.get('zoom').value, String(expected));
    assert.equal(editor.elements.get('diagram').firstElementChild.style.width, `${expected}px`);
  }
  editor.context.prompt = () => '입력 처리';
  vm.runInContext('renameTab()', editor.context);
  assert.equal(editor.storage.get('dynamic-name'), '입력 처리');
  await vm.runInContext('saveSource()', editor.context);
  assert.equal(requests[0].suggestedName, '입력 처리.uml');
  assert.match(await savedBlobs[0].text(), /^\/\/ @diagram-name: "입력 처리"/);

  editor.elements.get('file').files = [{ name: 'renamed.uml', text: () => savedBlobs[0].text() }];
  await vm.runInContext('importSource()', editor.context);
  assert.equal(vm.runInContext('getDiagramName()', editor.context), '입력 처리');
  await vm.runInContext('exportSvg()', editor.context);
  assert.equal(requests[1].suggestedName, '입력 처리.svg');
  assert.match(await savedBlobs[1].text(), /<svg/);

  // PNG는 비동기 변환 전에 저장 창부터 열려야 합니다.
  vm.runInContext("createPngBlob = async () => new Blob(['png'])", editor.context);
  await vm.runInContext('exportPng()', editor.context);
  assert.equal(requests[2].suggestedName, '입력 처리.png');
  assert.equal(await savedBlobs[2].text(), 'png');
  assert.equal(editor.alerts.length, 0);

  const cancelled = createEditor(async () => {
    throw Object.assign(new Error('cancel'), { name: 'AbortError' });
  });
  vm.runInContext("createPngBlob = () => { throw Error('must not convert'); }", cancelled.context);
  await vm.runInContext('exportPng()', cancelled.context);
  assert.equal(cancelled.alerts.length, 0);

  const fallback = createEditor(undefined);
  fallback.context.prompt = () => null;
  await vm.runInContext('saveSource()', fallback.context);
  assert.equal(fallback.alerts.length, 0);

  // 오류가 있는 작성 중 소스와 화면 설정도 탭 전환 후 유지되어야 합니다.
  editor.elements.get('source').value = '아직 작성 중';
  vm.runInContext('refresh()', editor.context);
  assert.equal(editor.elements.get('line-numbers').children[0].className, 'error-line');
  editor.elements.get('gap').value = '87';
  vm.runInContext('refresh(); addTab()', editor.context);
  assert.equal(editor.elements.get('source').value, '');
  editor.elements.get('source').value = '두 번째 탭';
  vm.runInContext('refresh(); switchTab(project.tabs[0].id)', editor.context);
  assert.equal(editor.elements.get('source').value, '아직 작성 중');
  assert.equal(editor.elements.get('gap').value, '87');
  await vm.runInContext('saveProject()', editor.context);
  const savedProject = JSON.parse(await savedBlobs.at(-1).text());
  assert.equal(savedProject.tabs.length, 2);
  assert.equal(savedProject.tabs[1].source, '두 번째 탭');
  editor.elements.get('project-file').files = [{ text: async () => JSON.stringify(savedProject) }];
  await vm.runInContext('importProject()', editor.context);
  assert.equal(editor.elements.get('source').value, '아직 작성 중');
  vm.runInContext('deleteTab()', editor.context);
  assert.equal(editor.elements.get('source').value, '두 번째 탭');
  assert.equal(editor.elements.get('delete-tab').disabled, true);
  assert.equal(editor.alerts.length, 0);

  const reloaded = createEditor(undefined, [...editor.storage]);
  assert.equal(reloaded.elements.get('source').value, '두 번째 탭');
  assert.equal(reloaded.elements.get('delete-tab').disabled, true);

  // 손상된 파일은 현재 프로젝트를 교체하지 않아야 합니다.
  editor.elements.get('project-file').files = [{ text: async () => '{"format":"other"}' }];
  await vm.runInContext('importProject()', editor.context);
  assert.equal(editor.elements.get('source').value, '두 번째 탭');
  assert.equal(editor.alerts.length, 1);

  const projectApi = require('../web/features/dynamic/project.js');
  assert.throws(() => projectApi.parse(JSON.stringify({ ...savedProject, version: 999 })));
  assert.throws(() =>
    projectApi.parse(
      JSON.stringify({ ...savedProject, tabs: [savedProject.tabs[0], savedProject.tabs[0]] }),
    ),
  );

  const migrated = createEditor(undefined, [
    ['sequence-source', '기존 작업'],
    ['sequence-name', '이전 이름'],
  ]);
  assert.equal(migrated.elements.get('source').value, '기존 작업');
  assert.equal(vm.runInContext('getDiagramName()', migrated.context), '이전 이름');
  // 복제는 독립 ID와 고유 이름을 부여하고 원본의 작성 중 소스·설정을 유지합니다.
  vm.runInContext('duplicateTab()', migrated.context);
  let tabs = JSON.parse(migrated.storage.get('dynamic-project-v1')).tabs;
  assert.equal(tabs.length, 2);
  assert.notEqual(tabs[0].id, tabs[1].id);
  assert.equal(tabs[1].name, '이전 이름 (복사본)');
  assert.equal(tabs[1].source, tabs[0].source);
  assert.equal(tabs[1].zoom, tabs[0].zoom);
  migrated.elements.get('source').value = '복사본에서 수정';
  vm.runInContext('refresh(); switchTab(project.tabs[0].id); duplicateTab()', migrated.context);
  tabs = JSON.parse(migrated.storage.get('dynamic-project-v1')).tabs;
  assert.equal(tabs[0].source, '기존 작업');
  assert.equal(tabs[1].name, '이전 이름 (복사본 2)');
  assert.equal(tabs[2].source, '복사본에서 수정');
  assert.ok(migrated.storage.has('dynamic-project-v1'));
  const legacyProject = createEditor(undefined, [
    ['sequence-project-v1', JSON.stringify(savedProject)],
  ]);
  assert.equal(legacyProject.elements.get('source').value, '아직 작성 중');

  console.log(
    'PASS: example spacing, name persistence, source round-trip, save formats and cancellation',
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
