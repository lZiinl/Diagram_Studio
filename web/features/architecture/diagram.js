// 아키텍처 예시 엔진: 문법 해석과 배치를 DOM에서 독립적으로 실행합니다.
(function (root) {
  'use strict';
  const defaultSignals = {
    normal: { name: '일반 신호', color: '#475569', style: 'solid' },
    fault: { name: '고장 신호', color: '#ef4444', style: 'solid' },
    hw: { name: 'HW–SW 인터페이스', color: '#16a34a', style: 'solid' },
  };
  const linePatterns = { solid: '', dashed: '8 5', dotted: '2 5', dashdot: '8 4 2 4' };
  const lineStyle = (signal) =>
    'stroke="' + signal.color + '" stroke-dasharray="' + linePatterns[signal.style] + '"';
  const escape = (text) =>
    String(text).replace(
      /[&<>"']/g,
      (character) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character],
    );

  /** 소스를 컴포넌트·포트·연결 모델로 해석하며 오류에 원본 행 번호를 붙입니다. */
  function parse(source) {
    const signals = new Map(
      Object.entries(defaultSignals).map(([id, signal]) => [id, { ...signal }]),
    );
    const declaredSignals = new Set();
    const components = [];
    const units = new Map();
    const ports = new Map();
    const links = [];
    const routes = new Map();
    const placements = new Map();
    const unitPlacements = new Map();
    let component = null;
    let unit = null;
    source.split(/\r?\n/).forEach((raw, index) => {
      const line = raw.trim();
      const fail = (message) => {
        throw new Error(`${index + 1}행: ${message}`);
      };
      if (!line || line.startsWith('//')) {
        return;
      }
      let match;
      if ((match = line.match(/^unitplace (\w+) x (\d+) y (\d+)$/))) {
        if (
          component ||
          unitPlacements.has(match[1]) ||
          Number(match[2]) > 10000 ||
          Number(match[3]) > 10000
        ) {
          fail('unitplace는 컴포넌트 밖에서 한 번만, 좌표 0~10000으로 지정하세요.');
        }
        unitPlacements.set(match[1], {
          x: Math.max(12, Number(match[2])),
          y: Math.max(42, Number(match[3])),
        });
      } else if ((match = line.match(/^place (\w+) column ([1-8]) y (\d+)$/))) {
        if (component || placements.has(match[1]) || Number(match[3]) > 10000) {
          fail('place는 컴포넌트 밖에서 한 번만, y는 0~10000으로 지정하세요.');
        }
        placements.set(match[1], { column: Number(match[2]), y: Number(match[3]) });
      } else if ((match = line.match(/^route (\w+\.\w+) ([A-Za-z_]\w*) (-?\d+) (-?\d+)$/))) {
        const key = match[1] + ':' + match[2];
        if (
          component ||
          routes.has(key) ||
          Math.abs(+match[3]) > 500 ||
          Math.abs(+match[4]) > 500
        ) {
          fail('route는 컴포넌트 밖에서 신호별 한 번만, 이동량 -500~500으로 지정하세요.');
        }
        routes.set(key, { x: +match[3], y: +match[4] });
      } else if (
        (match = line.match(
          /^signal ([A-Za-z_]\w*) "([^"\\]+)" (#[\da-fA-F]{6}) (solid|dashed|dotted|dashdot)$/,
        ))
      ) {
        if (component || declaredSignals.has(match[1])) {
          fail('신호 종류는 컴포넌트 밖에서 한 번만 정의하세요.');
        }
        declaredSignals.add(match[1]);
        signals.set(match[1], { name: match[2], color: match[3], style: match[4] });
      } else if (
        (match = line.match(/^component (\w+) "([^"]+)" (#[\da-fA-F]{6}) column (\d+) \{$/))
      ) {
        if (component || components.some((item) => item.id === match[1])) {
          fail('컴포넌트 중첩 또는 ID 중복');
        }
        if (+match[4] < 1 || +match[4] > 8) {
          fail('column은 1~8입니다.');
        }
        component = { id: match[1], name: match[2], color: match[3], column: +match[4], units: [] };
        components.push(component);
      } else if ((match = line.match(/^unit (\w+) "([^"]+)" (#[\da-fA-F]{6}) \{$/))) {
        if (!component || unit || units.has(match[1])) {
          fail('유닛의 소속 또는 ID를 확인하세요.');
        }
        unit = { id: match[1], name: match[2], color: match[3], ports: [], component };
        component.units.push(unit);
        units.set(unit.id, unit);
      } else if (
        (match = line.match(/^(in|out) (\w+)(?: "([^"]*)")?(?: signal ([A-Za-z_]\w*))?$/))
      ) {
        if (!unit) {
          fail('포트는 unit 안에 선언하세요.');
        }
        const id = `${unit.id}.${match[2]}`;
        if (ports.has(id)) {
          fail('포트 ID 중복');
        }
        const port = {
          id,
          direction: match[1],
          name: match[3] || '',
          unit,
          kind: match[4] || 'normal',
          line: index + 1,
        };
        unit.ports.push(port);
        ports.set(id, port);
      } else if (line === '}') {
        if (unit) {
          unit = null;
        } else if (component) {
          component = null;
        } else {
          fail('여는 괄호가 없습니다.');
        }
      } else if ((match = line.match(/^(\w+\.\w+) -> (\w+\.\w+)(?: ([A-Za-z_]\w*))?$/))) {
        if (component) {
          fail('연결은 컴포넌트 밖에 선언하세요.');
        }
        links.push({ from: match[1], to: match[2], kind: match[3] || 'normal', line: index + 1 });
      } else {
        fail('문법을 확인하세요.');
      }
    });
    if (component || unit) {
      throw new Error('닫는 괄호 }가 필요합니다.');
    }
    if (!components.length || components.some((item) => !item.units.length)) {
      throw new Error('컴포넌트마다 유닛이 필요합니다.');
    }
    for (const [id, placement] of unitPlacements) {
      const item = units.get(id);
      if (!item) {
        throw new Error('unitplace: 정의되지 않은 유닛 ' + id);
      }
      item.manualPosition = placement;
    }
    for (const [id, placement] of placements) {
      const item = components.find((candidate) => candidate.id === id);
      if (!item) {
        throw new Error('place: 정의되지 않은 컴포넌트 ' + id);
      }
      item.column = placement.column;
      item.manualY = Math.max(110, placement.y);
    }
    for (const port of ports.values()) {
      if (!signals.has(port.kind)) {
        throw new Error(port.line + '행: 정의되지 않은 신호 종류 ' + port.kind);
      }
    }
    for (const link of links) {
      if (!signals.has(link.kind)) {
        throw new Error(`${link.line}행: 정의되지 않은 신호 종류 ${link.kind}`);
      }
      const from = ports.get(link.from);
      const to = ports.get(link.to);
      if (!from || !to || from.direction !== 'out' || to.direction !== 'in') {
        throw new Error(`${link.line}행: out 포트에서 in 포트로 연결하세요.`);
      }
      if (from.unit.component.column >= to.unit.component.column) {
        throw new Error(`${link.line}행: 예시 버전은 오른쪽 열로 향하는 연결만 지원합니다.`);
      }
    }
    return { components, ports, links, signals, routes, placements, unitPlacements };
  }

  const lines = (text) => text.split('\\n');
  const textWidth = (text) =>
    Math.max(
      ...lines(text).map((line) =>
        [...line].reduce((width, character) => width + (character.charCodeAt(0) > 255 ? 13 : 7), 0),
      ),
    );

  /** 포트 수와 라벨 길이에 맞춰 박스를 확장하고 열별로 위에서 아래로 배치합니다. */
  function layout(model, options = {}) {
    const columnGap = Math.max(24, Math.min(240, Number(options.gap) || 42));
    const rowGap = Math.max(30, Math.min(160, Number(options.row) || 48));
    const columns = [...new Set(model.components.map((item) => item.column))].sort((a, b) => a - b);
    let x =
      30 +
      Math.max(
        0,
        ...[...model.ports.values()]
          .filter((port) => port.direction === 'in')
          .map((port) => textWidth(port.name)),
      );
    let height = 0;
    for (const column of columns) {
      const components = model.components.filter((item) => item.column === column);
      for (const component of components) {
        for (const unit of component.units) {
          unit.width = Math.max(160, textWidth(unit.name) + 28);
          unit.height = Math.max(
            100,
            lines(unit.name).length * 20 + 32,
            ...['in', 'out'].map(
              (direction) =>
                unit.ports.filter((port) => port.direction === direction).length * (rowGap * 0.75) +
                30,
            ),
          );
        }
        component.width = Math.max(
          textWidth(component.name) + 24,
          ...component.units.map((unit) =>
            unit.manualPosition ? unit.manualPosition.x + unit.width + 22 : unit.width + 44,
          ),
        );
      }
      // 지정한 높이를 우선하되, 같은 열의 박스는 순서를 정해 겹치지 않게 밀어냅니다.
      let automaticY = 110;
      for (const component of components) {
        component.desiredY = component.manualY ?? automaticY;
        automaticY +=
          42 +
          component.units.reduce((sum, unit) => sum + unit.height + rowGap / 2, 0) +
          (rowGap * 2) / 3;
      }
      components.sort((a, b) => a.desiredY - b.desiredY);
      const width = Math.max(...components.map((component) => component.width));
      let y = 110;
      let labelRight = x + width;
      for (const component of components) {
        y = Math.max(y, component.desiredY);
        component.x = x;
        component.y = y;
        component.width = width;
        let unitY = y + 42;
        for (const unit of component.units) {
          unit.x = x + (unit.manualPosition?.x ?? (width - unit.width) / 2);
          unit.y = unit.manualPosition ? y + unit.manualPosition.y : unitY;
          const inputs = unit.ports.filter((port) => port.direction === 'in');
          // 원래 높이에서 최대 48px만 늘려 가까운 송신 포트와 높이를 맞춥니다.
          // 긴 연결 때문에 뒤쪽 박스가 계속 커지지 않도록 확장 상한을 둡니다.
          const desiredInputs = inputs.map((port) => {
            const incoming = unit.manualPosition
              ? null
              : model.links.find((link) => link.to === port.id);
            return incoming ? model.ports.get(incoming.from).y : undefined;
          });
          const baseHeight = unit.height;
          const nearBottom = desiredInputs.filter(
            (value) => Number.isFinite(value) && value <= unit.y + baseHeight + 30,
          );
          unit.height = Math.max(
            baseHeight,
            Math.min(baseHeight + 48, Math.max(0, ...nearBottom) - unit.y + 18),
          );
          for (const direction of ['in', 'out']) {
            const ports = unit.ports.filter((port) => port.direction === direction);
            let previousY = unit.y;
            ports.forEach((port, index) => {
              port.x = direction === 'in' ? unit.x : unit.x + unit.width;
              const defaultY = unit.y + ((index + 1) * unit.height) / (ports.length + 1);
              const minimumY = previousY + 18;
              const maximumY = unit.y + unit.height - (ports.length - index) * 18;
              const desired = direction === 'in' ? desiredInputs[index] : undefined;
              port.y =
                Number.isFinite(desired) && desired >= minimumY && desired <= maximumY
                  ? desired
                  : Math.max(minimumY, Math.min(maximumY, defaultY));
              previousY = port.y;
              if (direction === 'out') {
                labelRight = Math.max(labelRight, port.x + 8 + textWidth(port.name));
              }
            });
          }
          unitY = Math.max(unitY, unit.y + unit.height + rowGap / 2);
        }
        component.height = unitY - y;
        y = unitY + (rowGap * 2) / 3;
      }
      // 라벨 구간 다음에 열별 전용 배선 구간을 둡니다. 선이 많아져도 레인을 재사용하지 않습니다.
      const outputKeys = [
        ...new Set(
          model.links
            .filter((link) => model.ports.get(link.from).unit.component.column === column)
            .map((link) => `${link.from}:${link.kind}`),
        ),
      ];
      const routeStart = labelRight + 28;
      for (const component of components) {
        component.routeStart = routeStart;
        component.routeKeys = outputKeys;
      }
      const nextColumn = columns[columns.indexOf(column) + 1];
      // 수신 열별로 서로 다른 신호의 진입 레인을 예약합니다.
      // 같은 출력·종류만 레인을 공유하며, 중간 열을 건너오는 신호도 포함합니다.
      const incomingKeys = [
        ...new Set(
          model.links
            .filter((link) => model.ports.get(link.to).unit.component.column === nextColumn)
            .map((link) => link.from + ':' + link.kind),
        ),
      ];
      for (const destination of model.components.filter((item) => item.column === nextColumn)) {
        destination.entryKeys = incomingKeys;
      }
      const inputSpace = Math.max(
        0,
        ...[...model.ports.values()]
          .filter((port) => port.direction === 'in' && port.unit.component.column === nextColumn)
          .map((port) => textWidth(port.name) + 16),
      );
      x =
        routeStart +
        Math.max(0, outputKeys.length - 1) * 24 +
        incomingKeys.length * 24 +
        inputSpace +
        columnGap +
        6;
      height = Math.max(height, y);
    }
    return { width: Math.max(720, x), height: height + 30 };
  }

  /** 세로 구간이 겹치지 않는 신호는 같은 레인을 재사용합니다. 단위는 SVG px입니다. */
  function allocateLanes(requests) {
    const lanes = [];
    const positions = new Map();
    for (const [key, range] of [...requests].sort((a, b) => a[1].low - b[1].low)) {
      let index = lanes.findIndex((end) => end + 16 < range.low);
      if (index < 0) {
        index = lanes.length;
      }
      lanes[index] = range.high;
      positions.set(key, index);
    }
    return { positions, count: lanes.length };
  }

  /** 확정된 포트 높이·우회·수동 이동 범위로 필요한 열 간격만 다시 계산합니다. */
  function compactColumns(model, detours, options) {
    const columns = [...new Set(model.components.map((item) => item.column))].sort((a, b) => a - b);
    const outgoing = new Map(columns.map((column) => [column, new Map()]));
    const incoming = new Map(columns.map((column) => [column, new Map()]));
    const extend = (requests, key, values) => {
      const old = requests.get(key);
      requests.set(key, {
        low: Math.min(old?.low ?? Infinity, ...values),
        high: Math.max(old?.high ?? -Infinity, ...values),
      });
    };
    for (const link of model.links) {
      const from = model.ports.get(link.from);
      const to = model.ports.get(link.to);
      const key = link.from + ':' + link.kind;
      const offset = model.routes.get(key) || { x: 0, y: 0 };
      const endY = detours.get(link) ?? to.y + offset.y;
      extend(outgoing.get(from.unit.component.column), key, [from.y + offset.y, endY]);
      if (endY !== to.y) {
        extend(incoming.get(to.unit.component.column), key, [to.y, endY]);
      }
    }
    const entry = new Map(columns.map((column) => [column, allocateLanes(incoming.get(column))]));
    let x = Math.min(...model.components.map((item) => item.x));
    let right = x;
    for (let index = 0; index < columns.length; index += 1) {
      const column = columns[index];
      const components = model.components.filter((item) => item.column === column);
      const output = allocateLanes(outgoing.get(column));
      let labelRight = x;
      for (const component of components) {
        const delta = x - component.x;
        component.x = x;
        component.routeLanes = output;
        component.entryLanes = entry.get(column);
        labelRight = Math.max(labelRight, x + component.width);
        for (const unit of component.units) {
          unit.x += delta;
          for (const port of unit.ports) {
            port.x += delta;
            if (port.direction === 'out') {
              labelRight = Math.max(labelRight, port.x + 8 + textWidth(port.name));
            }
          }
        }
      }
      const routeStart = labelRight + 28;
      components.forEach((component) => {
        component.routeStart = routeStart;
      });
      const next = columns[index + 1];
      const inputSpace = Math.max(
        0,
        ...[...model.ports.values()]
          .filter((port) => port.direction === 'in' && port.unit.component.column === next)
          .map((port) => textWidth(port.name) + 16),
      );
      right = labelRight + 30;
      x =
        routeStart +
        Math.max(0, output.count - 1) * 24 +
        (entry.get(next)?.count || 0) * 24 +
        inputSpace +
        Math.max(24, Math.min(240, Number(options.gap) || 42)) +
        6;
    }
    return Math.max(720, right);
  }

  /** 검증한 모델을 SVG로 변환합니다. 같은 출력·종류의 신호는 분기선을 공유합니다. */
  function render(model, options = {}) {
    const size = layout(model, options);
    // 여러 열을 건너뛰는 선은 중간 컴포넌트 전체를 장애물로 취급합니다.
    // 양쪽 열 사이의 빈 배선 영역에서 내려갔다 올라오므로 유닛 크기는 늘리지 않습니다.
    const detours = new Map();
    let detourIndex = 0;
    for (const link of model.links) {
      const from = model.ports.get(link.from);
      const target = model.ports.get(link.to);
      const between = model.components.filter(
        (item) =>
          item.column > from.unit.component.column && item.column < target.unit.component.column,
      );
      const offset = model.routes.get(link.from + ':' + link.kind) || { x: 0, y: 0 };
      const blocked = between.some(
        (item) =>
          (target.y >= item.y - 12 && target.y <= item.y + item.height + 12) ||
          (target.y + offset.y >= item.y - 12 && target.y + offset.y <= item.y + item.height + 12),
      );
      if (blocked) {
        const minimumY = Math.max(...between.map((item) => item.y + item.height)) + 24;
        const y = Math.max(minimumY, minimumY + detourIndex * 18 + offset.y);
        detours.set(link, y);
        detourIndex += 1;
        size.height = Math.max(size.height, y + 30);
      }
    }
    size.width = compactColumns(model, detours, options);
    const legendEntries = [...model.signals.values()];
    const legendWidths = legendEntries.map((signal) => Math.max(150, textWidth(signal.name) + 64));
    const legendWidth = 100 + legendWidths.reduce((sum, width) => sum + width, 0);
    size.width = Math.max(size.width, legendWidth + 60);
    const text = (value, x, y, anchor = 'middle', fontSize = 12) =>
      lines(value)
        .map(
          (line, index) =>
            `<text x="${x}" y="${y + index * 20}" text-anchor="${anchor}" font-size="${fontSize}">${escape(line)}</text>`,
        )
        .join('');
    // 수동 경로가 원래 캔버스 밖으로 나가도 내보내기에서 잘리지 않도록 여백을 확장합니다.
    const offsets = [...model.routes.values()];
    const left = Math.min(0, ...offsets.map((offset) => offset.x));
    const top = Math.min(0, ...offsets.map((offset) => offset.y));
    const extraRight = Math.max(0, ...offsets.map((offset) => offset.x));
    const extraBottom = Math.max(0, ...offsets.map((offset) => offset.y));
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width - left + extraRight}" height="${size.height - top + extraBottom}" viewBox="${left} ${top} ${size.width - left + extraRight} ${size.height - top + extraBottom}" font-family="Arial, sans-serif"><rect x="${left}" y="${top}" width="100%" height="100%" fill="white"/>`;
    // 배경을 먼저 그리고 포트와 라벨은 연결선 위에 표시합니다.
    for (const component of model.components) {
      svg += `<g data-component-box="${escape(component.id)}">`;
      svg += `<rect x="${component.x}" y="${component.y}" width="${component.width}" height="${component.height}" fill="${component.color}"/>`;
      svg +=
        '<g data-component-title="' +
        escape(component.id) +
        '"><title>박스 클릭 후 방향키로 이동</title>';
      svg +=
        '<rect x="' +
        component.x +
        '" y="' +
        component.y +
        '" width="' +
        component.width +
        '" height="36" fill="transparent"/>';
      svg += text(component.name, component.x + component.width / 2, component.y + 22) + '</g>';
      for (const unit of component.units) {
        svg += `<g data-unit-box="${escape(unit.id)}"><title>유닛 클릭 후 방향키로 이동</title>`;
        svg += `<rect x="${unit.x}" y="${unit.y}" width="${unit.width}" height="${unit.height}" fill="${unit.color}"/>`;
        svg += text(
          unit.name,
          unit.x + unit.width / 2,
          unit.y + unit.height / 2 - (lines(unit.name).length - 1) * 10 + 4,
        );
        svg += '</g>';
      }
      svg += '</g>';
    }
    const groups = new Map();
    for (const link of model.links) {
      const key = `${link.from}:${link.kind}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(link);
    }
    for (const links of groups.values()) {
      const from = model.ports.get(links[0].from);
      const targets = links.map((link) => model.ports.get(link.to));
      const component = from.unit.component;
      const lane = component.routeLanes.positions.get(`${links[0].from}:${links[0].kind}`);
      const key = links[0].from + ':' + links[0].kind;
      const offset = model.routes.get(key) || { x: 0, y: 0 };
      // 수동 좌표를 박스 사이의 안전한 배선 구간으로 제한합니다.
      // 우회 경로를 해제하지 않고 같은 기준점에 이동량을 적용합니다.
      const nextColumnX = Math.min(
        ...model.components
          .filter((item) => item.column > component.column)
          .map((item) => item.x - (item.entryLanes?.count || 0) * 24 - 12),
      );
      const trunk = Math.max(
        component.x + component.width + 12,
        Math.min(
          nextColumnX - 12,
          component.routeStart + lane * 24 + Math.max(-4, Math.min(4, offset.x)),
        ),
      );
      const hasDetour = links.some((link) => detours.has(link));
      const sourceExitX = hasDetour ? component.x + component.width + 12 : from.x + 16;
      const sourceY = from.y + offset.y;
      const targetYs = targets.map(
        (target, index) => detours.get(links[index]) ?? target.y + offset.y,
      );
      const signal = model.signals.get(links[0].kind);
      const color = signal.color;
      const ys = [sourceY, ...targetYs];
      // 포트 끝점은 고정하고 같은 신호의 중간 경로를 함께 이동합니다.
      let path = 'M ' + from.x + ' ' + from.y;
      if (offset.y) {
        path += ' H ' + sourceExitX + ' V ' + sourceY;
      }
      path += ' H ' + trunk;
      path += ' M ' + trunk + ' ' + Math.min(...ys) + ' V ' + Math.max(...ys);
      targets.forEach((target, index) => {
        path += ' M ' + trunk + ' ' + targetYs[index];
        if (detours.has(links[index]) || offset.y) {
          const destination = target.unit.component;
          const entryLane = destination.entryLanes.positions.get(key) ?? 0;
          // 24px 간격의 레인 안에서 ±4px까지 조정하여 다른 신호와 최소 16px를 유지합니다.
          const entryX = destination.x - 24 - entryLane * 24 + Math.max(-4, Math.min(4, offset.x));
          path += ' H ' + entryX + ' V ' + target.y;
        }
        path += ' H ' + target.x;
      });
      svg +=
        '<g data-route-key="' +
        escape(key) +
        '" data-source-lines="' +
        links.map((link) => link.line).join(',') +
        '">';
      svg += '<path d="' + path + '" ' + lineStyle(signal) + ' stroke-width="1.5" fill="none"/>';
      svg +=
        '<path class="route-hit" d="' +
        path +
        '" stroke="transparent" stroke-width="12" fill="none" pointer-events="stroke"/>';
      // 연결 개수가 아니라 실제 뻗는 방향 수를 셉니다. L자 굴곡은 2방향이므로 점을 찍지 않습니다.
      const top = Math.min(...ys);
      const bottom = Math.max(...ys);
      for (const y of new Set(ys)) {
        const directions =
          Number(y > top) +
          Number(y < bottom) +
          Number(y === sourceY) +
          Number(targetYs.includes(y));
        if (directions >= 3) {
          svg += `<circle cx="${trunk}" cy="${y}" r="3" fill="${color}"/>`;
        }
      }
      svg += '</g>';
    }
    const connectedPorts = new Set(model.links.flatMap((link) => [link.from, link.to]));
    for (const port of model.ports.values()) {
      // 연결 상대가 없는 포트도 외부 입출력임을 알 수 있도록 24px 길이의 선을 표시합니다.
      // 포트의 signal 지정이 없으면 normal 스타일을 사용합니다.
      if (!connectedPorts.has(port.id)) {
        const endX = port.x + (port.direction === 'in' ? -24 : 24);
        svg += `<path data-source-lines="${port.line}" data-external-port="${escape(port.id)}" d="M ${port.x} ${port.y} H ${endX}" ${lineStyle(model.signals.get(port.kind))} stroke-width="1.5" fill="none"/>`;
      }
      // 라벨 아래의 가는 배경 테두리는 지나가는 다른 신호선과 글자를 구분합니다.
      svg +=
        '<g paint-order="stroke" stroke="white" stroke-width="4" stroke-linejoin="round">' +
        text(
          port.name,
          port.x + (port.direction === 'out' ? 8 : -8),
          port.y - 7,
          port.direction === 'out' ? 'start' : 'end',
          11,
        ) +
        '</g>';
    }
    svg +=
      '<g aria-label="신호 종류 범례" transform="translate(' +
      (size.width - legendWidth - 60) +
      ' 0)"><rect x="30" y="20" width="' +
      legendWidth +
      '" height="56" rx="4" fill="white" stroke="#94a3b8"/>';
    svg += text('신호 종류', 46, 53, 'start');
    let legendX = 130;
    legendEntries.forEach((signal, index) => {
      svg += '<path d="M ' + legendX + ' 49 h 30" ' + lineStyle(signal) + ' stroke-width="2"/>';
      svg += text(signal.name, legendX + 38, 53, 'start');
      legendX += legendWidths[index];
    });
    return svg + '</g></svg>';
  }
  root.ArchitectureDiagram = { parse, render };
  if (typeof module !== 'undefined') {
    module.exports = root.ArchitectureDiagram;
  }
})(typeof window !== 'undefined' ? window : globalThis);
