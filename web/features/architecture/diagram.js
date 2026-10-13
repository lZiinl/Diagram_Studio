// 아키텍처 예시 엔진: 문법 해석과 배치를 DOM에서 독립적으로 실행합니다.
(function (root) {
  'use strict';
  const colors = { normal: '#475569', fault: '#ef4444', hw: '#16a34a' };
  const escape = (text) =>
    String(text).replace(
      /[&<>"']/g,
      (character) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character],
    );

  /** 소스를 컴포넌트·포트·연결 모델로 해석하며 오류에 원본 행 번호를 붙입니다. */
  function parse(source) {
    const components = [];
    const units = new Map();
    const ports = new Map();
    const links = [];
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
      if ((match = line.match(/^component (\w+) "([^"]+)" (#[\da-fA-F]{6}) column (\d+) \{$/))) {
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
      } else if ((match = line.match(/^(in|out) (\w+)(?: "([^"]*)")?$/))) {
        if (!unit) {
          fail('포트는 unit 안에 선언하세요.');
        }
        const id = `${unit.id}.${match[2]}`;
        if (ports.has(id)) {
          fail('포트 ID 중복');
        }
        const port = { id, direction: match[1], name: match[3] || '', unit };
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
      } else if ((match = line.match(/^(\w+\.\w+) -> (\w+\.\w+)(?: (normal|fault|hw))?$/))) {
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
    for (const link of links) {
      const from = ports.get(link.from);
      const to = ports.get(link.to);
      if (!from || !to || from.direction !== 'out' || to.direction !== 'in') {
        throw new Error(`${link.line}행: out 포트에서 in 포트로 연결하세요.`);
      }
      if (from.unit.component.column >= to.unit.component.column) {
        throw new Error(`${link.line}행: 예시 버전은 오른쪽 열로 향하는 연결만 지원합니다.`);
      }
    }
    return { components, ports, links };
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
          ...component.units.map((unit) => unit.width + 44),
        );
      }
      const width = Math.max(...components.map((component) => component.width));
      let y = 110;
      let labelRight = x + width;
      for (const component of components) {
        component.x = x;
        component.y = y;
        component.width = width;
        let unitY = y + 42;
        for (const unit of component.units) {
          unit.x = x + (width - unit.width) / 2;
          unit.y = unitY;
          for (const direction of ['in', 'out']) {
            const ports = unit.ports.filter((port) => port.direction === direction);
            ports.forEach((port, index) => {
              port.x = direction === 'in' ? unit.x : unit.x + unit.width;
              // 기존 균등 배치로 유지합니다. 전역 높이 회피 때문에 박스를 늘리지 않습니다.
              port.y = unit.y + ((index + 1) * unit.height) / (ports.length + 1);
              if (direction === 'out') {
                labelRight = Math.max(labelRight, port.x + 8 + textWidth(port.name));
              }
            });
          }
          unitY += unit.height + rowGap / 2;
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
      const inputSpace = Math.max(
        0,
        ...[...model.ports.values()]
          .filter((port) => port.direction === 'in' && port.unit.component.column === nextColumn)
          .map((port) => textWidth(port.name) + 16),
      );
      x = routeStart + Math.max(0, outputKeys.length - 1) * 24 + inputSpace + columnGap + 6;
      height = Math.max(height, y);
    }
    return { width: Math.max(720, x), height: height + 30 };
  }

  /** 검증한 모델을 SVG로 변환합니다. 같은 출력·종류의 신호는 분기선을 공유합니다. */
  function render(model, options = {}) {
    const size = layout(model, options);
    const text = (value, x, y, anchor = 'middle', fontSize = 12) =>
      lines(value)
        .map(
          (line, index) =>
            `<text x="${x}" y="${y + index * 20}" text-anchor="${anchor}" font-size="${fontSize}">${escape(line)}</text>`,
        )
        .join('');
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}" font-family="Arial, sans-serif"><rect width="100%" height="100%" fill="white"/>`;
    // 배경을 먼저 그리고 포트와 라벨은 연결선 위에 표시합니다.
    for (const component of model.components) {
      svg += `<rect x="${component.x}" y="${component.y}" width="${component.width}" height="${component.height}" fill="${component.color}"/>`;
      svg += text(component.name, component.x + component.width / 2, component.y + 22);
      for (const unit of component.units) {
        svg += `<rect x="${unit.x}" y="${unit.y}" width="${unit.width}" height="${unit.height}" fill="${unit.color}"/>`;
        svg += text(
          unit.name,
          unit.x + unit.width / 2,
          unit.y + unit.height / 2 - (lines(unit.name).length - 1) * 10 + 4,
        );
      }
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
      const lane = component.routeKeys.indexOf(`${links[0].from}:${links[0].kind}`);
      const trunk = component.routeStart + lane * 24;
      const color = colors[links[0].kind];
      const ys = [from.y, ...targets.map((port) => port.y)];
      svg += `<path d="M ${from.x} ${from.y} H ${trunk} M ${trunk} ${Math.min(...ys)} V ${Math.max(...ys)}" stroke="${color}" stroke-width="1.5" fill="none"/>`;
      for (const target of targets) {
        svg += `<path d="M ${trunk} ${target.y} H ${target.x}" stroke="${color}" stroke-width="1.5" fill="none"/>`;
        if (targets.length > 1) {
          svg += `<circle cx="${trunk}" cy="${target.y}" r="3" fill="${color}"/>`;
        }
      }
    }
    for (const port of model.ports.values()) {
      svg += `<circle cx="${port.x}" cy="${port.y}" r="3" fill="white" stroke="#475569"/>`;
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
      '<g aria-label="신호 종류 범례"><rect x="30" y="20" width="650" height="56" rx="4" fill="white" stroke="#94a3b8"/>';
    svg += text('신호 종류', 46, 53, 'start');
    Object.entries(colors).forEach(([kind, color], index) => {
      const x = 120 + index * 180;
      svg += `<path d="M ${x} 49 h 30" stroke="${color}" stroke-width="2"/>`;
      svg += text(
        { normal: '일반 신호', fault: '고장 신호', hw: 'HW–SW 인터페이스' }[kind],
        x + 38,
        53,
        'start',
      );
    });
    return svg + '</g></svg>';
  }
  root.ArchitectureDiagram = { parse, render };
  if (typeof module !== 'undefined') {
    module.exports = root.ArchitectureDiagram;
  }
})(typeof window !== 'undefined' ? window : globalThis);
