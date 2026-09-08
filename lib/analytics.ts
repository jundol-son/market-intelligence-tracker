export type AnalyticsRow = {
  reportDate: string;
  symbol: string | null;
  marketRegime: string;
  overallScore: number;
  compositeScore: number | null;
  upProbability: number;
  expectedLow: number;
  expectedHigh: number;
  actualReturn: number;
  directionHit: number | boolean;
  rangeHit: number | boolean;
};

const buckets = [
  { label: 'Strong Risk-Off', min: 0, max: 29 },
  { label: 'Risk-Off', min: 30, max: 44 },
  { label: 'Neutral', min: 45, max: 54 },
  { label: 'Mild Risk-On', min: 55, max: 69 },
  { label: 'Risk-On', min: 70, max: 79 },
  { label: 'Strong Risk-On', min: 80, max: 100 },
] as const;

const rounded = (value: number) => Math.round(value * 100) / 100;
const average = (rows: AnalyticsRow[]) => rows.length
  ? rounded(rows.reduce((sum, row) => sum + row.actualReturn, 0) / rows.length)
  : null;
const hitRate = (rows: AnalyticsRow[], key: 'directionHit' | 'rangeHit') => rows.length
  ? rounded(rows.filter((row) => Boolean(row[key])).length / rows.length * 100)
  : null;

function recent(rows: AnalyticsRow[], asOf: string, days: number) {
  const cutoff = new Date(`${asOf}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - days + 1);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  return rows.filter((row) => row.reportDate >= cutoffDate && row.reportDate <= asOf);
}

export function buildAnalytics(rows: AnalyticsRow[]) {
  const sorted = [...rows].sort((left, right) => right.reportDate.localeCompare(left.reportDate));
  const asOf = sorted[0]?.reportDate ?? null;
  const last30 = asOf ? recent(sorted, asOf, 30) : [];
  const last90 = asOf ? recent(sorted, asOf, 90) : [];
  const direction = (period: AnalyticsRow[]) => ({ count: period.length, accuracy: hitRate(period, 'directionHit') });
  const performance = (marketRegime: string) => {
    const matching = sorted.filter((row) => row.marketRegime === marketRegime);
    return { count: matching.length, averageReturn: average(matching) };
  };
  return {
    asOf,
    total: sorted.length,
    direction30: direction(last30),
    direction90: direction(last90),
    rangeHitRate: hitRate(sorted, 'rangeHit'),
    riskOn: performance('RISK_ON'),
    riskOff: performance('RISK_OFF'),
    scorePerformance: buckets.map((bucket) => {
      const matching = sorted.filter((row) => row.compositeScore !== null
        && row.compositeScore >= bucket.min && row.compositeScore <= bucket.max);
      return { ...bucket, count: matching.length, averageReturn: average(matching), directionAccuracy: hitRate(matching, 'directionHit') };
    }),
    recentResults: sorted.slice(0, 20),
  };
}

export type AnalyticsState = ReturnType<typeof buildAnalytics>;
