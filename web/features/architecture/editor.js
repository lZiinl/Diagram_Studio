// 공통 편집기에 아키텍처 엔진과 독립 저장 영역을 연결합니다.
const example = architectureExample;
globalThis.DiagramEditorConfig = {
  type: 'architecture',
  title: 'SW 아키텍처 다이어그램',
  engine: ArchitectureDiagram,
  initialize: (options) => ArchitectureRouteEditor.initialize(options),
  afterRender: (model) => ArchitectureRouteEditor.afterRender(model),
  summarize: (model) =>
    model.components.length +
    ' 컴포넌트 · ' +
    model.components.reduce((sum, component) => sum + component.units.length, 0) +
    ' 유닛 · ' +
    model.links.length +
    ' 연결',
};
