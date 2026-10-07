ALTER TABLE report_metrics ADD COLUMN price_date TEXT;

UPDATE report_metrics
SET price_date = COALESCE(
  (SELECT p.date
   FROM asset_prices p
   JOIN reports r ON r.id = report_metrics.report_id
   WHERE p.asset_id = report_metrics.asset_id
     AND p.date <= r.report_date
     AND p.close = report_metrics.price
   ORDER BY p.date DESC
   LIMIT 1),
  (SELECT p.date
   FROM asset_prices p
   JOIN reports r ON r.id = report_metrics.report_id
   WHERE p.asset_id = report_metrics.asset_id
     AND p.date <= r.report_date
   ORDER BY p.date DESC
   LIMIT 1)
);
