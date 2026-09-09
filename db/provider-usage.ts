import { getDb } from './index';
import { PROVIDER_DAILY_LIMIT_MESSAGE } from '@/lib/provider-error';

export const ALPHA_DAILY_LIMIT = 25;

export async function providerUsage() {
  const row = await getDb().prepare(`SELECT COUNT(*) AS used,
    MAX(CASE WHEN status='FAILED' AND error_message=? THEN 1 ELSE 0 END) AS provider_limited
    FROM job_runs WHERE job_name LIKE 'ALPHA_API:%'
    AND datetime(started_at)>=datetime('now', '-24 hours')`)
    .bind(PROVIDER_DAILY_LIMIT_MESSAGE).first<{ used: number; provider_limited: number }>();
  const used = row?.used ?? 0;
  const providerLimited = Boolean(row?.provider_limited);
  return { limit: ALPHA_DAILY_LIMIT, used,
    remaining: providerLimited ? 0 : Math.max(0, ALPHA_DAILY_LIMIT - used), providerLimited };
}

export async function reserveProviderCall(jobName: string, cooldownHours = 18) {
  const db = getDb();
  const usage = await providerUsage();
  if (usage.remaining === 0) {
    return { reserved: false as const, reason: usage.providerLimited ? 'PROVIDER_LIMITED' as const : 'QUOTA_EXHAUSTED' as const };
  }
  const job = await db.prepare(`INSERT INTO job_runs (job_name, status)
    SELECT ?, 'RUNNING'
    WHERE (SELECT COUNT(*) FROM job_runs
      WHERE job_name LIKE 'ALPHA_API:%' AND datetime(started_at)>=datetime('now', '-24 hours')) < ?
    AND NOT EXISTS (SELECT 1 FROM job_runs WHERE job_name=?
      AND status IN ('RUNNING', 'SUCCESS')
      AND datetime(started_at)>=datetime('now', '-' || ? || ' hours'))
    RETURNING id`).bind(jobName, ALPHA_DAILY_LIMIT, jobName, cooldownHours).first<{ id: number }>();
  if (job) return { reserved: true as const, id: job.id };
  const duplicate = await db.prepare(`SELECT 1 AS found FROM job_runs WHERE job_name=?
    AND status IN ('RUNNING', 'SUCCESS')
    AND datetime(started_at)>=datetime('now', '-' || ? || ' hours') LIMIT 1`)
    .bind(jobName, cooldownHours).first();
  return { reserved: false as const, reason: duplicate ? 'RECENTLY_COLLECTED' as const : 'QUOTA_EXHAUSTED' as const };
}

export async function finishProviderCall(id: number, error?: unknown) {
  const message = error instanceof Error ? error.message.slice(0, 500) : error ? '공급자 호출 실패' : null;
  await getDb().prepare(`UPDATE job_runs SET finished_at=CURRENT_TIMESTAMP, status=?, error_message=? WHERE id=?`)
    .bind(message ? 'FAILED' : 'SUCCESS', message, id).run();
}
