export type ScoreWeight = {
  scoreGroup: 'ASSET' | 'MARKET';
  metricKey: 'trend' | 'momentum' | 'risk' | 'relative' | 'global' | 'korea';
  weight: number;
  enabled: boolean;
};

export const DEFAULT_WEIGHTS: ScoreWeight[] = [
  { scoreGroup: 'ASSET', metricKey: 'trend', weight: 0.35, enabled: true },
  { scoreGroup: 'ASSET', metricKey: 'momentum', weight: 0.25, enabled: true },
  { scoreGroup: 'ASSET', metricKey: 'risk', weight: 0.2, enabled: true },
  { scoreGroup: 'ASSET', metricKey: 'relative', weight: 0.2, enabled: true },
  { scoreGroup: 'MARKET', metricKey: 'global', weight: 0.6, enabled: true },
  { scoreGroup: 'MARKET', metricKey: 'korea', weight: 0.4, enabled: true },
];

export type ScoreInput = {
  close: number;
  ma20Distance: number | null;
  ma60Distance: number | null;
  ma20Slope: number | null;
  ma60Slope: number | null;
  rsi14: number | null;
  atr14: number | null;
  return5d: number | null;
  return20d: number | null;
  relativeStrength: number | null;
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const contribution = (value: number | null, factor: number, limit: number) =>
  value === null ? 0 : clamp(value * factor, -limit, limit);

function weighted(values: Record<string, number | null>, weights: ScoreWeight[], group: ScoreWeight['scoreGroup']) {
  const available = weights.filter((item) => item.scoreGroup === group && item.enabled && typeof values[item.metricKey] === 'number');
  const total = available.reduce((sum, item) => sum + item.weight, 0);
  return total === 0 ? null : available.reduce((sum, item) => sum + values[item.metricKey]! * item.weight, 0) / total;
}

export function calculateAssetScore(input: ScoreInput, weights: ScoreWeight[]) {
  const trendScore = clamp(50
    + contribution(input.ma20Distance, 1.2, 18)
    + contribution(input.ma60Distance, 0.7, 14)
    + contribution(input.ma20Slope, 12, 9)
    + contribution(input.ma60Slope, 12, 9));
  const momentumScore = clamp(50
    + contribution(input.rsi14 === null ? null : input.rsi14 - 50, 0.5, 20)
    + contribution(input.return5d, 0.8, 10)
    + contribution(input.return20d, 0.8, 20));
  const atrPercent = input.atr14 === null || input.close <= 0 ? null : input.atr14 / input.close * 100;
  const riskScore = atrPercent === null ? 50 : clamp(100 - atrPercent * 10);
  const relativeScore = input.relativeStrength === null ? null : clamp(50 + input.relativeStrength * 2);
  const technicalScore = weighted({ trend: trendScore, momentum: momentumScore, risk: riskScore }, weights, 'ASSET') ?? 50;
  const compositeScore = weighted({ trend: trendScore, momentum: momentumScore, risk: riskScore, relative: relativeScore }, weights, 'ASSET') ?? 50;
  return { trendScore, momentumScore, riskScore, technicalScore, relativeScore, compositeScore };
}

export function parseWeights(input: unknown): ScoreWeight[] {
  if (!input || typeof input !== 'object' || !Array.isArray((input as { weights?: unknown }).weights)) {
    throw new Error('가중치 목록이 올바르지 않습니다.');
  }
  const allowed = new Set(DEFAULT_WEIGHTS.map((item) => `${item.scoreGroup}:${item.metricKey}`));
  const weights = (input as { weights: unknown[] }).weights.map((raw) => {
    if (!raw || typeof raw !== 'object') throw new Error('가중치 항목이 올바르지 않습니다.');
    const item = raw as Record<string, unknown>;
    const scoreGroup = String(item.scoreGroup) as ScoreWeight['scoreGroup'];
    const metricKey = String(item.metricKey) as ScoreWeight['metricKey'];
    const weight = Number(item.weight);
    if (!allowed.has(`${scoreGroup}:${metricKey}`) || !Number.isFinite(weight) || weight < 0 || weight > 1) {
      throw new Error('가중치는 허용된 항목별 0~1 값이어야 합니다.');
    }
    return { scoreGroup, metricKey, weight, enabled: item.enabled !== false };
  });
  if (weights.length !== allowed.size || new Set(weights.map((item) => `${item.scoreGroup}:${item.metricKey}`)).size !== allowed.size) {
    throw new Error('모든 가중치 항목을 중복 없이 입력하세요.');
  }
  for (const group of ['ASSET', 'MARKET'] as const) {
    const sum = weights.filter((item) => item.scoreGroup === group && item.enabled).reduce((total, item) => total + item.weight, 0);
    if (Math.abs(sum - 1) > 0.001) throw new Error(`${group} 활성 가중치 합계는 1이어야 합니다.`);
  }
  return weights;
}

export function weightedMarketScore(globalScore: number | null, koreaScore: number | null, weights: ScoreWeight[]) {
  return weighted({ global: globalScore, korea: koreaScore }, weights, 'MARKET');
}
