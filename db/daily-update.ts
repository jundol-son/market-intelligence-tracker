import { listAssetsForCollection } from './assets';
import { collectAssetPrice, refreshTreasurySpread, type ProviderCredentials } from './collection';
import { getDb } from './index';
import { collectKisInsights } from './kis-insights';
import { evaluateForecastResults, generateDailyReport } from './reports';
import { recalculateScores } from './scoring';
import { isCollectable } from '@/lib/catalog';

const KEYLESS_MACRO_SYMBOLS = new Set(['USDKRW', 'USDJPY', 'US2Y', 'US10Y']);

const seoul = (now: Date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul', hour12: false, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
}).formatToParts(now).reduce<Record<string, string>>((result, part) => {
  if (part.type !== 'literal') result[part.type] = part.value;
  return result;
}, {});

export async function runDailyKisUpdate(credentials: ProviderCredentials, now = new Date(), force = false) {
  if (!credentials.kisAppKey || !credentials.kisAppSecret) return { status: 'SKIPPED', reason: 'KIS_NOT_CONFIGURED' } as const;
  const local = seoul(now);
  const day = `${local.year}-${local.month}-${local.day}`;
  const time = `${local.hour === '24' ? '00' : local.hour}:${local.minute}`;
  if (!force && (['Sat', 'Sun'].includes(local.weekday) || time < '16:10')) return { status: 'SKIPPED', reason: 'NOT_DUE' } as const;
  const jobName = `DAILY_KIS:${day}`;
  const prior = await getDb().prepare(`SELECT status FROM job_runs WHERE job_name=? ORDER BY id DESC LIMIT 1`).bind(jobName).first<{ status: string }>();
  if (!force && (prior?.status === 'SUCCESS' || prior?.status === 'RUNNING')) return { status: 'SKIPPED', reason: 'ALREADY_DONE' } as const;
  const job = await getDb().prepare(`INSERT INTO job_runs (job_name, status) VALUES (?, 'RUNNING') RETURNING id`).bind(jobName).first<{ id: number }>();
  if (!job) throw new Error('일일 업데이트 기록을 만들지 못했습니다.');
  try {
    const assets = (await listAssetsForCollection()).filter((asset) => asset.enabled && isCollectable(asset.symbol));
    const prices = [] as Array<{ symbol: string; status: 'SUCCESS' | 'FAILED' | 'SKIPPED'; error?: string }>;
    for (const asset of assets) {
      try {
        const result = await collectAssetPrice(asset, credentials);
        prices.push({ symbol: asset.symbol, status: result.called ? 'SUCCESS' : 'SKIPPED' });
      } catch (error) {
        prices.push({ symbol: asset.symbol, status: 'FAILED', error: error instanceof Error ? error.message : '수집 실패' });
      }
    }
    const insights = await collectKisInsights(credentials.kisAppKey, credentials.kisAppSecret, now);
    await refreshTreasurySpread();
    const scores = await recalculateScores();
    if (scores.market) {
      await evaluateForecastResults();
      await generateDailyReport();
    }
    const failures = [...prices.filter((item) => item.status === 'FAILED'), ...insights.results.filter((item) => item.status === 'FAILED')];
    await getDb().prepare(`UPDATE job_runs SET finished_at=CURRENT_TIMESTAMP, status=?, error_message=? WHERE id=?`)
      .bind(failures.length ? 'PARTIAL' : 'SUCCESS', failures.map((item) => `${item.symbol}: ${item.error}`).join('; ') || null, job.id).run();
    return { status: failures.length ? 'PARTIAL' : 'SUCCESS', prices, insights } as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : '일일 업데이트 실패';
    await getDb().prepare(`UPDATE job_runs SET finished_at=CURRENT_TIMESTAMP, status='FAILED', error_message=? WHERE id=?`).bind(message, job.id).run();
    throw error;
  }
}

export async function refreshKeylessMacro(credentials: ProviderCredentials) {
  const assets = (await listAssetsForCollection())
    .filter((asset) => asset.enabled && KEYLESS_MACRO_SYMBOLS.has(asset.symbol));
  const results = [] as Array<{ symbol: string; status: 'SUCCESS' | 'FAILED' | 'SKIPPED'; error?: string }>;
  for (const asset of assets) {
    try {
      const result = await collectAssetPrice(asset, credentials);
      results.push({ symbol: asset.symbol, status: result.called ? 'SUCCESS' : 'SKIPPED' });
    } catch (error) {
      results.push({ symbol: asset.symbol, status: 'FAILED', error: error instanceof Error ? error.message : '수집 실패' });
    }
  }
  await refreshTreasurySpread();
  return results;
}
