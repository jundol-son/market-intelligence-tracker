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
  { label: 'Strong Risk-Off', min: 0, max: 30 },
  { label: 'Risk-Off', min: 30, max: 45 },
  { label: 'Neutral', min: 45, max: 55 },
  { label: 'Mild Risk-On', min: 55, max: 70 },
  { label: 'Risk-On', min: 70, max: 80 },
  { label: 'Strong Risk-On', min: 80, max: 100 },
] as const;

const calibrationBuckets = [
  { min: 0, max: 20 },
  { min: 20, max: 40 },
  { min: 40, max: 60 },
  { min: 60, max: 80 },
  { min: 80, max: 100 },
] as const;
const minimumForecastSample = 30;
const minimumBucketSample = 10;

const rounded = (value: number, digits = 2) => Number(value.toFixed(digits));
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

type ProbabilityResult = AnalyticsRow & {
  predictedProbability: number;
  outcome: number;
  modelBrier: number;
  baselineBrier: number;
};

function probabilityResults(rows: AnalyticsRow[]): ProbabilityResult[] {
  const chronological = [...rows].sort((left, right) => left.reportDate.localeCompare(right.reportDate)
    || (left.symbol ?? '').localeCompare(right.symbol ?? ''));
  const results: ProbabilityResult[] = [];
  const prior = new Map<string, { count: number; up: number }>();
  for (let index = 0; index < chronological.length;) {
    const date = chronological[index].reportDate;
    let end = index + 1;
    while (end < chronological.length && chronological[end].reportDate === date) end += 1;
    const sameDate = chronological.slice(index, end);
    for (const row of sameDate) {
      const outcome = row.actualReturn >= 0 ? 1 : 0;
      const probability = Math.min(1, Math.max(0, row.upProbability / 100));
      const history = prior.get(row.symbol ?? 'MARKET');
      const baselineProbability = history?.count ? history.up / history.count : 0.5;
      results.push({
        ...row,
        predictedProbability: probability,
        outcome,
        modelBrier: (probability - outcome) ** 2,
        baselineBrier: (baselineProbability - outcome) ** 2,
      });
    }
    for (const row of sameDate) {
      const key = row.symbol ?? 'MARKET';
      const history = prior.get(key) ?? { count: 0, up: 0 };
      history.count += 1;
      history.up += row.actualReturn >= 0 ? 1 : 0;
      prior.set(key, history);
    }
    index = end;
  }
  return results;
}

function calibration(rows: ProbabilityResult[]) {
  if (!rows.length) return {
    count: 0, modelBrier: null, baselineBrier: null, brierSkill: null,
    minimumSample: minimumForecastSample, sufficientSample: false,
  };
  const modelBrier = rows.reduce((sum, row) => sum + row.modelBrier, 0) / rows.length;
  const baselineBrier = rows.reduce((sum, row) => sum + row.baselineBrier, 0) / rows.length;
  return {
    count: rows.length,
    modelBrier: rounded(modelBrier, 4),
    baselineBrier: rounded(baselineBrier, 4),
    brierSkill: baselineBrier > 0 ? rounded((1 - modelBrier / baselineBrier) * 100) : null,
    minimumSample: minimumForecastSample,
    sufficientSample: rows.length >= minimumForecastSample,
  };
}

function calibrationCurve(rows: ProbabilityResult[]) {
  return calibrationBuckets.map((bucket) => {
    const matching = rows.filter((row) => row.predictedProbability * 100 >= bucket.min
      && (bucket.max === 100 ? row.predictedProbability * 100 <= bucket.max : row.predictedProbability * 100 < bucket.max));
    const predictedUpProbability = matching.length
      ? rounded(matching.reduce((sum, row) => sum + row.predictedProbability, 0) / matching.length * 100)
      : null;
    const observedUpRate = matching.length
      ? rounded(matching.reduce((sum, row) => sum + row.outcome, 0) / matching.length * 100)
      : null;
    return {
      ...bucket,
      count: matching.length,
      predictedUpProbability,
      observedUpRate,
      gap: predictedUpProbability === null || observedUpRate === null ? null : rounded(observedUpRate - predictedUpProbability),
      minimumSample: minimumBucketSample,
      sufficientSample: matching.length >= minimumBucketSample,
    };
  });
}

export function buildAnalytics(rows: AnalyticsRow[]) {
  const sorted = [...rows].sort((left, right) => right.reportDate.localeCompare(left.reportDate));
  const probability = probabilityResults(rows);
  const periods = new Map<string, ProbabilityResult[]>();
  for (const row of probability) {
    const period = row.reportDate.slice(0, 7);
    const periodRows = periods.get(period);
    if (periodRows) periodRows.push(row);
    else periods.set(period, [row]);
  }
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
    forecastCalibration: calibration(probability),
    calibrationCurve: calibrationCurve(probability),
    walkForward: [...periods]
      .map(([period, periodRows]) => ({ period, ...calibration(periodRows), directionAccuracy: hitRate(periodRows, 'directionHit') }))
      .sort((left, right) => right.period.localeCompare(left.period)),
    scorePerformance: buckets.map((bucket) => {
      const matching = sorted.filter((row) => row.compositeScore !== null
        && row.compositeScore >= bucket.min
        && (bucket.max === 100 ? row.compositeScore <= bucket.max : row.compositeScore < bucket.max));
      return { ...bucket, count: matching.length, averageReturn: average(matching), directionAccuracy: hitRate(matching, 'directionHit') };
    }),
    recentResults: sorted.slice(0, 20),
  };
}

export type AnalyticsState = ReturnType<typeof buildAnalytics>;
