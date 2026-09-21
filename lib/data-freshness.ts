export type DatedAsset = { symbol: string; date?: string | null };

const dayNumber = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) return null;
  return Math.floor(timestamp / 86_400_000);
};

export function summarizeDataFreshness(rows: DatedAsset[], referenceDate: string, maxLagDays = 3) {
  const reference = dayNumber(referenceDate);
  if (reference === null) throw new Error('기준일은 YYYY-MM-DD 형식이어야 합니다.');
  const current: DatedAsset[] = [];
  const delayed: Array<DatedAsset & { lagDays: number }> = [];
  const missing: DatedAsset[] = [];
  for (const row of rows) {
    const day = row.date ? dayNumber(row.date) : null;
    if (day === null) missing.push(row);
    else {
      const lagDays = Math.max(0, reference - day);
      if (lagDays <= maxLagDays) current.push(row);
      else delayed.push({ ...row, lagDays });
    }
  }
  delayed.sort((a, b) => b.lagDays - a.lagDays || a.symbol.localeCompare(b.symbol));
  return { referenceDate, current, delayed, missing, total: rows.length };
}
