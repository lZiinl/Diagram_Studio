// 이 파일은 화면 이벤트와 브라우저 저장을 담당합니다.
// 문법 해석과 그림 생성은 diagram.js, 초기 소스는 example.js에서 제공합니다.
const STORAGE_KEY = 'sequence-source';
const NAME_STORAGE_KEY = 'sequence-name';
const DEFAULT_NAME = '새 다이어그램';
const MAX_PNG_DIMENSION = 8192;
const DEFAULT_PNG_SCALE = 2;

const getElement = (id) => document.getElementById(id);
let svgText = '';
let isValid = false;

function restoreSource() {
  getElement('diagram-name').value = DEFAULT_NAME;
  try {
    const savedSource = localStorage.getItem(STORAGE_KEY);
    // 과거 기본 예제만 공백을 정리합니다. 사용자가 수정한 작업은 유지합니다.
    const withoutBlankLines = (value) =>
      value
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .join('\n');
    const isOldExample =
      savedSource && withoutBlankLines(savedSource) === withoutBlankLines(example);
    getElement('source').value = !savedSource || isOldExample ? example : savedSource;
    getElement('diagram-name').value = localStorage.getItem(NAME_STORAGE_KEY) || DEFAULT_NAME;
  } catch {
    // 저장소 접근이 제한된 브라우저에서도 편집기는 사용할 수 있어야 합니다.
    getElement('source').value = example;
  }
}

function saveDraft() {
  try {
    localStorage.setItem(STORAGE_KEY, getElement('source').value);
    localStorage.setItem(NAME_STORAGE_KEY, getDiagramName());
  } catch {
    getElement('status').textContent += ' · 자동 저장 불가';
  }
}

function getDiagramName() {
  return getElement('diagram-name').value.trim() || DEFAULT_NAME;
}

function updateDiagramName() {
  document.title = `${getDiagramName()} · Diagram Studio`;
  try {
    localStorage.setItem(NAME_STORAGE_KEY, getDiagramName());
  } catch {
    // 저장소가 비활성화되어도 이름을 지정하고 파일로 저장할 수 있습니다.
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

/** 저장 위치 선택은 클릭 직후, 데이터 변환과 파일 쓰기는 그 이후에 수행합니다. */
async function saveDiagramFile(extension, mimeType, description, createBlob) {
  try {
    await DiagramFileSave.save({
      name: getDiagramName(),
      extension,
      mimeType,
      description,
      createBlob,
    });
  } catch (error) {
    alert('파일 저장에 실패했습니다: ' + error.message);
  }
}

function saveSource() {
  // 주석 메타데이터이므로 기존 문법과 호환되며 불러올 때 이름을 복원할 수 있습니다.
  const source = getElement('source').value.replace(/^\/\/ @diagram-name:.*(?:\r?\n)?/gm, '');
  const contents = '// @diagram-name: ' + JSON.stringify(getDiagramName()) + '\n' + source;
  return saveDiagramFile(
    '.uml',
    'text/plain',
    '다이어그램 소스',
    () => new Blob([contents], { type: 'text/plain;charset=utf-8' }),
  );
}

function exportSvg() {
  if (!isValid) {
    return;
  }

  const snapshot = svgText;
  return saveDiagramFile(
    '.svg',
    'image/svg+xml',
    'SVG 이미지',
    () => new Blob([snapshot], { type: 'image/svg+xml;charset=utf-8' }),
  );
}

/** 선택 창을 연 뒤 SVG 스냅샷을 PNG Blob으로 변환합니다. */
function createPngBlob(snapshot) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([snapshot], { type: 'image/svg+xml;charset=utf-8' }));
    const image = new Image();

    image.onload = () => {
      try {
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
            resolve(blob);
          } else {
            reject(new Error('PNG 변환에 실패했습니다. SVG로 저장해 주세요.'));
          }
        }, 'image/png');
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지를 변환하지 못했습니다.'));
    };
    image.src = url;
  });
}

function exportPng() {
  if (!isValid) {
    return;
  }

  const snapshot = svgText;
  return saveDiagramFile('.png', 'image/png', 'PNG 이미지', () => createPngBlob(snapshot));
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

  try {
    const contents = await file.text();
    const metadata = contents.match(/^\/\/ @diagram-name:(.*)$/m);
    let name = file.name.replace(/\.(uml|puml|txt)$/i, '');
    if (metadata) {
      try {
        const storedName = JSON.parse(metadata[1]);
        if (typeof storedName === 'string' && storedName.trim()) {
          name = storedName;
        }
      } catch {
        // 다른 도구에서 만든 주석은 그대로 두고 파일 이름을 사용합니다.
      }
    }
    getElement('source').value = contents;
    getElement('diagram-name').value = name.slice(0, 120);
    updateDiagramName();
    refresh();
  } catch (error) {
    alert('소스를 불러오지 못했습니다: ' + error.message);
  } finally {
    // 같은 파일을 다시 선택해도 change 이벤트가 발생하도록 초기화합니다.
    getElement('file').value = '';
  }
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
  getElement('diagram-name').addEventListener('input', updateDiagramName);
}

restoreSource();
updateDiagramName();
bindEvents();
refresh();
