// 이동량은 route 명령으로 소스에 기록하여 팝업·프로젝트·복제·내보내기에 함께 반영합니다.
(function (root) {
  let selected = null;
  let currentModel = null;
  let tabId = null;
  let callbacks;
  let selectedComponent = null;
  let selectedUnit = null;
  const element = (id) => document.getElementById(id);

  function updateSelection() {
    for (const box of element('diagram').querySelectorAll('[data-unit-box]')) {
      box.classList.toggle('unit-selected', box.dataset.unitBox === selectedUnit);
    }
    for (const box of element('diagram').querySelectorAll('[data-component-box]')) {
      box.classList.toggle('component-selected', box.dataset.componentBox === selectedComponent);
    }
    for (const group of element('diagram').querySelectorAll('[data-route-key]')) {
      group.classList.toggle('route-selected', group.dataset.routeKey === selected);
    }
  }

  function writeOffset(offset, all = false) {
    const source = element('source');
    const [port, kind] = (selected || '').split(':');
    const kept = source.value.split('\n').filter((line) => {
      if (all && /^unitplace \w+ x \d+ y \d+$/.test(line.trim())) {
        return false;
      }
      if (all && /^place \w+ column [1-8] y \d+$/.test(line.trim())) {
        return false;
      }
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

  /** 선택한 컴포넌트를 열 단위 또는 px 단위로 이동하고 소스에 저장합니다. */
  function moveComponent(horizontal, vertical) {
    const component = currentModel?.components.find((item) => item.id === selectedComponent);
    if (!component) {
      return;
    }
    // 역방향·같은 열 연결이 생기지 않도록 연결된 컴포넌트 사이의 열만 허용합니다.
    let minimum = 1;
    let maximum = 8;
    for (const link of currentModel.links) {
      const from = currentModel.ports.get(link.from).unit.component;
      const to = currentModel.ports.get(link.to).unit.component;
      if (to.id === component.id) {
        minimum = Math.max(minimum, from.column + 1);
      }
      if (from.id === component.id) {
        maximum = Math.min(maximum, to.column - 1);
      }
    }
    const column = Math.max(minimum, Math.min(maximum, component.column + horizontal));
    const y = Math.max(110, Math.min(10000, (component.manualY ?? component.y) + vertical));
    if (column === component.column && y === (component.manualY ?? component.y)) {
      return;
    }
    const source = element('source');
    const kept = source.value.split('\n').filter((line) => {
      const match = line.trim().match(/^place (\w+) column [1-8] y \d+$/);
      return !match || match[1] !== component.id;
    });
    kept.push('place ' + component.id + ' column ' + column + ' y ' + y);
    source.value = kept.join('\n');
    callbacks.refresh();
  }

  /** 유닛의 부모 기준 좌표를 저장합니다. 제목 영역과 다른 유닛 내부로의 이동은 막습니다. */
  function moveUnit(dx, dy) {
    const unit = currentModel?.components
      .flatMap((item) => item.units)
      .find((item) => item.id === selectedUnit);
    if (!unit) {
      return;
    }
    const component = unit.component;
    const x = Math.max(12, Math.min(10000, Math.round(unit.x - component.x + dx)));
    const y = Math.max(42, Math.min(10000, Math.round(unit.y - component.y + dy)));
    const overlaps = component.units.some(
      (other) =>
        other !== unit &&
        x + component.x < other.x + other.width + 8 &&
        x + component.x + unit.width + 8 > other.x &&
        y + component.y < other.y + other.height + 8 &&
        y + component.y + unit.height + 8 > other.y,
    );
    if (overlaps) {
      return;
    }
    const source = element('source');
    const kept = source.value.split('\n').filter((line) => {
      const match = line.trim().match(/^unitplace (\w+) x \d+ y \d+$/);
      return !match || match[1] !== unit.id;
    });
    kept.push('unitplace ' + unit.id + ' x ' + x + ' y ' + y);
    source.value = kept.join('\n');
    callbacks.refresh();
  }

  /** 클릭 선택과 키보드를 연결합니다. 포트 끝점은 렌더러가 고정합니다. */
  function initialize(options) {
    callbacks = options;
    element('diagram').addEventListener('click', (event) => {
      root.EditorLayout.highlightSource(event);
      const group = event.target.closest('[data-route-key]');
      selected = group ? group.dataset.routeKey : null;
      const unitBox = selected ? null : event.target.closest('[data-unit-box]');
      selectedUnit = unitBox?.dataset.unitBox || null;
      const box = selected || selectedUnit ? null : event.target.closest('[data-component-box]');
      selectedComponent = box?.dataset.componentBox || null;
      updateSelection();
      if (selected || selectedComponent || selectedUnit) {
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
      if ((!selected && !selectedComponent && !selectedUnit) || !directions[event.key]) {
        return;
      }
      event.preventDefault();
      const step = event.shiftKey ? 10 : 2;
      if (selectedUnit) {
        moveUnit(...directions[event.key].map((value) => value * step));
      } else if (selectedComponent) {
        moveComponent(directions[event.key][0], directions[event.key][1] * step);
      } else {
        move(...directions[event.key].map((value) => value * step));
      }
    });
    element('routes-reset').onclick = () => {
      if (confirm('모든 박스와 선의 수동 위치를 자동 배치로 복원할까요?')) {
        writeOffset(null, true);
      }
    };
  }

  /** 탭 전환·소스 수정 시 유효한 선택만 유지하고 선택 강조를 다시 표시합니다. */
  function afterRender(model) {
    if (tabId !== callbacks.getTabId()) {
      selectedComponent = null;
      selectedUnit = null;
      selected = null;
      tabId = callbacks.getTabId();
    }
    currentModel = model;
    if (model && !model.links.some((link) => link.from + ':' + link.kind === selected)) {
      selected = null;
    }
    if (!model?.components.some((item) => item.id === selectedComponent)) {
      selectedComponent = null;
    }
    if (!model?.components.some((item) => item.units.some((unit) => unit.id === selectedUnit))) {
      selectedUnit = null;
    }
    updateSelection();
  }
  root.ArchitectureRouteEditor = { initialize, afterRender };
})(typeof window !== 'undefined' ? window : globalThis);
