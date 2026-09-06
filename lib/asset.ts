export const ASSET_TYPES = [
  'INDEX', 'STOCK', 'ETF', 'FX', 'RATE', 'COMMODITY', 'CRYPTO', 'CREDIT', 'FLOW', 'BREADTH',
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];

export type AssetInput = {
  symbol: string;
  name: string;
  assetType: AssetType;
  market: string;
  currency: string;
  benchmarkAssetId: number | null;
  groupId: number | null;
  enabled: boolean;
  importanceWeight: number;
};

function textValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function optionalId(value: unknown, field: string): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (!Number.isInteger(value) || Number(value) < 1) throw new Error(`${field}는 양의 정수여야 합니다.`);
  return Number(value);
}

export function parseAssetInput(input: unknown): AssetInput {
  if (!input || typeof input !== 'object') throw new Error('요청 본문이 올바르지 않습니다.');
  const value = input as Record<string, unknown>;
  const symbol = textValue(value.symbol).trim().toUpperCase();
  const name = textValue(value.name).trim();
  const assetType = textValue(value.assetType) as AssetType;
  const market = textValue(value.market).trim().toUpperCase();
  const currency = textValue(value.currency).trim().toUpperCase();
  const importanceWeight = Number(value.importanceWeight ?? 1);

  if (!/^[A-Z0-9.^=/_-]{1,24}$/.test(symbol)) throw new Error('티커 형식이 올바르지 않습니다.');
  if (name.length < 1 || name.length > 80) throw new Error('이름은 1~80자로 입력하세요.');
  if (!ASSET_TYPES.includes(assetType)) throw new Error('지원하지 않는 자산 유형입니다.');
  if (!/^[A-Z0-9_-]{1,20}$/.test(market)) throw new Error('시장 코드를 확인하세요.');
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('통화는 3자리 코드로 입력하세요.');
  if (!Number.isFinite(importanceWeight) || importanceWeight < 0 || importanceWeight > 100) {
    throw new Error('중요도는 0~100 사이여야 합니다.');
  }

  return {
    symbol,
    name,
    assetType,
    market,
    currency,
    benchmarkAssetId: optionalId(value.benchmarkAssetId, '벤치마크 ID'),
    groupId: optionalId(value.groupId, '그룹 ID'),
    enabled: value.enabled !== false,
    importanceWeight,
  };
}
