# Market Intelligence Tracker

글로벌·한국 시장 환경과 추적 자산을 한 화면에서 관리하는 개인용 시장 정보 대시보드입니다. 현재 구현 범위는 Phase 5 News입니다.

## Phase 1

- 반응형 Dashboard / Reports / Watchlist / Admin 화면
- Cloudflare Worker API (`/api/health`, `/api/assets`, `/api/dashboard`)
- D1 기반 Assets CRUD와 Drizzle migration
- `ADMIN_TOKEN` 인증으로 쓰기 API 보호

## Phase 2

- Alpha Vantage 일봉 공급자와 수동 자산별 수집 API
- D1 `asset_prices`, `asset_indicators` 저장 및 날짜 중복 방지
- MA5/20/60/120/200, 괴리율, 기울기, 수익률, RSI14, ATR14, 거래량 비율, 벤치마크 상대강도 계산
- `GET /api/assets/:id/history` 및 Dashboard 실제 데이터 표시

## Phase 3

- Trend / Momentum / Risk / Relative / Composite 자산 점수
- Global / Korea / Overall 시장 점수와 Risk-On/Neutral/Risk-Off 구간
- D1 점수 이력과 1일·5일 변화 저장
- Admin 가중치 조회·수정·재계산

점수 이력은 자산 수집 시 최신 거래일을 하루 한 번 upsert하며 앞으로 누적됩니다. 과거 100일 전체 점수 재생산은 실제 분석 필요가 생길 때 별도 backfill 작업으로 추가합니다.

## Phase 4

- 발행 당시 시장 점수와 자산 지표를 보존하는 Daily Report Snapshot
- 날짜별 Report 목록·상세 API와 Reports 화면
- 같은 거래일 중복 발행 방지 및 기존 Snapshot 불변 유지
- Phase 7 Forecast 결과를 다음 거래일 가격과 연결할 저장·평가 경로

## Phase 5

- Alpha Vantage `NEWS_SENTIMENT` 자산별 수동 수집
- News Event·출처·자산 매핑과 반복 수집 중복 방지
- Sentiment·Impact·Confidence·Duration 분류 및 출처 신뢰도 반영
- 가격 점수와 분리된 News Score 및 가격/뉴스 Divergence 표시
- `GET /api/news`, `POST /api/admin/news/:id`, News 화면

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
| `ALPHA_VANTAGE_API_KEY` | 생성·설정됨 | 로컬 `.dev.vars`, 운영 Worker Secret |
| `CLOUDFLARE_D1_DATABASE_ID` | 설정됨 | Cloudflare 암호화 빌드 변수 |
| `DB` binding | 운영 연결됨 | `market-intelligence-tracker-db` |
| Telegram/메일 키 | Phase 8에서 결정 | Worker Secret |

비밀값의 실제 내용은 README, 커밋, 이슈에 기록하지 않습니다. 변경 이력과 다음 작업은 로컬 작업공간 루트의 `CODEX_PROGRESS.md`에 누적합니다.

## Git 기반 Cloudflare 배포

Cloudflare Workers Git 배포가 `main`에 연결되어 있습니다. 운영 URL은 `https://market-intelligence-tracker.sjsuk321.workers.dev`입니다.

- Build command: `npm ci && npm run build`
- Deploy command: `npx wrangler deploy --config dist/server/wrangler.json`
- Non-production deploy: `npx wrangler versions upload --config dist/server/wrangler.json`
- Build variable: `CLOUDFLARE_D1_DATABASE_ID=<생성한 D1 database ID>`
- Worker secret: `ADMIN_TOKEN=<.admin-token의 값>`

스키마 변경 배포 전 `npx wrangler d1 migrations apply DB --remote --config dist/server/wrangler.json`으로 새 migration을 원격 D1에 적용합니다. Cloudflare API 토큰을 GitHub 저장소에 넣는 방식은 사용하지 않습니다.

## 무료 플랜 주의사항

가격과 뉴스 수집은 같은 Alpha Vantage 무료 호출 한도를 공유합니다. 자산별 버튼을 필요할 때만 실행하고, MA120/200은 데이터가 충분히 누적될 때까지 `null`입니다. 시장별 심볼 지원과 데이터 이용 조건은 등록 전에 확인해야 합니다.
