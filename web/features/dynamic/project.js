// 파일과 브라우저 저장소가 공유하는 프로젝트 형식입니다.
(function (root) {
  'use strict';
  let nextId = 0;

  function createTab(name, source) {
    return { id: `tab-${Date.now()}-${++nextId}`, name, source, gap: 42, row: 48, zoom: 100 };
  }

  function create(name, source, tabName = '다이어그램 1') {
    const tab = createTab(tabName, source);
    return { format: 'diagram-studio', version: 1, name, activeTabId: tab.id, tabs: [tab] };
  }

  /** 외부 파일을 검증하고 허용된 필드만 복사합니다. 기존 프로젝트는 변경하지 않습니다. */
  function parse(contents) {
    const value = JSON.parse(contents);
    const validName = (name) => typeof name === 'string' && name.trim() && name.length <= 120;
    if (
      !value ||
      value.format !== 'diagram-studio' ||
      value.version !== 1 ||
      !validName(value.name) ||
      !Array.isArray(value.tabs) ||
      !value.tabs.length
    ) {
      throw new Error('지원하지 않는 프로젝트 형식입니다.');
    }

    const ids = new Set();
    const tabs = value.tabs.map((tab) => {
      if (
        !tab ||
        typeof tab.id !== 'string' ||
        !tab.id ||
        ids.has(tab.id) ||
        !validName(tab.name) ||
        typeof tab.source !== 'string'
      ) {
        throw new Error('프로젝트의 탭 정보가 올바르지 않습니다.');
      }
      ids.add(tab.id);
      for (const [key, min, max] of [
        ['gap', 24, 240],
        ['row', 30, 160],
        ['zoom', 50, 200],
      ]) {
        if (!Number.isFinite(tab[key]) || tab[key] < min || tab[key] > max) {
          throw new Error('프로젝트의 화면 설정이 올바르지 않습니다.');
        }
      }
      return {
        id: tab.id,
        name: tab.name,
        source: tab.source,
        gap: tab.gap,
        row: tab.row,
        zoom: tab.zoom,
      };
    });
    if (!ids.has(value.activeTabId)) {
      throw new Error('선택된 탭을 찾을 수 없습니다.');
    }
    return {
      format: value.format,
      version: 1,
      name: value.name,
      activeTabId: value.activeTabId,
      tabs,
    };
  }

  root.DiagramProject = { create, createTab, parse };
  if (typeof module !== 'undefined') {
    module.exports = root.DiagramProject;
  }
})(typeof window !== 'undefined' ? window : globalThis);
