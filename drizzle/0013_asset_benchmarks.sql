UPDATE assets
SET benchmark_asset_id = (SELECT id FROM assets WHERE symbol = 'SP500'),
    updated_at = CURRENT_TIMESTAMP
WHERE symbol IN ('NASDAQ100', 'SOX', 'NVDA')
  AND benchmark_asset_id IS NULL;

UPDATE assets
SET benchmark_asset_id = (SELECT id FROM assets WHERE symbol = 'KOSPI'),
    updated_at = CURRENT_TIMESTAMP
WHERE symbol IN ('KOSDAQ', '005930', '000660', '091160')
  AND benchmark_asset_id IS NULL;
