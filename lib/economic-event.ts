export const EVENT_TYPES = [
  'CPI', 'PPI', 'EMPLOYMENT', 'FOMC', 'CENTRAL_BANK', 'EARNINGS',
  'SPEECH', 'OPTIONS_EXPIRY', 'TREASURY_AUCTION', 'OTHER',
] as const;
export const EVENT_STATUSES = ['SCHEDULED', 'RELEASED', 'CANCELLED'] as const;

export type EconomicEventInput = {
  eventName: string;
  eventType: typeof EVENT_TYPES[number];
  country: string;
  scheduledAt: string;
  previousValue: string | null;
  consensusValue: string | null;
  actualValue: string | null;
  expectedImpact: number;
  status: typeof EVENT_STATUSES[number];
  sourceUrl: string | null;
  affectedAssetIds: number[];
};

function optionalText(value: unknown, field: string, max = 40): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > max) throw new Error(`${field}가 올바르지 않습니다.`);
  return value.trim();
}

export function parseEconomicEventInput(input: unknown): EconomicEventInput {
  if (!input || typeof input !== 'object') throw new Error('이벤트 입력값이 필요합니다.');
  const value = input as Record<string, unknown>;
  const eventName = optionalText(value.eventName, '이벤트 이름', 120);
  if (!eventName) throw new Error('이벤트 이름이 필요합니다.');
  if (!EVENT_TYPES.includes(value.eventType as EconomicEventInput['eventType'])) throw new Error('이벤트 유형이 올바르지 않습니다.');
  if (!EVENT_STATUSES.includes(value.status as EconomicEventInput['status'])) throw new Error('이벤트 상태가 올바르지 않습니다.');
  const country = optionalText(value.country, '국가', 3)?.toUpperCase();
  if (!country || !/^[A-Z]{2,3}$/.test(country)) throw new Error('국가는 2~3자리 코드로 입력하세요.');
  const scheduled = typeof value.scheduledAt === 'string' ? new Date(value.scheduledAt) : new Date(Number.NaN);
  if (Number.isNaN(scheduled.getTime())) throw new Error('예정 시각이 올바르지 않습니다.');
  const expectedImpact = Number(value.expectedImpact);
  if (!Number.isFinite(expectedImpact) || expectedImpact < 0 || expectedImpact > 100) throw new Error('중요도는 0~100이어야 합니다.');
  const affectedAssetIds = Array.isArray(value.affectedAssetIds)
    ? [...new Set(value.affectedAssetIds.map(Number))]
    : [];
  if (affectedAssetIds.some((id) => !Number.isInteger(id) || id < 1)) throw new Error('영향 자산이 올바르지 않습니다.');
  const sourceUrl = optionalText(value.sourceUrl, '출처 URL', 500);
  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) throw new Error('출처 URL은 http(s) 주소여야 합니다.');
  return {
    eventName,
    eventType: value.eventType as EconomicEventInput['eventType'],
    country,
    scheduledAt: scheduled.toISOString(),
    previousValue: optionalText(value.previousValue, '이전값'),
    consensusValue: optionalText(value.consensusValue, '컨센서스'),
    actualValue: optionalText(value.actualValue, '실제값'),
    expectedImpact,
    status: value.status as EconomicEventInput['status'],
    sourceUrl,
    affectedAssetIds,
  };
}
