# 구조와 확장

사내 명칭에 맞춰 화면·문서·폴더·파일명과 자동 저장 키를 **dynamic / 다이나믹 다이어그램**으로 통일합니다. 기존 `sequence` 주소는 배포 시 생성하는 이동 페이지와 개발 서버에서 새 주소로 연결합니다. 이전 자동 저장 키는 새 데이터가 없을 때 읽어 이관하며 원본은 삭제하지 않습니다.

프레임워크 없이 동작하는 정적 다중 페이지 앱입니다. 상대 링크와 일반 script를 사용하여 file:// 실행과 하위 경로 호스팅을 지원합니다.

- `web/diagram-hub.html`: 다이어그램 선택 화면
- `web/pages/<type>/<purpose>.html`: 편집 화면과 문법 안내
- `web/features/<type>/diagram.js`: DOM과 독립적인 파싱·검증·배치·SVG 생성
- `web/features/<type>/editor.js`: 입력, 파일 저장, 가져오기, 내보내기
- `web/features/dynamic/example.js`: 편집기와 테스트가 공유하는 기본 예제
- `web/features/dynamic/project.js`: 버전이 있는 프로젝트 JSON과 탭 모델의 생성·검증
- `web/assets/styles/`: 공통 및 편집기별 스타일
- `tests/`: 렌더링 회귀 테스트와 페이지 링크 검사
- `scripts/`: 개발 서버와 배포 파일 생성

새 편집기는 pages와 features에 유형별 폴더를 만들고 홈에 연결합니다. 해당 테스트를 tests에 추가하여 package.json의 test 명령에 연결합니다. 공통 내보내기 등은 두 편집기에서 실제로 필요해지는 시점에 features/shared로 추출합니다.

## SW 아키텍처 편집기

현재는 개발 범위 안내 페이지입니다. 향후 `component → unit → port` 구조와 `signal(sourcePort, targetPort, kind)` 연결 모델을 도입합니다. 시간축 기반 다이나믹 다이어그램과 분리된 렌더러가 필요합니다. 주요 구현 대상은 계층 배치, 직각 경로, 분기점, 라벨 충돌 방지, 신호 종류별 색상과 범례입니다.

## 저장

`dynamic-project-v1` 키는 프로젝트 이름, 선택된 탭 ID와 모든 탭의 소스·이름·간격·배율을 보관합니다. 기존 단일 작업은 첫 탭으로 이관됩니다. 내보내는 프로젝트 JSON은 `format: diagram-studio`, `version: 1`로 식별합니다. 불러온 파일은 전체를 검증한 다음 프로젝트를 교체하며, 작성 중 문법 오류가 있는 소스도 프로젝트에 저장할 수 있습니다.

기존 다이나믹 다이어그램 문법과 dynamic-source 저장 키를 유지합니다. localStorage는 브라우저·접속 출처에 종속되며 file://에서의 동작은 브라우저별로 다릅니다. 경로 변경 전에 기존 페이지에서 소스를 파일로 저장하고 새 편집기에서 불러오세요.

중앙 저장을 추가하려면 인증·문서별 권한·DB·저장 API가 필요합니다. 실시간 공동 편집에는 동기화와 충돌 처리도 필요하며 현재 구현 범위에는 없습니다.

## HTML 파일명

소스는 diagram-hub.html, dynamic-editor.html, architecture-overview.html처럼 목적을 드러내는 이름을 사용합니다. 로컬 실행 바로가기는 open-diagram-studio.html입니다. 배포 빌드는 GitHub Pages 루트 진입과 기존 북마크 호환을 위해 dist에만 index.html 리다이렉트를 생성합니다. 개발 서버도 기존 URL을 새 파일명으로 연결합니다.
