import { paceKisRequest, requestKisToken } from './market-data.ts';

export type KisMarketInsight = {
  scope: 'MARKET'; symbol: 'KOSPI' | 'KOSDAQ'; date: string;
  price: number | null; changeRate: number | null; volume: number | null; tradingValue: number | null;
  advance: number | null; decline: number | null; unchanged: number | null; upperLimit: number | null; lowerLimit: number | null;
  breadthPercent: number | null; bidAskBalance: number | null;
  foreignNetQty: number | null; institutionNetQty: number | null; retailNetQty: number | null;
  foreignNetAmount: number | null; institutionNetAmount: number | null; retailNetAmount: number | null;
};

export type KisAssetInsight = {
  scope: 'ASSET'; symbol: string; date: string;
  price: number | null; changeRate: number | null; volume: number | null; tradingValue: number | null; turnoverRate: number | null;
  marketCap: number | null; per: number | null; pbr: number | null; eps: number | null; bps: number | null;
  foreignNetQty: number | null; institutionNetQty: number | null; retailNetQty: number | null; programNetQty: number | null;
  foreignHoldingQty: number | null; foreignExhaustionRate: number | null; loanBalanceRate: number | null;
  high52w: number | null; low52w: number | null; high52wDistance: number | null; low52wDistance: number | null;
  pivot: number | null; resistance1: number | null; support1: number | null; shortSellable: boolean | null; warnings: string[];
};

export type KisInsight = KisMarketInsight | KisAssetInsight;

type KisBody = Record<string, unknown> & { rt_cd?: string; msg1?: string; output?: unknown };
type Row = Record<string, unknown>;

const n = (row: Row | null, key: string): number | null => {
  const value = row?.[key];
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const parsed = Number(typeof value === 'string' ? value.replaceAll(',', '') : value);
  return Number.isFinite(parsed) ? parsed : null;
};
const code = (row: Row | null, key: string) => typeof row?.[key] === 'string' ? row[key] : '';
const date = (value: unknown, fallback: string) => {
  const raw = typeof value === 'string' ? value : '';
  return /^\d{8}$/.test(raw) ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6)}` : fallback;
};
const body = (input: unknown): KisBody => {
  if (!input || typeof input !== 'object') throw new Error('KIS 판단 데이터 응답 형식이 올바르지 않습니다.');
  const result = input as KisBody;
  if (result.rt_cd !== '0') throw new Error(`KIS 판단 데이터 조회 실패: ${result.msg1 ?? '응답 오류'}`);
  return result;
};
const first = (value: unknown): Row | null => Array.isArray(value)
  ? (value.find((item) => item && typeof item === 'object') as Row | undefined) ?? null
  : value && typeof value === 'object' ? value as Row : null;

export function parseKisMarketInsight(symbol: 'KOSPI' | 'KOSDAQ', quoteInput: unknown, flowInput: unknown, fallbackDate: string): KisMarketInsight {
  const quote = first(body(quoteInput).output);
  const flow = first(body(flowInput).output);
  if (!quote && !flow) throw new Error(`${symbol} KIS 판단 데이터가 비어 있습니다.`);
  const advance = n(quote, 'ascn_issu_cnt');
  const decline = n(quote, 'down_issu_cnt');
  const breadthPercent = advance !== null && decline !== null && advance + decline > 0
    ? advance / (advance + decline) * 100 : null;
  return {
    scope: 'MARKET', symbol, date: date(flow?.stck_bsop_date, fallbackDate),
    price: n(quote, 'bstp_nmix_prpr') ?? n(flow, 'bstp_nmix_prpr'),
    changeRate: n(quote, 'bstp_nmix_prdy_ctrt') ?? n(flow, 'bstp_nmix_prdy_ctrt'),
    volume: n(quote, 'acml_vol'), tradingValue: n(quote, 'acml_tr_pbmn'),
    advance, decline, unchanged: n(quote, 'stnr_issu_cnt'), upperLimit: n(quote, 'uplm_issu_cnt'), lowerLimit: n(quote, 'lslm_issu_cnt'),
    breadthPercent, bidAskBalance: n(quote, 'ntby_rsqn'),
    foreignNetQty: n(flow, 'frgn_ntby_qty'), institutionNetQty: n(flow, 'orgn_ntby_qty'), retailNetQty: n(flow, 'prsn_ntby_qty'),
    foreignNetAmount: n(flow, 'frgn_ntby_tr_pbmn'), institutionNetAmount: n(flow, 'orgn_ntby_tr_pbmn'), retailNetAmount: n(flow, 'prsn_ntby_tr_pbmn'),
  };
}

export function parseKisAssetInsight(symbol: string, quoteInput: unknown, flowInput: unknown, fallbackDate: string): KisAssetInsight {
  const quote = first(body(quoteInput).output);
  const flow = first(body(flowInput).output);
  if (!quote && !flow) throw new Error(`${symbol} KIS 판단 데이터가 비어 있습니다.`);
  const warningMap: Array<[string, string]> = [
    ['temp_stop_yn', '거래정지'], ['invt_caful_yn', '투자유의'], ['short_over_yn', '단기과열'], ['sltr_yn', '정리매매'],
  ];
  const warnings = warningMap.filter(([key]) => quote?.[key] === 'Y').map(([, label]) => label);
  if (!['', '0', '00'].includes(code(quote, 'mrkt_warn_cls_code'))) warnings.push('시장경고');
  if (!['', '0', '00', 'N'].includes(code(quote, 'mang_issu_cls_code'))) warnings.push('관리종목');
  return {
    scope: 'ASSET', symbol, date: date(flow?.stck_bsop_date, fallbackDate),
    price: n(quote, 'stck_prpr'), changeRate: n(quote, 'prdy_ctrt'), volume: n(quote, 'acml_vol'),
    tradingValue: n(quote, 'acml_tr_pbmn'), turnoverRate: n(quote, 'vol_tnrt'), marketCap: n(quote, 'hts_avls'),
    per: n(quote, 'per'), pbr: n(quote, 'pbr'), eps: n(quote, 'eps'), bps: n(quote, 'bps'),
    foreignNetQty: n(flow, 'frgn_ntby_qty') ?? n(quote, 'frgn_ntby_qty'), institutionNetQty: n(flow, 'orgn_ntby_qty'),
    retailNetQty: n(flow, 'prsn_ntby_qty'), programNetQty: n(quote, 'pgtr_ntby_qty'),
    foreignHoldingQty: n(quote, 'frgn_hldn_qty'), foreignExhaustionRate: n(quote, 'hts_frgn_ehrt'), loanBalanceRate: n(quote, 'whol_loan_rmnd_rate'),
    high52w: n(quote, 'w52_hgpr'), low52w: n(quote, 'w52_lwpr'), high52wDistance: n(quote, 'w52_hgpr_vrss_prpr_ctrt'),
    low52wDistance: n(quote, 'w52_lwpr_vrss_prpr_ctrt'), pivot: n(quote, 'pvt_pont_val'), resistance1: n(quote, 'pvt_frst_dmrs_prc'),
    support1: n(quote, 'pvt_frst_dmsp_prc'), shortSellable: quote?.ssts_yn === undefined ? null : quote.ssts_yn === 'Y', warnings,
  };
}

async function get(appKey: string, appSecret: string, endpoint: string, trId: string, params: Record<string, string>) {
  const allowed = new Set(['inquire-index-price', 'inquire-investor-daily-by-market', 'inquire-price', 'inquire-investor']);
  if (!allowed.has(endpoint)) throw new Error('허용되지 않은 KIS 조회 경로입니다.');
  const url = new URL(`https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/quotations/${endpoint}`);
  url.search = new URLSearchParams(params).toString();
  const accessToken = await requestKisToken(appKey, appSecret);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await paceKisRequest();
    const response = await fetch(url, { headers: {
      'content-type': 'application/json', authorization: `Bearer ${accessToken}`,
      appkey: appKey, appsecret: appSecret, tr_id: trId, custtype: 'P',
    }, signal: AbortSignal.timeout(15_000) });
    const result = await response.json().catch(() => null) as KisBody | null;
    const message = result?.msg1 ?? '응답 오류';
    if (response.ok) return result;
    if (attempt === 0 && /초당 거래건수|EGW00201/.test(message)) {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      continue;
    }
    throw new Error(`KIS 조회 실패 (${response.status}): ${message}`);
  }
}

const seoulDate = (now = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(now);

export async function fetchKisMarketInsight(appKey: string, appSecret: string, symbol: 'KOSPI' | 'KOSDAQ', now = new Date()) {
  const code = symbol === 'KOSPI' ? '0001' : '1001';
  const market = symbol === 'KOSPI' ? 'KSP' : 'KSQ';
  const day = seoulDate(now);
  const compact = day.replaceAll('-', '');
  const [quote, flow] = await Promise.all([
    get(appKey, appSecret, 'inquire-index-price', 'FHPUP02100000', { FID_COND_MRKT_DIV_CODE: 'U', FID_INPUT_ISCD: code }),
    get(appKey, appSecret, 'inquire-investor-daily-by-market', 'FHPTJ04040000', {
      FID_COND_MRKT_DIV_CODE: 'U', FID_INPUT_ISCD: code, FID_INPUT_DATE_1: compact,
      FID_INPUT_ISCD_1: market, FID_INPUT_DATE_2: compact, FID_INPUT_ISCD_2: code,
    }),
  ]);
  return parseKisMarketInsight(symbol, quote, flow, day);
}

export async function fetchKisAssetInsight(appKey: string, appSecret: string, symbol: string, now = new Date()) {
  const day = seoulDate(now);
  const [quote, flow] = await Promise.all([
    get(appKey, appSecret, 'inquire-price', 'FHKST01010100', { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol }),
    get(appKey, appSecret, 'inquire-investor', 'FHKST01010900', { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol }),
  ]);
  return parseKisAssetInsight(symbol, quote, flow, day);
}
