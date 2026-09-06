# Market Intelligence Tracker

글로벌·한국 시장 환경과 추적 자산을 한 화면에서 관리하는 개인용 시장 정보 대시보드입니다. 현재 구현 범위는 Phase 1 Foundation입니다.

## Phase 1

- 반응형 Dashboard / Reports / Watchlist / Admin 화면
- Cloudflare Worker API (`/api/health`, `/api/assets`, `/api/dashboard`)
- D1 기반 Assets CRUD와 Drizzle migration
- `ADMIN_TOKEN` 인증으로 쓰기 API 보호

화면의 시장 점수와 지표는 구조 확인용 예시값이며 실제 데이터 수집은 Phase 2에서 연결합니다.

## 로컬 실행

Node.js 22.13 이상이 필요합니다.

```powershell
npm install
npm run db:local
npm run dev
```

기본 개발 토큰은 `local-dev-only`입니다. 검증은 다음 명령으로 실행합니다.

```powershell
npm test
npx tsc --noEmit
npm run lint
npm run build
```

## Cloudflare Git 배포 준비값

| 이름 | 현재 상태 | 저장/설정 위치 |
|---|---|---|
| `ADMIN_TOKEN` | 생성됨 | 로컬 `.admin-token`에만 보관(Git 제외), 운영에서는 Worker Secret |
| `CLOUDFLARE_D1_DATABASE_ID` | D1 생성 후 필요 | Cloudflare 빌드 환경 변수 |
| `DB` binding | 코드 설정 완료 | 새 D1 데이터베이스에 연결 |
| 외부 시세 API 키 | Phase 2에서 결정 | Worker Secret |
| Telegram/메일 키 | Phase 8에서 결정 | Worker Secret |

비밀값의 실제 내용은 README, 커밋, 이슈에 기록하지 않습니다. 변경 이력과 다음 작업은 로컬 작업공간 루트의 `CODEX_PROGRESS.md`에 누적합니다.

## Git 기반 Cloudflare 배포

Cloudflare Workers의 Git 저장소 연결 화면에서 이 저장소를 선택한 뒤 다음처럼 설정합니다.

- Build command: `npm ci && npm run build`
- Deploy command: `npx wrangler deploy --config dist/server/wrangler.json`
- Build variable: `CLOUDFLARE_D1_DATABASE_ID=<생성한 D1 database ID>`
- Worker secret: `ADMIN_TOKEN=<.admin-token의 값>`

첫 배포 전 `drizzle/0000_sad_jetstream.sql`을 원격 D1에 한 번 적용해야 합니다. Cloudflare API 토큰을 GitHub 저장소에 넣는 방식은 사용하지 않습니다.

## 무료 플랜 주의사항

Phase 1은 Workers Free + D1 Free 범위에서 운영하도록 구성했습니다. 무료 플랜은 무제한이 아니며, 실제 데이터 제공자의 호출 한도와 재배포 라이선스는 Phase 2에서 별도로 확인합니다.
