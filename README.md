# Diagram Studio

SW 설계 문서용 텍스트 기반 다이어그램 편집기입니다. 외부 라이브러리와 서버 연결 없이 브라우저에서 동작합니다.

## 실행 및 검증

- 설치 없이 실행: 루트 index.html 또는 web/index.html을 브라우저에서 열기
- 개발 서버: Node 22 이상에서 `npm start` → http://127.0.0.1:8765
- 테스트: `npm test`
- 배포 산출물: `npm run build` → dist/

외부 패키지가 없어 npm install은 필요하지 않습니다. npm이 없는 환경에서는 `node scripts/serve.cjs`, `node tests/sequence.test.cjs`, `node tests/site.test.cjs`, `node scripts/build.cjs`를 각각 실행할 수 있습니다.

기존 작업은 이전 편집기에서 소스로 저장한 뒤 새 페이지에서 불러오세요. 파일 경로나 접속 주소가 바뀌면 브라우저 자동 저장이 이어지지 않을 수 있습니다.

## 페이지

| 페이지 | 상태 | 기능 |
| --- | --- | --- |
| 홈 | 사용 가능 | 다이어그램 선택 |
| 시퀀스 | 사용 가능 | 컴포넌트·유닛, 메시지, 점선, 입출력 박스, SVG/PNG |
| SW 아키텍처 | 개발 예정 안내 | 추후 포트·신호 연결 편집기 확장 |

## 파일 트리

```text
.
├── .github/workflows/check.yml  # 검사 CI (배포 없음)
├── docs/
│   ├── architecture.md          # 확장 구조
│   └── deployment.md            # 팀 배포 방법
├── scripts/
│   ├── build.cjs                # web → dist
│   └── serve.cjs                # 개발 서버
├── tests/
│   ├── sequence.test.cjs        # 렌더링 회귀 검사
│   └── site.test.cjs            # 링크·리소스 검사
├── web/                        # 웹사이트 루트
│   ├── assets/styles/          # 공통·편집기 CSS
│   ├── features/sequence/      # 렌더러·편집 로직
│   ├── pages/
│   │   ├── sequence/index.html
│   │   └── architecture/index.html
│   └── index.html              # 홈
├── .gitignore
├── index.html                  # 기존 진입 경로
├── package.json
└── README.md
```

## 시퀀스 문법

PlantUML과 유사한 전용 문법이며 전체 PlantUML과 호환되지 않습니다.

```text
component "입력" #dbeafe {
  unit input "Input\n(SWU101.1)" #d6ead0
}
component "출력" #f7ceca {
  unit output "Output" #ffebcc
}
input -> output #009900 : Signal
output --> input : Response
output -> output : Internal call
space 30
```

유닛 ID는 영문·밑줄로 시작하고 영문·숫자·밑줄을 사용합니다. 선언 순서가 열 순서입니다. 색상은 #RGB 또는 #RRGGBB, 줄바꿈은 \n, 여백은 space를 사용합니다.

## 팀 공유

빌드한 dist를 사내 웹 서버 등에 배포하면 모두 같은 URL로 사용할 수 있습니다. 현재는 각자 브라우저에서 편집하고 소스 파일로 공유합니다. 중앙 저장과 실시간 공동 편집은 아직 없습니다.

[팀 배포 안내](docs/deployment.md) · [아키텍처 및 확장 규칙](docs/architecture.md)

Git 원격 업로드와 실제 서버 배포는 수행하지 않았습니다.
