const assert = require('node:assert/strict');
const vm = require('node:vm');
const { createEditor } = require('./editor-save.test.cjs');

function popup() {
  const elements = new Map();
  function element(tag) {
    const node = {
      value: '',
      listeners: {},
      children: [],
      appendChild(child) {
        this.children.push(child);
        if (child.id) {
          elements.set(child.id, child);
        }
      },
      setAttribute() {},
      focus() {},
      addEventListener(name, callback) {
        this.listeners[name] = callback;
      },
    };
    elements.set(tag, node);
    return node;
  }
  return {
    closed: false,
    focus() {
      this.focused = true;
    },
    close() {
      this.closed = true;
    },
    document: {
      documentElement: {},
      head: element('head'),
      body: element('body'),
      createElement: element,
      getElementById: (id) => elements.get(id),
      querySelector: (tag) => elements.get(tag),
    },
  };
}

for (const type of ['dynamic', 'architecture']) {
  const editor = createEditor(undefined, [], type);
  const windows = [];
  editor.context.open = () => {
    const window = popup();
    windows.push(window);
    return window;
  };
  editor.context.document.querySelector = () => ({ textContent: '문법 안내' });
  editor.elements.get('open-source-window').onclick();
  const source = windows[0].document.getElementById('popup-source');
  assert.equal(source.value, editor.elements.get('source').value);
  source.value = '// 팝업에서 작성 중';
  source.listeners.input();
  assert.equal(editor.elements.get('source').value, source.value);
  assert.equal(JSON.parse(editor.storage.get(type + '-project-v1')).tabs[0].source, source.value);
  editor.elements.get('source').value = '// 원래 창에서 변경';
  vm.runInContext('refresh()', editor.context);
  assert.equal(source.value, '// 원래 창에서 변경');
  vm.runInContext('addTab()', editor.context);
  assert.equal(source.value, '');
  editor.elements.get('open-source-window').onclick();
  assert.equal(windows.length, 1);
  assert.equal(windows[0].focused, true);
  editor.elements.get('open-guide-window').onclick();
  assert.equal(windows[1].document.querySelector('pre').textContent, '문법 안내');
  windows[0].close();
  editor.elements.get('open-source-window').onclick();
  assert.equal(windows.length, 3);
  windows[2].close();
  editor.context.open = () => null;
  editor.elements.get('open-source-window').onclick();
  assert.match(editor.alerts.at(-1), /팝업이 차단/);
}
console.log('PASS: popup source sync, tab switching, autosave, guide, reuse and blocked popup');
