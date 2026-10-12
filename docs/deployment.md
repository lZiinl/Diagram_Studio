# 팀 공유 및 배포

사내 SW 설계 용도로는 **사내 정적 웹 서버 또는 접근 제어가 설정된 GitLab Pages**를 권장합니다. 앱 백엔드는 필요하지 않습니다.

| 방법           | 준비                                  | 용도                                      |
| -------------- | ------------------------------------- | ----------------------------------------- |
| 사내 IIS/Nginx | dist 배포, HTTPS 및 사내 접근 권한    | 지속적인 팀 사용                          |
| GitLab Pages   | 관리자 Pages 설정, 프로젝트 접근 제어 | GitLab 계정 기반 팀 사용                  |
| GitHub Pages   | 요금제와 공개 범위 확인               | 공개 가능한 도구 또는 조직의 비공개 Pages |
| PC 임시 서버   | Node, 같은 네트워크와 포트 허용       | 시연                                      |

Git에 올리는 것만으로 사이트가 배포되지는 않습니다. GitHub 비공개 저장소라고 Pages 사이트까지 자동 비공개인 것은 아닙니다. 공식 문서: [GitHub Pages 생성](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site), [비공개 Pages 조건](https://docs.github.com/en/enterprise-cloud%40latest/pages/getting-started-with-github-pages/changing-the-visibility-of-your-github-pages-site), [GitLab 접근 제어](https://docs.gitlab.com/user/project/pages/pages_access_control/).

## 정식 배포

1. 저장소에 소스를 업로드합니다.
2. Node 22.13 이상과 pnpm 11.25.0에서 `pnpm install --frozen-lockfile`, `pnpm format:check`, `pnpm test`를 실행합니다. 설치하는 패키지는 개발용 포맷터이며 브라우저 실행에는 필요하지 않습니다.
3. `pnpm build`로 dist를 만듭니다.
4. **dist 내부 파일만** 사내 웹 서버에 배포합니다. 소스 저장소 전체를 웹 루트로 쓰지 않습니다.
5. 사내 HTTPS 주소를 팀원에게 공유합니다. `/diagram-studio/` 같은 하위 경로도 지원합니다.
6. 업데이트는 테스트·빌드 후 서버 배포 디렉터리를 새 산출물로 교체합니다.

dist는 Git에서 제외됩니다. check.yml은 검사를 수행하고 pages.yml은 main에 push할 때 테스트·빌드 후 dist를 GitHub Pages에 배포합니다. GitHub Settings → Pages → Source를 GitHub Actions로 설정하세요. Actions → Deploy GitHub Pages에서 진행 상태와 배포 주소를 확인할 수 있습니다. workflow_dispatch를 통해 main에서 수동 실행도 가능합니다. 실제 배포 성공 여부는 GitHub Actions 실행 결과로 확인해야 합니다.

## 임시 시연 (PowerShell)

```powershell
$env:HOST = '0.0.0.0'
$env:PORT = '8765'
npm start
```

팀원은 `http://서버PC의사내IP:8765`로 접속합니다. PC와 프로세스가 켜져 있고 회사 네트워크·방화벽에서 포트 접근이 가능해야 합니다. 이 개발 서버에는 로그인·HTTPS가 없으므로 허용된 사내 네트워크에서 임시 시연용으로 사용합니다. 기본 npm start는 127.0.0.1에만 바인딩합니다.

## 공동 사용 범위

- 같은 도구에 접속: 정적 호스팅으로 가능
- 도면 전달과 검토: .uml 파일 공유 또는 별도 팀 문서 저장소의 PR로 진행
- 중앙 문서 저장: 인증·DB·API 추가 필요
- 같은 도면 실시간 편집: 동기화·충돌 처리 추가 필요

현재 앱은 다이어그램 내용을 서버로 전송하지 않으며, 각자 브라우저의 자동 저장은 공유되지 않습니다. 회사 도면은 웹 배포 폴더가 아닌 팀 문서 저장소에서 관리하세요.
