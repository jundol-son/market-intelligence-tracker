import { BLS_CALENDAR_URL, parseBlsCalendar } from '@/lib/economic-calendar';
import { getDb } from './index';

export async function syncEconomicCalendar(now = new Date()) {
  const day = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  const jobName = `CALENDAR:BLS_OFFICIAL:${day}`;
  const prior = await getDb().prepare('SELECT status FROM job_runs WHERE job_name=? ORDER BY id DESC LIMIT 1')
    .bind(jobName).first<{ status: string }>();
  if (prior) return { status: 'SKIPPED', reason: 'ALREADY_ATTEMPTED' } as const;
  const job = await getDb().prepare("INSERT INTO job_runs (job_name, status) VALUES (?, 'RUNNING') RETURNING id")
    .bind(jobName).first<{ id: number }>();
  if (!job) throw new Error('캘린더 동기화 기록을 만들지 못했습니다.');
  try {
    let response = await fetch(BLS_CALENDAR_URL, {
      headers: { accept: 'text/calendar', 'user-agent': 'Market Intelligence Tracker/1.0 (calendar sync)' },
    });
    if (!response.ok) {
      response = await fetch(`https://r.jina.ai/${BLS_CALENDAR_URL}`, {
        headers: { accept: 'text/plain', 'x-no-cache': 'true' },
      });
    }
    if (!response.ok) throw new Error(`BLS 캘린더 요청 실패 (${response.status})`);
    const events = parseBlsCalendar(await response.text())
      .filter((event) => new Date(event.scheduledAt).getTime() >= now.getTime());
    if (!events.length) throw new Error('BLS 캘린더에서 추적 대상 일정을 찾지 못했습니다.');
    await getDb().batch(events.map((event) => getDb().prepare(`INSERT INTO economic_events
      (event_name, event_type, country, scheduled_at, expected_impact, status, source_url, external_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(external_id) DO UPDATE SET event_name=excluded.event_name,
        event_type=excluded.event_type, country=excluded.country, scheduled_at=excluded.scheduled_at,
        expected_impact=excluded.expected_impact, status=excluded.status,
        source_url=excluded.source_url, updated_at=CURRENT_TIMESTAMP
      ON CONFLICT(event_type, scheduled_at, country) DO UPDATE SET
        external_id=COALESCE(economic_events.external_id, excluded.external_id),
        event_name=excluded.event_name, expected_impact=excluded.expected_impact,
        source_url=excluded.source_url, updated_at=CURRENT_TIMESTAMP`)
      .bind(event.eventName, event.eventType, event.country, event.scheduledAt, event.expectedImpact,
        event.status, event.sourceUrl, event.externalId)));
    await getDb().prepare("UPDATE job_runs SET finished_at=CURRENT_TIMESTAMP, status='SUCCESS' WHERE id=?")
      .bind(job.id).run();
    return { status: 'SUCCESS', synced: events.length } as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : '캘린더 동기화 실패';
    await getDb().prepare("UPDATE job_runs SET finished_at=CURRENT_TIMESTAMP, status='FAILED', error_message=? WHERE id=?")
      .bind(message, job.id).run();
    throw error;
  }
}
