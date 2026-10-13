// 이동량은 route 명령으로 소스에 기록하여 팝업·프로젝트·복제·내보내기에 함께 반영합니다.
(function (root) {
  let selected = null;
  let currentModel = null;
  let tabId = null;
  let callbacks;
  const element = (id) => document.getElementById(id);

  function updateSelection() {
    for (const group of element('diagram').querySelectorAll('[data-route-key]')) {
      group.classList.toggle('route-selected', group.dataset.routeKey === selected);
    }
  }

  function writeOffset(offset, all = false) {
    const source = element('source');
    const [port, kind] = (selected || '').split(':');
    const kept = source.value.split('\n').filter((line) => {
      const match = line.trim().match(/^route (\w+\.\w+) ([A-Za-z_]\w*) -?\d+ -?\d+$/);
      return !match || (!all && (match[1] !== port || match[2] !== kind));
    });
    if (offset && (offset.x || offset.y)) {
      kept.push(`route ${port} ${kind} ${offset.x} ${offset.y}`);
    }
    source.value = kept.join('\n');
    callbacks.refresh();
  }

  function move(x, y) {
    if (!selected || !currentModel) {
      return;
    }
    const previous = currentModel.routes.get(selected) || { x: 0, y: 0 };
    writeOffset({
      x: Math.max(-500, Math.min(500, previous.x + x)),
      y: Math.max(-500, Math.min(500, previous.y + y)),
    });
  }

  /** 클릭 선택과 키보드를 연결합니다. 포트 끝점은 렌더러가 고정합니다. */
  function initialize(options) {
    callbacks = options;
    element('diagram').addEventListener('click', (event) => {
      root.EditorLayout.highlightSource(event);
      const group = event.target.closest('[data-route-key]');
      selected = group ? group.dataset.routeKey : null;
      updateSelection();
      if (selected) {
        element('diagram').focus({ preventScroll: true });
      }
    });
    element('diagram').addEventListener('keydown', (event) => {
      const directions = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      if (!selected || !directions[event.key]) {
        return;
      }
      event.preventDefault();
      const step = event.shiftKey ? 10 : 2;
      move(...directions[event.key].map((value) => value * step));
    });
    element('routes-reset').onclick = () => {
      if (confirm('모든 선의 수동 위치를 자동 배치로 복원할까요?')) {
        writeOffset(null, true);
      }
    };
  }

  /** 탭 전환·소스 수정 시 유효한 선택만 유지하고 선택 강조를 다시 표시합니다. */
  function afterRender(model) {
    if (tabId !== callbacks.getTabId()) {
      selected = null;
      tabId = callbacks.getTabId();
    }
    currentModel = model;
    if (model && !model.links.some((link) => link.from + ':' + link.kind === selected)) {
      selected = null;
    }
    updateSelection();
  }
  root.ArchitectureRouteEditor = { initialize, afterRender };
})(typeof window !== 'undefined' ? window : globalThis);
