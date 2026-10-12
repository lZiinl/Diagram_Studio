// 이 파일은 화면 이벤트와 브라우저 저장을 담당합니다.
// 문법 해석과 그림 생성은 diagram.js, 초기 소스는 example.js에서 제공합니다.
const STORAGE_KEY = 'dynamic-source';
const NAME_STORAGE_KEY = 'dynamic-name';
const DEFAULT_NAME = '새 다이어그램';
const MAX_PNG_DIMENSION = 8192;
const DEFAULT_PNG_SCALE = 2;

const getElement = (id) => document.getElementById(id);
let svgText = '';
let isValid = false;
let zoomPercent = 100;
let currentDiagramName = DEFAULT_NAME;
const PROJECT_STORAGE_KEY = 'dynamic-project-v1';
// 이전 사이트의 자동 저장은 읽기만 하며 새 키가 있으면 새 데이터를 우선합니다.
function readSavedValue(key) {
  return localStorage.getItem(key) ?? localStorage.getItem(key.replace(/^dynamic-/, 'sequence-'));
}
let project = null;
let projectAutoSave = true;
let draggedTabId = null;

function activeTab() {
  return project.tabs.find((tab) => tab.id === project.activeTabId);
}

// 소스가 파싱되지 않는 작성 중 상태도 탭 전환 시 그대로 보관합니다.
function captureActiveTab() {
  if (!project) {
    return;
  }
  const tab = activeTab();
  tab.name = getDiagramName();
  tab.source = getElement('source').value;
  tab.gap = Math.max(24, Math.min(240, Number(getElement('gap').value) || 42));
  tab.row = Math.max(30, Math.min(160, Number(getElement('row').value) || 48));
  tab.zoom = zoomPercent;
  project.name = getElement('project-name').value.trim() || '새 프로젝트';
}

function persistProject() {
  captureActiveTab();
  if (!projectAutoSave) {
    return;
  }
  try {
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
  } catch {
    getElement('status').textContent += ' · 프로젝트 자동 저장 불가';
  }
}

function renderTabs() {
  const container = getElement('diagram-tabs');
  container.replaceChildren();
  project.tabs.forEach((tab, index) => {
    const button = document.createElement('button');
    button.textContent = tab.name;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(tab.id === project.activeTabId));
    button.tabIndex = tab.id === project.activeTabId ? 0 : -1;
    button.onclick = () => switchTab(tab.id);
    button.ondblclick = renameTab;
    button.draggable = true;
    button.title = '드래그로 순서 변경';
    button.ondragstart = (event) => {
      draggedTabId = tab.id;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', tab.id);
    };
    button.ondragover = (event) => {
      if (draggedTabId) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }
    };
    button.ondrop = (event) => {
      event.preventDefault();
      reorderTab(draggedTabId, index);
      draggedTabId = null;
    };
    button.ondragend = () => {
      draggedTabId = null;
    };
    button.onkeydown = (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        return;
      }
      event.preventDefault();
      const count = project.tabs.length;
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? count - 1
            : (index + (event.key === 'ArrowRight' ? 1 : -1) + count) % count;
      switchTab(project.tabs[next].id);
      container.children[next].focus();
    };
    container.appendChild(button);
  });
  getElement('delete-tab').disabled = project.tabs.length === 1;
}

/** 탭을 지정한 순서로 옮기고 저장합니다. 선택된 탭과 작성 중 소스는 유지합니다. */
function reorderTab(id, destination) {
  const origin = project.tabs.findIndex((tab) => tab.id === id);
  if (
    origin < 0 ||
    destination < 0 ||
    destination >= project.tabs.length ||
    origin === destination
  ) {
    return;
  }
  captureActiveTab();
  const [tab] = project.tabs.splice(origin, 1);
  project.tabs.splice(destination, 0, tab);
  persistProject();
  renderTabs();
}

function showActiveTab() {
  const tab = activeTab();
  getElement('source').value = tab.source;
  currentDiagramName = tab.name;
  getElement('project-name').value = project.name;
  getElement('gap').value = String(tab.gap);
  getElement('row').value = String(tab.row);
  getElement('zoom').value = String(tab.zoom);
  zoomPercent = tab.zoom;
  // 다른 탭의 그림을 현재 탭의 결과로 오해하지 않도록 미리보기를 초기화합니다.
  svgText = '';
  getElement('diagram').innerHTML = '';
  updateDiagramName();
  renderTabs();
  refresh();
}

function switchTab(id) {
  captureActiveTab();
  project.activeTabId = id;
  showActiveTab();
}

function addTab() {
  captureActiveTab();
  const tab = DiagramProject.createTab(`다이어그램 ${project.tabs.length + 1}`, '');
  project.tabs.push(tab);
  project.activeTabId = tab.id;
  showActiveTab();
}

function duplicateTab() {
  // 파싱 오류가 있는 작성 중 소스도 현재 화면 설정과 함께 복제합니다.
  captureActiveTab();
  const original = activeTab();
  let suffix = ' (복사본)';
  let name = original.name.slice(0, 120 - suffix.length) + suffix;
  let number = 2;
  while (project.tabs.some((tab) => tab.name === name)) {
    suffix = ` (복사본 ${number++})`;
    name = original.name.slice(0, 120 - suffix.length) + suffix;
  }
  const copy = DiagramProject.createTab(name, original.source);
  copy.gap = original.gap;
  copy.row = original.row;
  copy.zoom = original.zoom;
  const index = project.tabs.indexOf(original);
  project.tabs.splice(index + 1, 0, copy);
  project.activeTabId = copy.id;
  showActiveTab();
}

function renameTab() {
  const name = prompt('다이어그램 탭 이름을 입력하세요.', getDiagramName());
  if (name === null || !name.trim()) {
    return;
  }
  currentDiagramName = name.trim().slice(0, 120);
  updateDiagramName();
}

function deleteTab() {
  if (project.tabs.length === 1 || !confirm(`“${getDiagramName()}” 탭을 삭제할까요?`)) {
    return;
  }
  const index = project.tabs.findIndex((tab) => tab.id === project.activeTabId);
  project.tabs.splice(index, 1);
  project.activeTabId = project.tabs[Math.min(index, project.tabs.length - 1)].id;
  showActiveTab();
}

function restoreProject() {
  // 기존 단일 다이어그램을 첫 탭으로 이관하며 이전 저장 키도 남겨 둡니다.
  project = DiagramProject.create('새 프로젝트', getElement('source').value, getDiagramName());
  try {
    const stored = readSavedValue(PROJECT_STORAGE_KEY);
    if (stored) {
      project = DiagramProject.parse(stored);
    }
  } catch {
    // 손상된 프로젝트를 초기 상태로 덮어쓰지 않습니다.
    projectAutoSave = false;
    alert(
      '저장된 프로젝트를 읽지 못했습니다. 기존 데이터는 보존됩니다. 작업은 프로젝트 저장으로 백업해 주세요.',
    );
  }
  showActiveTab();
}

async function saveProject() {
  captureActiveTab();
  const contents = JSON.stringify(project, null, 2);
  try {
    await DiagramFileSave.save({
      name: project.name,
      extension: '.json',
      mimeType: 'application/json',
      description: 'Diagram Studio 프로젝트',
      createBlob: () => new Blob([contents], { type: 'application/json' }),
    });
  } catch (error) {
    alert('프로젝트 저장에 실패했습니다: ' + error.message);
  }
}

async function importProject() {
  const file = getElement('project-file').files[0];
  if (!file) {
    return;
  }
  try {
    const imported = DiagramProject.parse(await file.text());
    if (
      !confirm(
        '현재 프로젝트를 불러온 프로젝트로 바꿀까요? 필요한 작업은 먼저 프로젝트 저장으로 보관하세요.',
      )
    ) {
      return;
    }
    project = imported;
    projectAutoSave = true;
    showActiveTab();
  } catch (error) {
    alert('프로젝트를 불러오지 못했습니다: ' + error.message);
  } finally {
    getElement('project-file').value = '';
  }
}

function restoreSource() {
  currentDiagramName = DEFAULT_NAME;
  try {
    const savedSource = readSavedValue(STORAGE_KEY);
    // 과거 기본 예제만 공백을 정리합니다. 사용자가 수정한 작업은 유지합니다.
    const withoutBlankLines = (value) =>
      value
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .join('\n');
    const isOldExample =
      savedSource && withoutBlankLines(savedSource) === withoutBlankLines(example);
    getElement('source').value = !savedSource || isOldExample ? example : savedSource;
    currentDiagramName = readSavedValue(NAME_STORAGE_KEY) || DEFAULT_NAME;
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
  return currentDiagramName.trim() || DEFAULT_NAME;
}

function updateDiagramName() {
  document.title = `${getDiagramName()} · 다이나믹 다이어그램 · Diagram Studio`;
  try {
    localStorage.setItem(NAME_STORAGE_KEY, getDiagramName());
  } catch {
    // 저장소가 비활성화되어도 이름을 지정하고 파일로 저장할 수 있습니다.
  }
  if (project) {
    persistProject();
    renderTabs();
  }
}

function applyPreviewZoom() {
  const svg = getElement('diagram').firstElementChild;
  const input = getElement('zoom').value;
  const requestedPercent = Number(input);
  // 숫자를 지우고 다시 입력하는 동안은 마지막 배율을 유지합니다.
  if (input !== '' && Number.isFinite(requestedPercent)) {
    zoomPercent = Math.max(50, Math.min(200, requestedPercent));
  }
  if (!svg) {
    return;
  }
  const zoom = zoomPercent / 100;

  // 미리보기 크기만 조절합니다. 내보내는 SVG의 원래 좌표와 크기는 유지합니다.
  svg.style.width = Number(svg.getAttribute('width')) * zoom + 'px';
  svg.style.height = Number(svg.getAttribute('height')) * zoom + 'px';
}

function normalizeZoomInput() {
  applyPreviewZoom();
  getElement('zoom').value = String(zoomPercent);
}

/** 미리보기의 가용 크기로 배율을 계산하고 현재 탭에 저장합니다. 원본 SVG는 유지합니다. */
function fitPreviewToScreen() {
  const svg = getElement('diagram').firstElementChild;
  if (!svg) {
    return;
  }
  const canvas = getElement('canvas');
  const style = getComputedStyle(canvas);
  // 스크롤바와 안쪽 여백을 제외하고 가로·세로 중 더 작은 배율을 사용합니다.
  const width = canvas.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const height =
    canvas.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  if (width <= 0 || height <= 0) {
    return;
  }
  const percent = Math.floor(
    Math.min(
      width / Number(svg.getAttribute('width')),
      height / Number(svg.getAttribute('height')),
    ) * 100,
  );
  getElement('zoom').value = String(Math.max(50, Math.min(200, percent)));
  normalizeZoomInput();
  canvas.scrollLeft = 0;
  canvas.scrollTop = 0;
  persistProject();
}

/** 소스를 검증하고 미리보기를 갱신합니다. 오류 시 마지막 정상 그림을 유지합니다. */
function refresh() {
  EditorLayout.updateLineNumbers();
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
    const line = error.message.match(/^(\d+)행:/);
    EditorLayout.updateLineNumbers(line ? Number(line[1]) : 0);
    isValid = false;
    getElement('status').className = 'error';
    getElement('status').textContent = getElement('source').value.trim()
      ? error.message + (svgText ? ' (마지막 정상 미리보기 유지)' : '')
      : '새 탭에 다이어그램 소스를 입력하세요.';
  }

  // 잘못된 소스와 이전 그림이 혼동되지 않도록 오류 중에는 이미지 저장을 막습니다.
  getElement('svg').disabled = !isValid;
  getElement('png').disabled = !isValid;
  getElement('fit-view').disabled = !svgText;
  if (project) {
    persistProject();
  }
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
    currentDiagramName = name.slice(0, 120);
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
  for (const id of ['source', 'gap', 'row']) {
    getElement(id).addEventListener('input', refresh);
  }

  // 확대는 미리보기만 변경하므로 소스를 재해석하거나 자동 저장할 필요가 없습니다.
  getElement('zoom').addEventListener('input', () => {
    applyPreviewZoom();
    persistProject();
  });
  getElement('zoom').addEventListener('change', normalizeZoomInput);
  getElement('fit-view').onclick = fitPreviewToScreen;

  getElement('save').onclick = saveSource;
  getElement('svg').onclick = exportSvg;
  getElement('png').onclick = exportPng;
  getElement('example').onclick = restoreExample;
  getElement('load').onclick = () => getElement('file').click();
  getElement('file').onchange = importSource;
  getElement('source').addEventListener('keydown', insertIndent);
  getElement('project-name').addEventListener('input', persistProject);
  getElement('add-tab').onclick = addTab;
  getElement('duplicate-tab').onclick = duplicateTab;
  getElement('rename-tab').onclick = renameTab;
  getElement('delete-tab').onclick = deleteTab;
  getElement('save-project').onclick = saveProject;
  getElement('load-project').onclick = () => getElement('project-file').click();
  getElement('project-file').onchange = importProject;
}

restoreSource();
EditorLayout.initialize();
bindEvents();
restoreProject();
