// DOM 없이 실행되는 시퀀스 엔진입니다. 브라우저와 Node 테스트에서 함께 사용합니다.
(function (root) {
  'use strict';

  const COLOR_PATTERN = '#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}';
  const COMPONENT_PATTERN = new RegExp(
    '^component\\s+"((?:\\\\.|[^"\\\\])*)"(?:\\s+(' + COLOR_PATTERN + '))?\\s*\\{$',
  );
  const UNIT_PATTERN = new RegExp(
    '^unit\\s+([A-Za-z_][\\w]*)\\s+"((?:\\\\.|[^"\\\\])*)"(?:\\s+(' +
      COLOR_PATTERN +
      '))?(?:\\s+io\\s+(' +
      COLOR_PATTERN +
      '))?$',
  );
  const MESSAGE_PATTERN = new RegExp(
    '^([A-Za-z_][\\w]*)\\s*(-->|<--|->|<-)\\s*([A-Za-z_][\\w]*)(?:\\s+(' +
      COLOR_PATTERN +
      '))?\\s*:\\s*(.+)$',
  );

  // 좌표와 여백의 단위는 SVG의 px입니다. 상단 박스와 메시지 영역을 분리합니다.
  const HEADER_TOP = 16;
  const UNIT_TOP = 49;
  const TEXT_LINE_HEIGHT = 20;
  // SVG 기본 단위는 px이며 기존 글꼴에 1pt(96/72px)를 더합니다.
  const FONT_INCREMENT = 4 / 3;
  const COMPONENT_PADDING = 20;

  function escapeXml(value) {
    const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
    return String(value).replace(/[&<>"']/g, (character) => entities[character]);
  }

  function decodeLabel(value) {
    return value.replace(/\\n/g, '\n').replace(/\\"/g, '"');
  }

  /**
   * 전용 UML 소스를 컴포넌트, 유닛, 이벤트 목록으로 변환합니다.
   * 이벤트는 메시지 또는 { space }이며, 오류는 원본 소스의 행 번호로 보고합니다.
   * @param {string} source 사용자가 입력한 다이어그램 소스
   * @returns {{components: Array, units: Array, events: Array}} 좌표 계산 전 모델
   */
  function parse(source) {
    const components = [];
    // 독립 유닛도 선언 순서대로 배치하되 실제 컴포넌트로 집계하거나 그리지 않습니다.
    const groups = [];
    const units = [];
    const events = [];
    let currentComponent = null;

    source.split(/\r?\n/).forEach((rawLine, lineIndex) => {
      const line = rawLine.trim();
      if (!line || line.startsWith('//') || line === '@startuml' || line === '@enduml') {
        return;
      }

      const fail = (message) => {
        throw Error(`${lineIndex + 1}행: ${message}`);
      };
      let match;

      if ((match = line.match(COMPONENT_PATTERN))) {
        if (currentComponent) {
          fail('컴포넌트 안에 컴포넌트를 넣을 수 없습니다.');
        }

        currentComponent = {
          name: decodeLabel(match[1]),
          color: match[2] || '#f8cfc8',
          units: [],
        };
        components.push(currentComponent);
        groups.push(currentComponent);
      } else if (line === '}') {
        if (!currentComponent) {
          fail('닫을 컴포넌트가 없습니다.');
        }
        currentComponent = null;
      } else if ((match = line.match(UNIT_PATTERN))) {
        if (units.some((unit) => unit.id === match[1])) {
          fail('중복된 유닛 ID: ' + match[1]);
        }

        const unit = {
          id: match[1],
          label: decodeLabel(match[2]),
          color: match[3] || '#ffebcc',
          ioColor: match[4] || '#ffebcc',
        };
        units.push(unit);
        if (currentComponent) {
          currentComponent.units.push(unit);
        } else {
          groups.push({ name: '', standalone: true, units: [unit] });
        }
      } else if ((match = line.match(MESSAGE_PATTERN))) {
        // 왼쪽 화살표도 실제 송신자와 수신자로 정규화해 동일한 렌더러를 사용합니다.
        const pointsLeft = match[2].startsWith('<');
        events.push({
          from: pointsLeft ? match[3] : match[1],
          to: pointsLeft ? match[1] : match[3],
          dashed: match[2] === '-->' || match[2] === '<--',
          color: match[4] || '#3030ff',
          label: decodeLabel(match[5]),
          line: lineIndex + 1,
        });
      } else if ((match = line.match(/^space\s+(\d+)$/))) {
        if (Number(match[1]) > 1000) {
          fail('space는 0~1000입니다.');
        }
        events.push({ space: Number(match[1]) });
      } else {
        fail('문법을 확인하세요. component, unit, 메시지 또는 space를 사용할 수 있습니다.');
      }
    });

    if (currentComponent) {
      throw Error('컴포넌트의 닫는 중괄호(})가 필요합니다.');
    }
    if (!units.length) {
      throw Error('unit을 하나 이상 선언하세요.');
    }
    if (components.some((component) => !component.units.length)) {
      throw Error('빈 컴포넌트에 unit을 추가하세요.');
    }

    // 선언이 메시지보다 뒤에 있어도 전체 소스의 유닛을 기준으로 검사합니다.
    for (const event of events) {
      if (
        event.from &&
        (!units.some((unit) => unit.id === event.from) ||
          !units.some((unit) => unit.id === event.to))
      ) {
        throw Error(`${event.line}행: 선언하지 않은 유닛이 있습니다.`);
      }
    }

    return { components, groups, units, events };
  }

  // 브라우저 폰트 측정 없이 동일한 배치를 얻기 위한 폭 근사치입니다.
  // 한글 등 비라틴 문자는 12px, 나머지는 7px로 계산합니다.
  function measureText(value) {
    return Array.from(value).reduce(
      (width, character) =>
        width + (/[^\x00-\xff]/.test(character) ? 12 : 7) * ((12 + FONT_INCREMENT) / 12),
      0,
    );
  }

  // Appl_WakeUpSleep(현재 글꼴 약 117px)에 좌우 여백을 포함한 공통 폭입니다.
  const UNIT_WIDTH = 160;

  function labelWidth(label) {
    return Math.max(...label.split('\n').map(measureText));
  }

  function fitComponent(component) {
    const first = component.units[0];
    const last = component.units.at(-1);
    const left = first.x - first.w / 2;
    const right = last.x + last.w / 2;
    component.w = Math.max(right - left + COMPONENT_PADDING * 2, labelWidth(component.name) + 24);
    component.x = (left + right - component.w) / 2;
  }

  function layoutHeaders(components) {
    let nextComponentX = 24;
    for (const component of components) {
      component.displayName = component.name;
      let cursor = nextComponentX + COMPONENT_PADDING;
      for (const unit of component.units) {
        unit.w = Math.max(UNIT_WIDTH, labelWidth(unit.label) + 26);
        unit.displayLabel = unit.label;
        unit.x = cursor + unit.w / 2;
        cursor += unit.w + 24;
      }
      fitComponent(component);
      const offset = nextComponentX - component.x;
      for (const unit of component.units) {
        unit.x += offset;
      }
      fitComponent(component);
      nextComponentX = component.x + component.w + 32;
    }
  }

  function fitMessages(components, units, events, unitsById, columnGap) {
    // 명시한 줄바꿈만 유지하고 긴 신호명은 가로 공간을 늘려 온전히 표시합니다.
    for (const event of events) {
      if (!event.from) {
        continue;
      }
      event.displayLabel = event.label;
      if (event.from === event.to) {
        continue;
      }
      const sourceIndex = units.indexOf(unitsById[event.from]);
      const targetIndex = units.indexOf(unitsById[event.to]);
      const left = Math.min(sourceIndex, targetIndex);
      const right = Math.max(sourceIndex, targetIndex);
      const extra = Math.max(0, labelWidth(event.label) + 36 - (units[right].x - units[left].x));
      for (let index = right; index < units.length; index++) {
        units[index].x += extra;
      }
    }
    // 사용자 간격은 최소 배치가 정해진 후 모든 열에 동일하게 더합니다.
    units.forEach((unit, index) => {
      unit.x += index * (columnGap - 24);
    });
    for (const component of components) {
      fitComponent(component);
    }
  }

  function layoutEvents(events, headerBottom, rowGap) {
    let nextMessageY = headerBottom + 56;

    for (const event of events) {
      // space는 좌표만 늘리고 화살표나 입출력 박스를 만들지 않습니다.
      if (event.space !== undefined) {
        nextMessageY += event.space;
        continue;
      }

      nextMessageY += Math.max(0, (event.displayLabel.split('\n').length - 1) * TEXT_LINE_HEIGHT);
      event.y = nextMessageY;
      nextMessageY += Math.max(rowGap, event.from === event.to ? 62 : 30);
    }

    return nextMessageY + 28;
  }

  function calculateCanvasWidth(components, events, unitsById) {
    const componentRight = Math.max(...components.map((component) => component.x + component.w));
    const selfCallOverflow = events
      // space의 from/to는 모두 undefined이므로 자기 호출 판정에서 반드시 제외합니다.
      .filter((event) => event.from !== undefined && event.from === event.to)
      .map(
        (event) =>
          unitsById[event.from].x +
          Math.max(65, Math.max(...event.displayLabel.split('\n').map(measureText)) + 30) +
          30 -
          componentRight,
      );

    return componentRight + 24 + Math.max(0, ...selfCallOverflow);
  }

  function renderText(label, x, y, anchor = 'middle', fill = '#111827', size = 12) {
    return label
      .split('\n')
      .map(
        (line, lineIndex) =>
          `<text x="${x}" y="${y + lineIndex * TEXT_LINE_HEIGHT}" ` +
          `text-anchor="${anchor}" fill="${fill}" font-family="Arial, sans-serif" ` +
          `font-size="${size + FONT_INCREMENT}">${escapeXml(line)}</text>`,
      )
      .join('');
  }

  function renderHeaders(components, unitHeight, headerBottom, unitTop) {
    let svg = '';

    for (const component of components) {
      if (!component.standalone) {
        svg +=
          `<rect x="${component.x}" y="${HEADER_TOP}" width="${component.w}" ` +
          `height="${headerBottom - HEADER_TOP}" fill="${component.color}"/>`;
        svg += renderText(component.displayName, component.x + component.w / 2, 34);
      }

      for (const unit of component.units) {
        svg +=
          `<rect x="${unit.x - unit.w / 2}" y="${unitTop}" width="${unit.w}" ` +
          `height="${unitHeight}" fill="${unit.color}"/>`;
        svg += renderText(unit.displayLabel, unit.x, unitTop + 22);
      }
    }

    return svg;
  }

  function renderMessage(event, unitsById) {
    const sourceX = unitsById[event.from].x;
    const targetX = unitsById[event.to].x;
    const messageY = event.y;
    const direction = targetX >= sourceX ? 1 : -1;
    const dashStyle = event.dashed ? 'stroke-dasharray="6 4"' : '';
    let endY = messageY;
    let svg = '';

    // 입출력 박스를 먼저 그리고 화살표 끝을 수신 박스의 바깥 경계에 연결합니다.
    endY = sourceX === targetX ? messageY + 25 : messageY;
    for (const [unit, boxY] of [
      [unitsById[event.from], messageY],
      [unitsById[event.to], endY],
    ]) {
      svg += `<rect data-role="io-box" x="${unit.x}" y="${boxY - 7.5}" width="14" height="15" fill="${unit.ioColor}"/>`;
    }
    const arrowStart = direction > 0 ? sourceX + 14 : sourceX;
    const arrowEnd = direction > 0 ? targetX : targetX + 14;

    if (sourceX === targetX) {
      // 자기 호출은 오른쪽으로 돌아오는 경로이며 수신 박스가 아래쪽에 놓입니다.
      endY = messageY + 25;
      const turnX =
        sourceX + Math.max(65, Math.max(...event.displayLabel.split('\n').map(measureText)) + 30);
      svg +=
        `<path d="M${sourceX + 14} ${messageY} H${turnX} V${endY} H${sourceX + 24}" ` +
        `fill="none" stroke="${event.color}" stroke-width="2" ${dashStyle}/>`;
      svg +=
        `<polygon points="${sourceX + 14},${endY} ${sourceX + 25},${endY - 5} ` +
        `${sourceX + 25},${endY + 5}" fill="${event.color}"/>`;
    } else {
      svg +=
        `<path d="M${arrowStart} ${messageY} H${arrowEnd - direction * 10}" ` +
        `stroke="${event.color}" stroke-width="2" ${dashStyle}/>`;
      svg +=
        `<polygon points="${arrowEnd},${messageY} ${arrowEnd - direction * 11},${messageY - 5} ` +
        `${arrowEnd - direction * 11},${messageY + 5}" fill="${event.color}"/>`;
    }

    svg += renderText(
      event.displayLabel,
      Math.min(sourceX, targetX) + 15,
      messageY - 8 - (event.displayLabel.split('\n').length - 1) * TEXT_LINE_HEIGHT,
      'start',
      '#111827',
      11,
    );

    return svg;
  }

  /**
   * 검증된 모델에 좌표(x, y)와 폭(w)을 추가하고 SVG 문자열을 반환합니다.
   * 입력 모델은 배치 계산 과정에서 변경됩니다. options.gap/row의 단위는 px입니다.
   */
  function render(model, options = {}) {
    const columnGap = Math.max(24, Math.min(240, Number(options.gap) || 42));
    const rowGap = Math.max(30, Math.min(160, Number(options.row) || 48));
    const { units, events } = model;
    const components = model.groups || model.components;
    const unitsById = Object.fromEntries(units.map((unit) => [unit.id, unit]));
    layoutHeaders(components);
    fitMessages(components, units, events, unitsById, columnGap);
    const titleLines = Math.max(
      1,
      ...components.map((component) => component.displayName.split('\n').length),
    );
    const unitTop = UNIT_TOP + (titleLines - 1) * TEXT_LINE_HEIGHT;
    const unitHeight = Math.max(
      70,
      ...units.map((unit) => unit.displayLabel.split('\n').length * TEXT_LINE_HEIGHT + 22),
    );
    const headerBottom = unitTop + unitHeight + 12;

    const height = layoutEvents(events, headerBottom, rowGap);
    const width = calculateCanvasWidth(components, events, unitsById);

    let svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
      `viewBox="0 0 ${width} ${height}" role="img" aria-label="소프트웨어 컴포넌트 시퀀스 다이어그램">` +
      '<rect width="100%" height="100%" fill="white"/>';
    svg += renderHeaders(components, unitHeight, headerBottom, unitTop);

    // 생명선을 먼저 그려 메시지와 입출력 박스가 그 위에 표시되게 합니다.
    for (const unit of units) {
      svg +=
        `<path d="M${unit.x} ${headerBottom} V${height - 16}" fill="none" ` +
        'stroke="#202020" stroke-width="2" stroke-dasharray="7 6"/>';
    }
    for (const event of events) {
      if (event.from) {
        svg += renderMessage(event, unitsById);
      }
    }

    return svg + '</svg>';
  }

  root.Diagram = { parse, render };
  if (typeof module !== 'undefined') {
    module.exports = root.Diagram;
  }
})(typeof window !== 'undefined' ? window : globalThis);
