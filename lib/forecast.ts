export type SimilarityFeatures = {
  return1d: number;
  return5d: number;
  return20d: number;
  ma20Distance: number;
  ma60Distance: number;
  rsi14: number;
  atrPercent: number;
  volumeRatio: number;
};

export type HistoricalDay = SimilarityFeatures & {
  date: string;
  nextDayReturn: number;
};

export type SimilarDay = Pick<HistoricalDay, 'date' | 'nextDayReturn'> & { similarityScore: number };

const scales: Record<keyof SimilarityFeatures, number> = {
  return1d: 2, return5d: 5, return20d: 10, ma20Distance: 5,
  ma60Distance: 10, rsi14: 20, atrPercent: 2, volumeRatio: 0.5,
};
const round = (value: number, digits = 1) => Number(value.toFixed(digits));
const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export function findSimilarDays(current: SimilarityFeatures, history: HistoricalDay[], limit = 20): SimilarDay[] {
  const keys = Object.keys(scales) as Array<keyof SimilarityFeatures>;
  return history.map((day) => {
    const distance = Math.sqrt(keys.reduce((sum, key) =>
      sum + ((current[key] - day[key]) / scales[key]) ** 2, 0) / keys.length);
    return { date: day.date, nextDayReturn: day.nextDayReturn, similarityScore: round(100 * Math.exp(-distance / 2)) };
  }).sort((a, b) => b.similarityScore - a.similarityScore).slice(0, limit);
}

function quantile(values: number[], ratio: number) {
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * ratio;
  const lower = Math.floor(position);
  const weight = position - lower;
  return sorted[lower] + (sorted[lower + 1] === undefined ? 0 : weight * (sorted[lower + 1] - sorted[lower]));
}

export function createForecast(similarDays: SimilarDay[], compositeScore: number, newsScore: number | null, eventImpact: number) {
  if (similarDays.length < 5) throw new Error('Forecast에는 최소 5개의 유사일이 필요합니다.');
  const returns = similarDays.map((day) => day.nextDayReturn);
  const historicalUp = returns.filter((value) => value >= 0).length / returns.length * 100;
  const upProbability = round(clamp(historicalUp * 0.7 + compositeScore * 0.2 + (newsScore ?? compositeScore) * 0.1));
  const bullProbability = round(returns.filter((value) => value > 1).length / returns.length * 100);
  const bearProbability = round(returns.filter((value) => value < -1).length / returns.length * 100);
  const baseProbability = round(100 - bullProbability - bearProbability);
  const averageSimilarity = similarDays.reduce((sum, day) => sum + day.similarityScore, 0) / similarDays.length;
  const confidence = round(clamp(averageSimilarity * 0.6 + Math.min(1, similarDays.length / 20) * 40 - eventImpact * 0.15, 10, 95));
  return {
    upProbability,
    downProbability: round(100 - upProbability),
    expectedLow: round(quantile(returns, 0.2), 2),
    expectedHigh: round(quantile(returns, 0.8), 2),
    bullProbability,
    baseProbability,
    bearProbability,
    confidence,
  };
}

export function responseLevel(forecast: ReturnType<typeof createForecast>) {
  if (forecast.confidence < 45) return '관망';
  if (forecast.expectedHigh - forecast.expectedLow >= 4) return '변동성 확대 대비';
  if (forecast.upProbability >= 65) return '조정 시 매수 우위';
  if (forecast.upProbability <= 35) return '포지션 축소 고려';
  if (forecast.upProbability >= 55) return '추격매수 주의';
  return '관망';
}
