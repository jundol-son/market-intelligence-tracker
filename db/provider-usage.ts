import { getDb } from './index';

export const ALPHA_DAILY_LIMIT = 25;

export async function providerUsage() {
  const row = await getDb().prepare(`SELECT COUNT(*) AS used FROM job_runs
    WHERE job_name LIKE 'ALPHA_API:%' AND datetime(started_at)>=datetime('now', '-24 hours')`)
    .first<{ used: number }>();
  const used = row?.used ?? 0;
  return { limit: ALPHA_DAILY_LIMIT, used, remaining: Math.max(0, ALPHA_DAILY_LIMIT - used) };
}

export async function reserveProviderCall(jobName: string, cooldownHours = 18) {
  const db = getDb();
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
