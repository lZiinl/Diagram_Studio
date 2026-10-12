// 이 파일은 화면 이벤트와 브라우저 저장을 담당합니다.
// 문법 해석과 그림 생성은 diagram.js, 초기 소스는 example.js에서 제공합니다.
const STORAGE_KEY = 'sequence-source';
const MAX_PNG_DIMENSION = 8192;
const DEFAULT_PNG_SCALE = 2;

const getElement = (id) => document.getElementById(id);
let svgText = '';
let isValid = false;

function restoreSource() {
  try {
    getElement('source').value = localStorage.getItem(STORAGE_KEY) || example;
  } catch {
    // 저장소 접근이 제한된 브라우저에서도 편집기는 사용할 수 있어야 합니다.
    getElement('source').value = example;
  }
}

function saveDraft() {
  try {
    localStorage.setItem(STORAGE_KEY, getElement('source').value);
  } catch {
    getElement('status').textContent += ' · 자동 저장 불가';
  }
}

function applyPreviewZoom() {
  const svg = getElement('diagram').firstElementChild;
  const zoom = Number(getElement('zoom').value);

  // 미리보기 크기만 조절합니다. 내보내는 SVG의 원래 좌표와 크기는 유지합니다.
  svg.style.width = Number(svg.getAttribute('width')) * zoom + 'px';
  svg.style.height = Number(svg.getAttribute('height')) * zoom + 'px';
}

/** 소스를 검증하고 미리보기를 갱신합니다. 오류 시 마지막 정상 그림을 유지합니다. */
function refresh() {
  try {
    const model = Diagram.parse(getElement('source').value);
    svgText = Diagram.render(model, {
      gap: getElement('gap').value,
      row: getElement('row').value,
    });

    getElement('diagram').innerHTML = svgText;
    applyPreviewZoom();

    const messageCount = model.events.filter((event) => event.from).length;
    getElement('status').className = '';
    getElement('status').textContent =
      `${model.components.length} 컴포넌트 · ${model.units.length} 유닛 · ${messageCount} 메시지`;
    isValid = true;
    saveDraft();
  } catch (error) {
    isValid = false;
    getElement('status').className = 'error';
    getElement('status').textContent = error.message + ' (마지막 정상 미리보기 유지)';
  }

  // 잘못된 소스와 이전 그림이 혼동되지 않도록 오류 중에는 이미지 저장을 막습니다.
  getElement('svg').disabled = !isValid;
  getElement('png').disabled = !isValid;
}

/** Blob을 로컬 파일로 내려받고 다운로드에 사용한 임시 URL을 해제합니다. */
function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();

  // 브라우저가 다운로드를 시작할 시간을 준 뒤 메모리를 반환합니다.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function saveSource() {
  const blob = new Blob([getElement('source').value], { type: 'text/plain;charset=utf-8' });
  download(blob, 'diagram.uml');
}

function exportSvg() {
  if (!isValid) {
    return;
  }

  download(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }), 'diagram.svg');
}

function downloadPngImage(image) {
  // 기본 2배 해상도를 사용하되 긴 다이어그램의 캔버스 크기는 제한합니다.
  const scale = Math.min(
    DEFAULT_PNG_SCALE,
    MAX_PNG_DIMENSION / Math.max(image.width, image.height),
  );
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(image.width * scale);
  canvas.height = Math.ceil(image.height * scale);
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);

  canvas.toBlob((blob) => {
    if (blob) {
      download(blob, 'diagram.png');
    } else {
      alert('PNG 변환에 실패했습니다. SVG로 저장해 주세요.');
    }
  }, 'image/png');
}

function exportPng() {
  if (!isValid) {
    return;
  }

  const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }));
  const image = new Image();

  image.onload = () => {
    try {
      downloadPngImage(image);
    } catch (error) {
      alert('PNG 저장 오류: ' + error.message);
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  image.onerror = () => {
    URL.revokeObjectURL(url);
    alert('이미지를 변환하지 못했습니다.');
  };

  image.src = url;
}

function restoreExample() {
  const sourceChanged = getElement('source').value !== example;
  if (
    sourceChanged &&
    !confirm('현재 소스를 기본 예제로 바꿀까요? 필요한 소스는 먼저 저장해 주세요.')
  ) {
    return;
  }

  getElement('source').value = example;
  refresh();
}

async function importSource() {
  const file = getElement('file').files[0];
  if (!file) {
    return;
  }

  getElement('source').value = await file.text();
  refresh();
  // 같은 파일을 다시 선택해도 change 이벤트가 발생하도록 초기화합니다.
  getElement('file').value = '';
}

function insertIndent(event) {
  if (event.key !== 'Tab') {
    return;
  }

  event.preventDefault();
  const textarea = event.target;
  textarea.setRangeText('  ', textarea.selectionStart, textarea.selectionEnd, 'end');
  refresh();
}

function bindEvents() {
  for (const id of ['source', 'gap', 'row', 'zoom']) {
    getElement(id).addEventListener('input', refresh);
  }

  getElement('save').onclick = saveSource;
  getElement('svg').onclick = exportSvg;
  getElement('png').onclick = exportPng;
  getElement('example').onclick = restoreExample;
  getElement('load').onclick = () => getElement('file').click();
  getElement('file').onchange = importSource;
  getElement('source').addEventListener('keydown', insertIndent);
}

restoreSource();
bindEvents();
refresh();
