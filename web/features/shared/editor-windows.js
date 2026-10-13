// 팝업은 원래 편집기의 상태를 공유합니다. 별도 저장본을 만들지 않아 두 창이 충돌하지 않습니다.
(function (root) {
  'use strict';
  let sourceWindow = null;
  let guideWindow = null;
  let callbacks;

  function createWindow(title) {
    const popup = root.open(
      '',
      '_blank',
      'popup,width=820,height=860,resizable=yes,scrollbars=yes',
    );
    if (!popup) {
      root.alert('팝업이 차단되었습니다. 이 사이트의 팝업을 허용한 뒤 다시 눌러 주세요.');
      return null;
    }
    // about:blank는 원래 창의 출처를 이어받으므로 로컬 파일 실행에서도 함께 편집할 수 있습니다.
    const document = popup.document;
    document.title = title;
    document.documentElement.lang = 'ko';
    const style = document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; }
      body { margin: 0; height: 100vh; display: flex; flex-direction: column;
        font: 14px 'Segoe UI', sans-serif; color: #213047; background: #f5f7fb; }
      header { padding: 14px 18px; display: flex; align-items: center; gap: 16px; background: white; }
      h1 { font-size: 16px; margin: 0; flex: 1; }
      button { padding: 6px 12px; border: 1px solid #d7dfeb; border-radius: 5px; background: white; cursor: pointer; }
      textarea { flex: 1; min-height: 0; margin: 12px 16px; padding: 18px; resize: none;
        border: 0; border-radius: 8px; background: #152034; color: #e6efff;
        font: 12px/22px Consolas, monospace; tab-size: 2; }
      pre { overflow: auto; padding: 20px; margin: 0; white-space: pre-wrap; font: 12px/22px 'Malgun Gothic', '맑은 고딕', sans-serif; tab-size: 2; }
      p { margin: 0; padding: 10px 18px; line-height: 1.6; }
      #popup-status { white-space: pre-wrap; }
    `;
    document.head.appendChild(style);
    const header = document.createElement('header');
    const heading = document.createElement('h1');
    heading.textContent = title;
    heading.id = 'popup-title';
    header.appendChild(heading);
    document.body.appendChild(header);
    return popup;
  }

  /** 원래 창의 현재 탭·소스를 팝업에 반영합니다. 값이 같으면 커서와 실행 취소 이력을 보존합니다. */
  function sync() {
    if (!sourceWindow || sourceWindow.closed) {
      return;
    }
    const document = sourceWindow.document;
    const textarea = document.getElementById('popup-source');
    const source = root.document.getElementById('source');
    if (textarea.value !== source.value) {
      textarea.value = source.value;
    }
    const title = callbacks.getTitle() + ' · 소스 편집';
    document.title = title;
    document.getElementById('popup-title').textContent = title;
    document.getElementById('popup-status').textContent =
      root.document.getElementById('status').textContent;
  }

  function openGuide() {
    if (guideWindow && !guideWindow.closed) {
      guideWindow.focus();
      return;
    }
    guideWindow = createWindow(callbacks.editorTitle + ' · 문법 가이드');
    if (!guideWindow) {
      return;
    }
    const pre = guideWindow.document.createElement('pre');
    pre.textContent = root.document.querySelector('aside details pre').textContent;
    guideWindow.document.body.appendChild(pre);
    const note = guideWindow.document.createElement('p');
    note.textContent =
      '가이드를 보면서 원래 편집기 또는 소스 새 창에서 수정하세요. 원래 편집기를 닫으면 이 창도 닫힙니다.';
    guideWindow.document.body.appendChild(note);
  }

  function openSource() {
    if (sourceWindow && !sourceWindow.closed) {
      sourceWindow.focus();
      sync();
      return;
    }
    sourceWindow = createWindow('소스 편집');
    if (!sourceWindow) {
      return;
    }
    const document = sourceWindow.document;
    const note = document.createElement('p');
    note.textContent =
      '현재 선택한 탭을 편집합니다. 변경 내용은 원래 창에 즉시 반영됩니다. 원래 편집기를 닫으면 이 창도 닫힙니다.';
    document.body.appendChild(note);
    const textarea = document.createElement('textarea');
    textarea.id = 'popup-source';
    textarea.spellcheck = false;
    textarea.setAttribute('aria-label', '다이어그램 소스');
    textarea.addEventListener('input', () => {
      root.document.getElementById('source').value = textarea.value;
      callbacks.refresh();
    });
    textarea.addEventListener('keydown', (event) => {
      if (event.key === 'Tab') {
        event.preventDefault();
        textarea.setRangeText('  ', textarea.selectionStart, textarea.selectionEnd, 'end');
        root.document.getElementById('source').value = textarea.value;
        callbacks.refresh();
      }
    });
    document.body.appendChild(textarea);
    const status = document.createElement('p');
    status.id = 'popup-status';
    status.setAttribute('role', 'status');
    document.body.appendChild(status);
    sync();
    textarea.focus();
  }

  /** 두 편집기가 동일한 팝업 UI를 사용하도록 현재 탭 조회와 갱신 함수를 연결합니다. */
  function initialize(options) {
    callbacks = options;
    root.document.getElementById('open-source-window').onclick = openSource;
    root.document.getElementById('open-guide-window').onclick = openGuide;
    root.addEventListener('pagehide', () => {
      if (sourceWindow && !sourceWindow.closed) {
        sourceWindow.close();
      }
      if (guideWindow && !guideWindow.closed) {
        guideWindow.close();
      }
    });
  }
  root.EditorWindows = { initialize, sync };
})(typeof window !== 'undefined' ? window : globalThis);
