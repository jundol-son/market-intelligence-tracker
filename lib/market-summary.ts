export type MarketSummaryInput = {
  symbol: string;
  name: string;
  assetType: string;
  enabled?: boolean;
  importanceWeight: number;
  compositeScore: number | null;
  scoreChange1d: number | null;
  return1d: number | null;
};

type WeightedValue = { value: number | null; weight: number };

function average(values: WeightedValue[]) {
  const valid = values.filter((item): item is { value: number; weight: number } => item.value !== null);
  if (!valid.length) return null;
  const totalWeight = valid.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  return totalWeight
    ? valid.reduce((sum, item) => sum + item.value * Math.max(0, item.weight), 0) / totalWeight
    : valid.reduce((sum, item) => sum + item.value, 0) / valid.length;
}

export function summarizeMarketChanges(rows: MarketSummaryInput[]) {
  const active = rows.filter((item) => item.enabled !== false);
  const keyChanges = active.flatMap((item) => {
    const kind = item.scoreChange1d !== null ? 'SCORE' : 'RETURN';
    const value = item.scoreChange1d ?? item.return1d;
    const weight = Math.max(0, item.importanceWeight);
    return value === null || weight === 0 ? [] : [{
      symbol: item.symbol,
      name: item.name,
      kind,
      value,
      impact: Math.abs(value) * weight,
    }];
  }).sort((a, b) => b.impact - a.impact || a.symbol.localeCompare(b.symbol)).slice(0, 5);

  const grouped = Map.groupBy(active, (item) => item.assetType);
  const groups = [...grouped].map(([assetType, items]) => ({
    assetType,
    count: items.length,
    score: average(items.map((item) => ({ value: item.compositeScore, weight: item.importanceWeight }))),
    change: average(items.map((item) => ({ value: item.scoreChange1d, weight: item.importanceWeight }))),
    return1d: average(items.map((item) => ({ value: item.return1d, weight: item.importanceWeight }))),
    weight: items.reduce((sum, item) => sum + Math.max(0, item.importanceWeight), 0),
  })).sort((a, b) => b.weight - a.weight || a.assetType.localeCompare(b.assetType));

  return { keyChanges, groups };
}
