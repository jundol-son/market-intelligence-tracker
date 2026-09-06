export function reportSummary(regime: string, overallScore: number, change: number | null): string {
  const label = regime === 'RISK_ON' ? '위험선호' : regime === 'RISK_OFF' ? '위험회피' : '중립';
  const movement = change === null ? '비교 데이터 없음' : `전일 대비 ${change >= 0 ? '+' : ''}${change.toFixed(1)}점`;
  return `현재 시장은 ${label} 구간입니다. Overall ${overallScore.toFixed(1)}점, ${movement}.`;
}

export function evaluateForecast(
  initialPrice: number,
  actualPrice: number,
  upProbability: number,
  downProbability: number,
  expectedLow: number,
  expectedHigh: number,
) {
  if (initialPrice <= 0) throw new Error('예측 기준 가격은 0보다 커야 합니다.');
  const actualReturn = ((actualPrice / initialPrice) - 1) * 100;
  return {
    actualReturn,
    directionHit: upProbability >= downProbability ? actualReturn >= 0 : actualReturn < 0,
    rangeHit: actualReturn >= expectedLow && actualReturn <= expectedHigh,
  };
}
