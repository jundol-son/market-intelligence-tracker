import type { PriceBar } from './market-data';

export type IndicatorPoint = {
  date: string;
  ma5: number | null;
  ma20: number | null;
  ma60: number | null;
  ma120: number | null;
  ma200: number | null;
  ma20Distance: number | null;
  ma60Distance: number | null;
  ma120Distance: number | null;
  ma200Distance: number | null;
  ma20Slope: number | null;
  ma60Slope: number | null;
  rsi14: number | null;
  atr14: number | null;
  return1d: number | null;
  return5d: number | null;
  return20d: number | null;
  return60d: number | null;
  volumeRatio: number | null;
  relativeStrength: number | null;
};

const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const change = (current: number, previous: number) => previous > 0 ? (current / previous - 1) * 100 : null;

export function calculateIndicators(prices: PriceBar[], benchmark: PriceBar[] = []): IndicatorPoint[] {
  const rows = [...prices].sort((a, b) => a.date.localeCompare(b.date));
  const benchmarkRows = [...benchmark].sort((a, b) => a.date.localeCompare(b.date));
  const benchmarkIndex = new Map(benchmarkRows.map((price, index) => [price.date, index]));

  const ma = (index: number, days: number) => index + 1 < days
    ? null
    : average(rows.slice(index + 1 - days, index + 1).map((price) => price.close));
  const returns = (index: number, days: number) => index < days ? null : change(rows[index].close, rows[index - days].close);
  const benchmarkReturn = (date: string, days: number) => {
    const index = benchmarkIndex.get(date);
    return index === undefined || index < days ? null : change(benchmarkRows[index].close, benchmarkRows[index - days].close);
  };

  return rows.map((price, index) => {
    const ma5 = ma(index, 5);
    const ma20 = ma(index, 20);
    const ma60 = ma(index, 60);
    const ma120 = ma(index, 120);
    const ma200 = ma(index, 200);
    const priorMa20 = index > 0 ? ma(index - 1, 20) : null;
    const priorMa60 = index > 0 ? ma(index - 1, 60) : null;
    const return20d = returns(index, 20);
    const referenceReturn = benchmarkReturn(price.date, 20);

    let rsi14: number | null = null;
    let atr14: number | null = null;
    if (index >= 14) {
      const deltas = rows.slice(index - 13, index + 1).map((row, offset) =>
        row.close - rows[index - 14 + offset].close);
      const gain = average(deltas.map((value) => Math.max(value, 0)));
      const loss = average(deltas.map((value) => Math.max(-value, 0)));
      rsi14 = loss === 0 ? (gain === 0 ? 50 : 100) : 100 - 100 / (1 + gain / loss);
      atr14 = average(rows.slice(index - 13, index + 1).map((row, offset) => {
        const previousClose = rows[index - 14 + offset].close;
        return Math.max(row.high - row.low, Math.abs(row.high - previousClose), Math.abs(row.low - previousClose));
      }));
    }

    const averageVolume = index >= 19
      ? average(rows.slice(index - 19, index + 1).map((row) => row.volume))
      : null;

    return {
      date: price.date,
      ma5, ma20, ma60, ma120, ma200,
      ma20Distance: ma20 === null ? null : change(price.close, ma20),
      ma60Distance: ma60 === null ? null : change(price.close, ma60),
      ma120Distance: ma120 === null ? null : change(price.close, ma120),
      ma200Distance: ma200 === null ? null : change(price.close, ma200),
      ma20Slope: ma20 === null || priorMa20 === null ? null : change(ma20, priorMa20),
      ma60Slope: ma60 === null || priorMa60 === null ? null : change(ma60, priorMa60),
      rsi14,
      atr14,
      return1d: returns(index, 1),
      return5d: returns(index, 5),
      return20d,
      return60d: returns(index, 60),
      volumeRatio: averageVolume && averageVolume > 0 ? price.volume / averageVolume : null,
      relativeStrength: return20d === null || referenceReturn === null ? null : return20d - referenceReturn,
    };
  });
}
