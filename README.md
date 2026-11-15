# Career OS

나의 경험을 다음 기회로 연결하는 한국어 개인 커리어 워크스페이스입니다. **현재 구현 범위는 Phase 1**입니다. 로그인, 서버 DB, 유료 API 없이 브라우저에 데이터를 저장합니다.

## 구현한 기능

- 프로필 생성·조회·수정·삭제: 연락처, 희망 직무, 소개, 핵심역량, 기술스택, 링크
- 경력 CRUD: 회사·부서·직책·재직 기간·담당업무·성과
- 프로젝트 CRUD: 경력 연결, 기간, 역할, 참여 인원, 기술, 문제·목표·기여·설계·기술 선택·해결 과정·성과·회고·자료 링크
- 프로젝트 검색, 진행 상태 필터, 상세 보기
- 실제 저장된 기록으로 계산하는 대시보드, 최근 프로젝트, 기록 점검
- IndexedDB 영속 저장, 다른 탭의 변경 반영, 입력 검증 및 저장 오류 안내
- JSON 백업 다운로드, 파일 검증, 교체 확인, 트랜잭션 기반 복원
- 반응형 레이아웃, 키보드 탐색, 대화상자 포커스 관리, 삭제·미저장 변경 확인
- GitHub Pages용 HashRouter, `/career-os/` base, 검사 후 배포 워크플로

기본 예시 데이터는 넣지 않았습니다. 통계는 빈 저장소에서 0으로 시작합니다. 테스트의 가상 데이터는 프로덕션 앱에 포함되지 않습니다.

## 기술 스택

React 19, Vite 8, TypeScript 6, Tailwind CSS 4, React Router 7, Lucide Icons, Dexie 4 + IndexedDB, Zod 4를 사용합니다. 공통 UI는 shadcn/ui의 로컬 소스 관리 방식에 맞춘 Radix Dialog/Slot + CVA 컴포넌트입니다. 외부 템플릿이나 유료 UI 서비스는 필요하지 않습니다. ESLint, Prettier, Vitest, fake-indexeddb, Playwright, axe-core로 검증합니다.

정확한 의존성 버전은 `package-lock.json`에 고정됩니다. 개발 도구의 `minimatch`에는 취약점 [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)의 수정 버전을 적용하는 override가 있습니다. 향후 상위 패키지에서 수정 버전을 채택하면 제거할 수 있습니다.

## 설치 및 실행

Node.js **22.18 이상인 22.x 또는 24 이상**과 npm이 필요합니다. CI는 Node 24를 사용합니다. 아래 명령어는 Windows PowerShell용입니다. `npm.ps1` 실행 정책을 변경할 필요 없이 `npm.cmd`를 사용합니다.

```powershell
Set-Location 'D:\personal_project\career-os'
npm.cmd ci
npm.cmd run dev
```

개발 주소: <http://127.0.0.1:5173/career-os/>. 포트가 사용 중이면 터미널에 표시된 주소를 사용하세요. 다른 운영체제에서는 `npm.cmd` 대신 `npm`, `npx.cmd` 대신 `npx`를 사용합니다.

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:e2e
npm.cmd run preview
```

프로덕션 미리보기: <http://127.0.0.1:4173/career-os/>. E2E 테스트 전에 반드시 빌드하세요. 테스트는 이 포트의 미리보기 서버를 자동으로 실행하고 종료합니다. 이미 해당 주소에서 프로젝트 미리보기가 실행 중이면 재사용합니다.

`npm.cmd run format`은 코드 정리, `npm.cmd run format:check`는 서식 검사입니다. Playwright는 일회성 테스트 브라우저 프로필을 사용하며 사용자가 입력한 브라우저 데이터를 건드리지 않습니다. `test-results/`, `playwright-report/`는 Git 제외 대상입니다.

## 폴더 구조

```text
.github/workflows/deploy.yml  # 검사, 빌드, GitHub Pages 배포
public/favicon.svg           # 공개 정적 리소스만 배치
src/
  app.tsx                    # 공통 레이아웃, HashRouter, 지연 로딩
  main.tsx
  styles.css                 # 디자인 토큰, 반응형 스타일
  components/
    ui/                      # 버튼, 필드, Dialog
    record-forms.tsx         # 프로필·경력·프로젝트 입력
    providers.tsx           # 저장소 상태, 알림, 오류 경계
  data/
    schema.ts                # Zod 스키마와 타입
    db.ts                    # Dexie 스키마 v1
    repository.ts            # CRUD 및 관계 처리
    backup.ts                # 검증, 백업, 원자적 복원
    summary.ts               # 실제 데이터 집계
    repository.test.ts       # 핵심 로직/저장소 테스트
  hooks/
  pages/                     # 대시보드, 경력, 프로젝트, 설정
tests/career-os.spec.ts       # 데스크톱/모바일 사용자 흐름
references/                  # 비공개 참고자료, Git/빌드 제외
private/                     # 로컬 분석 도구/자료, Git/빌드 제외
backups/                     # 개인 백업 보관용, Git/빌드 제외
```

## 데이터 구조와 Migration

**별도 Migration 명령어 불필요.** 앱 최초 실행 시 Dexie가 브라우저에 `career-os` DB의 버전 1을 생성합니다. 서버 DB나 Migration 도구는 없습니다. 이번 작업에서 기존 데이터의 초기화나 Migration 명령은 실행하지 않습니다.

| 테이블   | 내용                           | 키와 관계                            |
| -------- | ------------------------------ | ------------------------------------ |
| profiles | 개인 프로필 1개                | `id = profile`                       |
| careers  | 경력                           | UUID                                 |
| projects | 프로젝트와 문제 해결 기록      | UUID, 선택적 `careerId → careers.id` |
| settings | 마지막 백업 다운로드 요청 시각 | `id = settings`                      |

주요 기록에 `createdAt`·`updatedAt`을 ISO 형식으로 저장합니다. 기간은 `YYYY-MM`이며 진행 중인 항목의 종료일은 빈 문자열입니다. 경력 삭제는 연결된 프로젝트를 삭제하지 않고 `careerId`만 해제합니다. 저장과 관계 변경은 데이터 계층에서 수행합니다. 향후 동기화나 AI 기능을 추가할 때 UI와 데이터/분석 계층을 분리하여 확장할 수 있습니다.

스키마를 바꾸는 후속 개발에서는 `db.ts`에 새 버전을 추가하고 필요한 `upgrade` 로직과 보존 테스트를 작성해야 합니다. 백업의 `schemaVersion`도 함께 관리하세요. 현재는 v1 백업만 지원하며 알 수 없는 버전은 거절합니다.

## JSON 백업 및 복원

1. **설정 및 백업 → JSON 백업**을 눌러 다운로드합니다. `career-os-backup-날짜.json` 파일이 실제로 저장됐는지 확인하세요.
2. **파일 선택**에서 기존 백업을 선택합니다. 파일 크기(최대 5MB), JSON 형식, 버전, 필드, ID 중복, 경력 연결, URL, 기간을 먼저 검사합니다.
3. 대화상자에서 백업 기록 수와 현재 기록 수를 비교합니다. 현재 데이터를 먼저 백업하고 **백업으로 교체**를 누르면 전체 데이터를 교체합니다. 병합 기능은 없습니다.
4. 잘못된 파일이나 복원 중 저장 오류가 발생하면 기존 기록은 유지됩니다. 쓰기 오류 시 전체 트랜잭션을 롤백합니다.

백업에는 `app`, `schemaVersion`, `exportedAt`, `data.profiles`, `data.careers`, `data.projects`가 포함됩니다. 마지막 백업 요청 시각은 기기별 운영 정보라 백업하지 않으며 복원 시 초기화됩니다. 다운로드 성공 여부는 브라우저가 알려주지 않으므로 화면에는 **다운로드 요청 시각**으로 표시합니다.

## 개인정보와 보관 범위

- 앱 코드는 공개될 수 있지만, 사용자가 입력한 내용은 각 브라우저의 IndexedDB에만 저장됩니다. 분석·동기화 API, 추적 스크립트, 외부 폰트 요청을 사용하지 않습니다.
- 별도 로그인이나 저장소 암호화가 없습니다. 같은 기기·브라우저 프로필 사용자 및 같은 origin에서 실행되는 코드는 저장소에 접근할 수 있습니다. `ss0900.github.io`의 다른 프로젝트 페이지도 같은 origin임에 유의하세요.
- 저장소는 주소(origin)별로 분리됩니다. localhost, 127.0.0.1, 포트가 다른 개발 주소, GitHub Pages는 별개입니다. 데이터는 JSON으로 옮겨야 합니다.
- 브라우저 데이터 삭제, 저장소 정리, 시크릿 창 종료로 기록이 유실될 수 있습니다. 로컬 저장은 백업을 대신하지 않습니다. 서비스 워커/설치형 오프라인 앱은 아직 구현하지 않았습니다.
- 이름·연락처·내부 프로젝트 정보를 `src/`, `public/`, 테스트 파일에 넣지 마세요. 다운로드 파일은 암호화되지 않습니다. GitHub에 올리지 마세요.
- `/references/`, `/private/`, `/backups/`, `.env*`, 빌드·테스트 산출물은 `.gitignore`로 제외합니다. Vite 개발 서버도 참고자료/개인 폴더의 파일 접근을 차단합니다. 원본 참고자료는 수정하지 않았습니다.
- 외부 링크는 http/https만 허용하고 사용자 문장은 React 텍스트로 렌더링합니다. 파일/이미지 업로드 대신 자료 URL을 저장하며 자동으로 외부 자료를 불러오지 않습니다.
- 공개 포트폴리오는 미구현입니다. 후속 구현에서 사용자가 별도로 선택·검토한 스냅샷만 공개 빌드에 포함해야 합니다.

## GitHub Pages 배포

대상 저장소: <https://github.com/ss0900/career-os>

사용자 Push 후 배포 예정 주소: <https://ss0900.github.io/career-os/>

Pages Source는 이미 GitHub Actions로 설정된 상태를 전제로 합니다. 재설정 명령은 필요 없습니다. `vite.config.ts`의 `base`는 `/career-os/`이며, `#/career`, `#/projects`, `#/settings` URL의 직접 접근과 새로고침을 지원합니다.

워크플로는 `main` Push 또는 `workflow_dispatch` 시 설치 → 타입 검사 → 린트 → 단위 테스트 → 빌드 → Playwright 테스트 → `dist/` 업로드 → 배포를 수행합니다. PR에서는 검사만 실행합니다. 배포 권한은 배포 job에만 부여합니다. [Vite 배포 문서](https://vite.dev/guide/static-deploy.html)와 공식 [checkout](https://github.com/actions/checkout), [setup-node](https://github.com/actions/setup-node), [upload-pages-artifact](https://github.com/actions/upload-pages-artifact), [deploy-pages](https://github.com/actions/deploy-pages) 사용법을 기준으로 구성했습니다.

현재 로컬은 `main`, `origin=https://github.com/ss0900/career-os.git`, 아직 커밋이 없는 초기 저장소입니다. 다음 Git 변경 명령은 **사용자가 직접 실행**합니다. 실행 전 파일 목록을 확인하세요.

```powershell
git status --short --branch
git check-ignore references/wanted_resume_01.png references/wanted_resume_02.png references/wanted_resume_03.png references/wanted_portfolio.pdf private/pdf-tools backups/example.json
git ls-files -- references private backups .env
git add .gitignore .prettierignore .prettierrc.json README.md package.json package-lock.json index.html tsconfig.json vite.config.ts vitest.config.ts playwright.config.ts eslint.config.js .github public src tests
git diff --cached --name-only
git diff --cached --check
git commit -m "feat: implement career os phase 1"
git push -u origin main
```

- `status`: 현재 브랜치와 변경 파일 확인
- `check-ignore`: 참고자료·개인 폴더가 제외되는지 확인
- `ls-files`: 개인 자료가 이미 추적되는지 확인(현재 작업 기준 출력 없음)
- `add`: 구현 파일만 명시적으로 staging
- `diff --cached`: 커밋될 파일과 공백 오류 확인
- `commit`, `push`: 최초 커밋 및 원격 `main`으로 전송

staging 목록에 개인 자료가 보이면 커밋하지 말고 제외 상태를 먼저 수정하세요. 참고자료가 이미 추적되는 상황에서는 사용자가 해당 경로에 `git rm --cached`를 적용해야 합니다(원본은 보존). 이 프로젝트의 초기 점검에서는 추적 파일이 없었습니다. 원격이 이후 변경되어 Push가 거부되면 강제 Push하지 말고 변경 상태를 먼저 확인하세요.

Push 후 [Actions](https://github.com/ss0900/career-os/actions)의 **Verify and deploy Career OS** 실행에서 build/deploy 성공을 확인합니다. 실제 원격 배포 성공 여부는 로컬 검사로 확인할 수 없습니다.

## 테스트 범위

- Vitest: DB 재접속 후 유지, CRUD, 경력 삭제 시 연결 해제, 백업 왕복, 잘못된 버전·중복 ID·고아 관계·URL·기간 거절, 용량 제한, 복원 실패 롤백, 실제 데이터 집계
- Playwright: Chromium 데스크톱/모바일 화면, 프로필·경력·프로젝트 CRUD, 새로고침 유지, 검색/필터, 백업 다운로드/취소/복원, 잘못된 파일, 긴 텍스트, 텍스트 안전 렌더링, 미저장 변경 확인, axe 자동 접근성 검사
- Safari/Firefox, 실제 모바일 기기, 화면 읽기 프로그램 수동 검사 및 원격 GitHub Actions 실행은 별도 확인 대상입니다.

## 참고자료 반영 및 다음 단계

이력서 이미지 3장과 16쪽 포트폴리오 PDF를 확인했습니다. 프로필/핵심역량을 먼저 보여주고 회사 아래 프로젝트를 연결하는 계층, 역할·기술·기여·성과의 분리, 문제→기술 선택→해결→결과→회고 순서, 상세 설계 자료 링크 보관을 Phase 1 모델에 반영했습니다. 원본 이름·연락처·프로젝트 문구·수치·브랜드 디자인은 앱에 복사하지 않았습니다.

아래 기능은 아직 구현하지 않았습니다.

- Phase 2: 이력서 편집, 학력/자격증/언어, 프로젝트 선택·순서·섹션 표시, A4/PDF, 제출본 스냅샷·비교
- Phase 3: 채용공고·요구사항 근거 비교, 지원 칸반·이력·일정
- Phase 4: 면접 질문, STAR 답변 버전, ChatGPT 프롬프트, 피드백, 명시적 승인 기반 공개 포트폴리오

유료 API·DB·호스팅·도메인을 추가하지 않아 월 0원 운영을 목표로 합니다. 실제 사용 시 GitHub 계정의 Pages/Actions 사용 한도·과금 설정은 사용자 계정 기준으로 확인하세요. 외부 AI API나 유료 동기화 기능을 추가하는 경우에만 별도 비용 검토가 필요합니다.
