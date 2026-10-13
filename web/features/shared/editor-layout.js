// 소스 줄 번호와 분할 창 크기는 다이어그램 문법·렌더링과 독립적으로 관리합니다.
(function (root) {
  'use strict';

  const DEFAULT_WIDTH = 312; // 기존 390px의 80%
  let WIDTH_KEY = 'dynamic-sidebar-width';
  let errorLine = 0;
  let measureElement = null;
  let selectedLines = new Set();
  let linePositions = [];
  let previousSource = null;

  function updateLineNumbers(line = 0) {
    errorLine = line;
    const source = document.getElementById('source');
    const gutter = document.getElementById('line-numbers');
    if (previousSource !== source.value) {
      selectedLines.clear();
      previousSource = source.value;
    }
    gutter.replaceChildren();
    if (measureElement) {
      // textarea의 좌우 padding(각 14px)을 제외한 실제 텍스트 폭입니다.
      measureElement.style.width = `${Math.max(1, source.clientWidth - 28)}px`;
    }
    let lineTop = 18;
    linePositions = [];
    source.value.split('\n').forEach((text, index) => {
      const number = document.createElement('div');
      number.textContent = index + 1;
      if (measureElement) {
        measureElement.textContent = text || '\u200b';
        number.style.height = `${Math.max(22, measureElement.getBoundingClientRect().height)}px`;
      }
      const height = parseFloat(number.style.height) || 22;
      linePositions.push({ top: lineTop, height });
      lineTop += height;
      if (selectedLines.has(index + 1)) {
        number.className = 'source-selected';
      }
      if (index + 1 === errorLine) {
        number.className = 'error-line';
      }
      gutter.appendChild(number);
    });
    gutter.scrollTop = source.scrollTop;
    paintHighlight();
  }

  // textarea의 실제 줄바꿈 높이로 배경을 칠합니다. 초점을 빼앗지 않아 선 이동 키가 유지됩니다.
  function paintHighlight() {
    const source = document.getElementById('source');
    const backgrounds = [...selectedLines]
      .map((line) => {
        const position = linePositions[line - 1];
        if (!position) {
          return '';
        }
        const top = position.top - (source.scrollTop || 0);
        return (
          'linear-gradient(to bottom, transparent ' +
          top +
          'px, #354774 ' +
          top +
          'px, #354774 ' +
          (top + position.height) +
          'px, transparent ' +
          (top + position.height) +
          'px)'
        );
      })
      .filter(Boolean);
    source.style.backgroundImage = backgrounds.join(',');
  }

  /** SVG의 원본 행 번호를 강조하고 첫 관련 행으로 스크롤합니다. 소스 내용은 변경하지 않습니다. */
  function highlightSource(event) {
    const group = event.target.closest('[data-source-lines]');
    selectedLines = new Set(
      (group?.dataset.sourceLines || '')
        .split(',')
        .map(Number)
        .filter((line) => line > 0),
    );
    updateLineNumbers(errorLine);
    const first = Math.min(...selectedLines);
    const position = linePositions[first - 1];
    if (position) {
      const source = document.getElementById('source');
      source.scrollTop = Math.max(0, position.top - 40);
      document.getElementById('line-numbers').scrollTop = source.scrollTop;
      paintHighlight();
    }
  }

  /** 화면 줄바꿈은 소스를 변경하지 않으며 행 번호는 원래 소스 행에 대응합니다. */
  function initialize(type = 'dynamic') {
    WIDTH_KEY = type + '-sidebar-width';
    if (type === 'dynamic') {
      document.getElementById('diagram').addEventListener('click', highlightSource);
    }
    document.getElementById('source').addEventListener('input', () => {
      selectedLines.clear();
      paintHighlight();
    });
    const source = document.getElementById('source');
    measureElement = document.createElement('div');
    measureElement.className = 'source-line-measure';
    document.body.appendChild(measureElement);
    if (typeof root.ResizeObserver === 'function') {
      const observer = new root.ResizeObserver(() => updateLineNumbers(errorLine));
      observer.observe(source);
    }
    source.addEventListener('scroll', () => {
      document.getElementById('line-numbers').scrollTop = source.scrollTop;
      paintHighlight();
    });
    const main = document.getElementById('editor-main');
    const splitter = document.getElementById('panel-splitter');
    let width = DEFAULT_WIDTH;
    try {
      width =
        Number(
          localStorage.getItem(WIDTH_KEY) ??
            (type === 'dynamic' ? localStorage.getItem('sequence-sidebar-width') : null),
        ) || DEFAULT_WIDTH;
    } catch {
      // 브라우저 저장이 차단되어도 드래그 조절은 가능합니다.
    }

    function applyWidth(requested) {
      const maximum = Math.max(220, main.clientWidth - 260);
      width = Math.max(220, Math.min(maximum, requested));
      main.style.setProperty('--sidebar-width', `${width}px`);
      splitter.setAttribute('aria-valuenow', String(Math.round(width)));
      splitter.setAttribute('aria-valuemin', '220');
      splitter.setAttribute('aria-valuemax', String(maximum));
      updateLineNumbers(errorLine);
    }

    function saveWidth() {
      try {
        localStorage.setItem(WIDTH_KEY, String(width));
      } catch {
        // 크기는 현재 창에서 계속 유지합니다.
      }
    }

    let dragging = false;
    splitter.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      dragging = true;
      splitter.setPointerCapture(event.pointerId);
    });
    splitter.addEventListener('pointermove', (event) => {
      if (dragging) {
        applyWidth(event.clientX - main.getBoundingClientRect().left);
      }
    });
    for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      splitter.addEventListener(eventName, () => {
        dragging = false;
        saveWidth();
      });
    }
    splitter.addEventListener('keydown', (event) => {
      if (['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) {
        event.preventDefault();
        applyWidth(
          event.key === 'Home' ? DEFAULT_WIDTH : width + (event.key === 'ArrowLeft' ? -10 : 10),
        );
        saveWidth();
      }
    });
    root.addEventListener('resize', () => applyWidth(width));
    applyWidth(width);
    updateLineNumbers();
  }

  root.EditorLayout = { initialize, updateLineNumbers, highlightSource };
})(typeof window !== 'undefined' ? window : globalThis);
