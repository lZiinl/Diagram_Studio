const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// 실제 스크립트 순서로 초기화하여 저장 창 호출과 파일 내용의 연결을 검사합니다.
function createEditor(picker) {
  const elements = new Map();
  const storage = new Map();
  const alerts = [];
  const document = {
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, {
          value: '',
          files: [],
          textContent: '',
          addEventListener() {},
          firstElementChild: { style: {}, getAttribute: () => '100' },
        });
      }
      return elements.get(id);
    },
  };
  const context = vm.createContext({
    document,
    Blob,
    showSaveFilePicker: picker,
    localStorage: {
      getItem: (key) => storage.get(key),
      setItem: (key, value) => storage.set(key, value),
    },
    alert: (message) => alerts.push(message),
  });
  for (const filename of ['diagram', 'example', 'file-save', 'editor']) {
    vm.runInContext(fs.readFileSync(`web/features/sequence/${filename}.js`, 'utf8'), context);
  }
  return { context, elements, storage, alerts };
}

async function run() {
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
  editor.elements.get('diagram-name').value = '입력 처리';
  vm.runInContext('updateDiagramName()', editor.context);
  assert.equal(editor.storage.get('sequence-name'), '입력 처리');
  await vm.runInContext('saveSource()', editor.context);
  assert.equal(requests[0].suggestedName, '입력 처리.uml');
  assert.match(await savedBlobs[0].text(), /^\/\/ @diagram-name: "입력 처리"/);

  editor.elements.get('file').files = [{ name: 'renamed.uml', text: () => savedBlobs[0].text() }];
  await vm.runInContext('importSource()', editor.context);
  assert.equal(editor.elements.get('diagram-name').value, '입력 처리');
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

  console.log(
    'PASS: example spacing, name persistence, source round-trip, save formats and cancellation',
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
