# Market Intelligence Tracker

글로벌·한국 시장 환경과 추적 자산을 한 화면에서 관리하는 개인용 시장 정보 대시보드입니다. 현재 구현 범위는 Phase 13 Daily Decision Desk입니다.

## Phase 1

- 반응형 Dashboard / Reports / Watchlist / Admin 화면
- Cloudflare Worker API (`/api/health`, `/api/assets`, `/api/dashboard`)
- D1 기반 Assets CRUD와 Drizzle migration
- Cloudflare Worker Secret `ADMIN_PASSWORD` 인증으로 쓰기 API 보호 (`ADMIN_TOKEN`은 이전 배포 호환용)

## Phase 2

- KIS 한국 지수·주식·ETF 및 Alpha Vantage 글로벌 일봉 공급자와 수동 자산별 수집 API
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

- Alpha Vantage `NEWS_SENTIMENT` 자산별 수동 수집 + 평일 일일 1회 최신 뉴스 묶음 자동 수집
- News Event·출처·자산 매핑과 반복 수집 중복 방지
- Sentiment·Impact·Confidence·Duration 분류 및 출처 신뢰도 반영
- 가격 점수와 분리된 News Score 및 가격/뉴스 Divergence 표시
- `GET /api/news`, `POST /api/admin/news/:id`, News 화면

## Phase 6

- CPI·PPI·고용·FOMC·중앙은행·실적 등 예정 이벤트 CRUD
- 공식 출처, 영향 자산, 이전/예상/실제값, 상태와 Impact 0~100 관리
- `GET /api/calendar`, 인증된 `/api/admin/calendar`, Calendar 화면
- Reports 화면의 다가오는 주요 이벤트 노출

초기 일정은 BLS와 Federal Reserve의 2026년 공식 발표 캘린더를 기준으로 등록합니다. 일정 변경은 Admin 비밀번호 입력 후 Calendar에서 수정할 수 있으며 추가 API 토큰은 필요하지 않습니다.

## Phase 7

- 수익률·MA 괴리·RSI·ATR·거래량 비율 기반 Similar Historical Days
- 상위 20개 유사일의 실제 다음 거래일 수익률 저장
- 자산 점수·News Score·7일 내 예정 이벤트를 반영한 상승/하락 확률과 신뢰도
- 20/80 분위수 Expected Range와 Bull/Base/Bear 확률
- 매수·매도 명령 대신 관망·변동성 대비 등 대응 레벨 표시

Forecast는 Daily Report 생성 시 한 번 저장되며 이후 같은 리포트를 다시 열어도 결과가 바뀌지 않습니다. 비교 가능한 과거 데이터가 5일 미만인 자산은 예측을 만들지 않습니다.

## Phase 8

- Telegram 짧은 요약과 `/market`, `/global`, `/korea`, `/watch`, `/news`, `/events`, ticker 명령
- 무료 Resend HTTP API 또는 Cloudflare Email binding 기반 상세 리포트
- 채널별 활성 상태·발송 시각·시간대 Admin 설정
- 15분 Cron 확인, 리포트별 중복 발송 방지, 최근 Job/발송 결과 기록
- 비밀값 존재 여부만 Admin에 표시하며 실제 값은 Worker Secret으로만 보관

## Phase 9

- 30일·90일 Direction Accuracy와 Expected Range Hit Rate
- Risk-On / Risk-Off 다음 거래일 평균 성과
- 발행 시점 Composite Score 구간별 표본·평균 수익률·방향 적중률
- 최근 Forecast 평가 결과 20건

Analytics는 기존 Report Snapshot과 `forecast_results`를 읽기 전용으로 집계하므로 별도 migration이 없습니다. 다음 거래일 가격이 수집되어 평가된 Forecast부터 자동 반영됩니다.

## Phase 10

- `POST /api/admin/bootstrap`: 기준 명세 지표와 한국 대표 자산 23개를 API 호출 없이 중복 안전하게 등록
- `POST /api/admin/collect`: 중요도 순으로 최대 1~10개(화면 기본 5개) 일괄 수집
- Alpha Vantage 가격·뉴스 공용 25회/24시간 예산과 가격 18시간·뉴스 24시간 중복 호출 방지
- KOSPI·KOSDAQ·삼성전자·SK하이닉스·KODEX 반도체 및 글로벌 주식/ETF, FX, Crypto, Treasury Yield, WTI, Brent, Gold 응답 형식 지원
- US 10Y-2Y Spread를 저장된 두 금리에서 추가 API 호출 없이 계산
- VIX·DXY·US 2Y·US 10Y의 추세/모멘텀은 상승을 위험 증가 방향으로 반전해 점수 계산

KOSPI·KOSDAQ과 한국 대표 종목은 KIS 실제 일봉을 사용합니다. 한국 외국인 수급·시장폭은 응답 스키마를 실호출로 검증할 때까지 비활성 등록됩니다.

## Phase 11

- KIS OAuth와 국내주식·ETF·업종지수 일봉 조회 전용 연결
- KOSPI·KOSDAQ·삼성전자·SK하이닉스·KODEX 반도체 실제 원화 시세
- 한국 자산은 최대 260개 일봉을 채워 MA200 계산 기반 확보
- 주문·정정·취소·잔고·계좌 API와 계좌번호를 완전히 제외

## Phase 12

- 기준 명세의 Watchlist를 실제 활성 주식·ETF와 주요 ETF 프록시로 구성
- 현재가·등락률·Score·MA20/60/120/200·RSI·상대강도·News Score 표시
- 종목 선택 시 최근 60거래일 라인 차트와 최근 10개 일봉 상세 표시
- 기존 Dashboard 및 History API를 재사용하며 별도 의존성·DB migration 없음
- KIS 자산 5개를 한 요청에서 수집해 OAuth 토큰 발급을 한 번만 수행하는 Admin 전용 일괄 수집

## Phase 13

- KIS 조회 전용 API로 KOSPI·KOSDAQ 외국인/기관/개인 수급과 상승·하락 종목수 저장
- 국내 주식·ETF의 외국인/기관/개인/프로그램 수급, PER/PBR, 외국인 소진율, 52주 위치, 위험 상태 저장
- 숫자 나열 대신 오늘의 판단·근거·주의점·다음 확인사항을 첫 화면과 Email에 표시
- 평일 16:10 KST 이후 KIS 일봉·판단 데이터·Alpha Vantage 최신 뉴스·점수·Daily Report를 하루 한 번 자동 갱신
- 기존 MA·RSI 외 5/20/60일 수익률, ATR%, 거래량 비율, MA20/60 괴리도를 Dashboard/Watchlist에 노출
- 6자리 국내 종목코드는 별도 소스 코드 수정 없이 KIS 조회 대상으로 인식
- 주문·정정·취소·잔고·계좌·hashkey API는 허용 목록 밖으로 유지

화면의 시장 점수와 지표는 구조 확인용 예시값이며 실제 데이터 수집은 Phase 2에서 연결합니다.

## 로컬 실행

Node.js 22.13 이상이 필요합니다.

```powershell
npm install
npm run db:local
npm run dev
```

기본 개발 비밀번호는 `local-dev-only`입니다. 검증은 다음 명령으로 실행합니다.

```powershell
npm test
npx tsc --noEmit
npm run lint
npm run build
```

## Cloudflare Git 배포 준비값

| 이름 | 현재 상태 | 저장/설정 위치 |
|---|---|---|
| `ADMIN_PASSWORD` | 사용자 설정 필요 | 운영 Worker Secret; 소스·D1·브라우저 저장소에 보관하지 않음 |
| `ADMIN_TOKEN` | 호환 유지 | 기존 운영 인증이 끊기지 않도록 임시 fallback으로만 사용 |
| `ALPHA_VANTAGE_API_KEY` | 생성·설정됨 | 로컬 `.dev.vars`, 운영 Worker Secret |
| `KIS_APP_KEY` / `KIS_APP_SECRET` | 사용자 설정 완료 | 운영 Worker Secret; 조회 전용 시세 인증에만 사용 |
| `CLOUDFLARE_D1_DATABASE_ID` | 설정됨 | Cloudflare 암호화 빌드 변수 |
| `DB` binding | 운영 연결됨 | `market-intelligence-tracker-db` |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` / `TELEGRAM_WEBHOOK_SECRET` | 사용자 설정 필요 | Worker Secret |
| `RESEND_API_KEY` / `EMAIL_TO` | 사용자 설정 필요 | Resend 무료 Sending-only API Key + Worker Secret |
| `EMAIL_FROM` | 선택 | 미설정 시 Resend 테스트 발신자 사용; 자체 도메인 연결 시 설정 |

비밀값의 실제 내용은 README, 커밋, 이슈에 기록하지 않습니다. 변경 이력과 다음 작업은 로컬 작업공간 루트의 `CODEX_PROGRESS.md`에 누적합니다.

## Git 기반 Cloudflare 배포

Cloudflare Workers Git 배포가 `main`에 연결되어 있습니다. 운영 URL은 `https://market-intelligence-tracker.sjsuk321.workers.dev`입니다.

- Build command: `npm ci && npm run build`
- Deploy command: `npx wrangler deploy --config dist/server/wrangler.json`
- Non-production deploy: `npx wrangler versions upload --config dist/server/wrangler.json`
- Build variable: `CLOUDFLARE_D1_DATABASE_ID=<생성한 D1 database ID>`
- Worker secrets: `ADMIN_PASSWORD`, `ALPHA_VANTAGE_API_KEY`, `KIS_APP_KEY`, `KIS_APP_SECRET`, Telegram 3종, `RESEND_API_KEY`, `EMAIL_TO`, 선택 `EMAIL_FROM` (`ADMIN_TOKEN`은 이전 값 호환용)

스키마 변경 배포 전 `npx wrangler d1 migrations apply DB --remote --config dist/server/wrangler.json`으로 새 migration을 원격 D1에 적용합니다. Cloudflare API 토큰을 GitHub 저장소에 넣는 방식은 사용하지 않습니다.

## 무료 플랜 주의사항

가격과 뉴스 수집은 같은 Alpha Vantage 무료 호출 한도를 공유합니다. 자동 뉴스는 개별 자산마다 호출하지 않고 하루 1회 최신 100건을 받아 응답의 ticker sentiment를 관심 자산에 배분합니다. 호출 예약과 결과는 기존 `job_runs`에 기록되며, 최근 24시간 25회에 도달하면 외부 호출 전에 차단합니다. 화면의 잔여 횟수는 이 앱의 기록만 반영하므로 같은 키를 로컬·다른 앱에서 쓴 호출은 포함하지 않습니다. 공급자가 실제 일일 한도 초과를 반환하면 해당 기록을 감지해 24시간 추가 호출을 차단합니다. 주식/ETF compact 응답은 100개이므로 MA120/200은 데이터가 누적될 때까지 `null`일 수 있습니다.

KIS는 KOSPI·KOSDAQ·005930·000660·091160의 일봉 조회에만 사용합니다. 한 종목당 최대 3페이지에서 최신 260개를 저장하고 18시간 중복 호출을 막습니다. 주문·정정·취소·잔고·계좌 API와 주문용 hashkey는 코드에 없으며 계좌번호도 환경 변수나 D1에 저장하지 않습니다.

알림 Cron은 15분마다 D1 설정을 확인하고 동일 리포트·채널의 성공 이력이 있으면 건너뜁니다. 현재 Cloudflare 계정의 Email Sending은 Workers Paid가 필요하므로 결제하지 않고, 무료 Resend HTTPS API(3,000건/월·100건/일) fallback을 사용합니다. 실발송에는 `RESEND_API_KEY`·`EMAIL_TO` Worker Secret과 Admin의 Email 활성화가 필요합니다.
