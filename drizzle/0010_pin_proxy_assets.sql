UPDATE assets
SET symbol = 'GLD', name = 'Gold ETF proxy (GLD)', asset_type = 'ETF',
    market = 'GLOBAL', currency = 'USD', updated_at = CURRENT_TIMESTAMP
WHERE symbol = 'GOLD'
  AND NOT EXISTS (SELECT 1 FROM assets WHERE symbol = 'GLD');

UPDATE assets
SET enabled = 0, name = 'Legacy mixed Gold/GLD history (disabled)', updated_at = CURRENT_TIMESTAMP
WHERE symbol = 'GOLD';

UPDATE report_metrics
SET symbol = 'GLD', name = 'Gold ETF proxy (GLD)'
WHERE asset_id = (SELECT id FROM assets WHERE symbol = 'GLD');

UPDATE assets
SET symbol = 'IBIT', name = 'Bitcoin ETF proxy (IBIT)', asset_type = 'ETF',
    market = 'GLOBAL', currency = 'USD', updated_at = CURRENT_TIMESTAMP
WHERE symbol = 'BTC'
  AND NOT EXISTS (SELECT 1 FROM assets WHERE symbol = 'IBIT');

UPDATE assets
SET enabled = 0, name = 'Legacy mixed Bitcoin/IBIT history (disabled)', updated_at = CURRENT_TIMESTAMP
WHERE symbol = 'BTC';

UPDATE report_metrics
SET symbol = 'IBIT', name = 'Bitcoin ETF proxy (IBIT)'
WHERE asset_id = (SELECT id FROM assets WHERE symbol = 'IBIT');
