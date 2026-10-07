INSERT OR IGNORE INTO assets
  (symbol, name, asset_type, market, currency, benchmark_asset_id, group_id, enabled, importance_weight)
VALUES
  ('SP500', 'S&P 500 (SPY proxy)', 'INDEX', 'GLOBAL', 'USD', NULL, NULL, 1, 20),
  ('NASDAQ100', 'Nasdaq 100 (QQQ proxy)', 'INDEX', 'GLOBAL', 'USD', NULL, NULL, 1, 15),
  ('SOX', 'Philadelphia Semiconductor (SOXX proxy)', 'INDEX', 'GLOBAL', 'USD', NULL, NULL, 1, 10),
  ('KOSPI', 'KOSPI', 'INDEX', 'KOSPI', 'KRW', NULL, NULL, 1, 20),
  ('KOSDAQ', 'KOSDAQ', 'INDEX', 'KOSDAQ', 'KRW', NULL, NULL, 1, 10),
  ('005930', '삼성전자', 'STOCK', 'KOSPI', 'KRW', NULL, NULL, 1, 12),
  ('000660', 'SK하이닉스', 'STOCK', 'KOSPI', 'KRW', NULL, NULL, 1, 10),
  ('091160', 'KODEX 반도체', 'ETF', 'KOSPI', 'KRW', NULL, NULL, 1, 8),
  ('USDKRW', 'USD/KRW', 'FX', 'FX', 'KRW', NULL, NULL, 1, 8),
  ('USDJPY', 'USD/JPY', 'FX', 'FX', 'JPY', NULL, NULL, 1, 5),
  ('DXY', 'US Dollar Index (UUP proxy)', 'FX', 'GLOBAL', 'USD', NULL, NULL, 1, 8),
  ('US2Y', 'US 2Y Treasury Yield', 'RATE', 'GLOBAL', 'PCT', NULL, NULL, 1, 8),
  ('US10Y', 'US 10Y Treasury Yield', 'RATE', 'GLOBAL', 'PCT', NULL, NULL, 1, 10),
  ('US10Y2Y', 'US 10Y - 2Y Treasury Spread', 'RATE', 'GLOBAL', 'PCT', NULL, NULL, 1, 10),
  ('VIX', 'Volatility (VIXY proxy)', 'INDEX', 'GLOBAL', 'USD', NULL, NULL, 1, 10),
  ('HY_OAS', 'High Yield credit (HYG proxy; inverse to OAS)', 'CREDIT', 'GLOBAL', 'USD', NULL, NULL, 1, 8),
  ('WTI', 'WTI futures (front month, USD/bbl)', 'COMMODITY', 'GLOBAL', 'USD', NULL, NULL, 1, 5),
  ('BRENT', 'Brent futures (front month, USD/bbl)', 'COMMODITY', 'GLOBAL', 'USD', NULL, NULL, 1, 5),
  ('USO', 'WTI ETF proxy (USO)', 'ETF', 'GLOBAL', 'USD', NULL, NULL, 1, 3),
  ('BNO', 'Brent ETF proxy (BNO)', 'ETF', 'GLOBAL', 'USD', NULL, NULL, 1, 3),
  ('GLD', 'Gold ETF proxy (GLD)', 'ETF', 'GLOBAL', 'USD', NULL, NULL, 1, 5),
  ('IBIT', 'Bitcoin ETF proxy (IBIT)', 'ETF', 'GLOBAL', 'USD', NULL, NULL, 1, 5),
  ('KR_FOREIGN_SPOT', 'Foreign investor KOSPI spot net buy (source connection required)', 'FLOW', 'KOSPI', 'KRW', NULL, NULL, 0, 8),
  ('KR_FOREIGN_FUTURES', 'Foreign investor KOSPI200 futures net buy (source connection required)', 'FLOW', 'KOSPI', 'KRW', NULL, NULL, 0, 8),
  ('SP500_ABOVE_200MA', 'S&P 500 members above 200MA (source connection required)', 'BREADTH', 'GLOBAL', 'USD', NULL, NULL, 0, 5);

UPDATE assets
SET benchmark_asset_id = (SELECT id FROM assets WHERE symbol = 'SP500')
WHERE symbol IN ('NASDAQ100', 'SOX', 'NVDA') AND benchmark_asset_id IS NULL;

UPDATE assets
SET benchmark_asset_id = (SELECT id FROM assets WHERE symbol = 'KOSPI')
WHERE symbol IN ('KOSDAQ', '005930', '000660', '091160') AND benchmark_asset_id IS NULL;
