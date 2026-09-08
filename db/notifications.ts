import { responseLevel } from '@/lib/forecast';
import {
  emailMessage, notificationDue, telegramCommandMessage, telegramMessage,
  type NotificationChannel, type NotificationPayload, type NotificationSettingInput,
} from '@/lib/notification';

export type NotificationEnv = Cloudflare.Env & {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  EMAIL?: SendEmail;
  EMAIL_FROM?: string;
  EMAIL_TO?: string;
  PUBLIC_APP_URL?: string;
};

type SettingRow = NotificationSettingInput & { id: number; updatedAt: string };

async function ensureSettings(db: D1Database) {
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO notification_settings
      (channel, enabled, send_time, timezone, config_json) VALUES ('TELEGRAM', 0, '08:00', 'Asia/Seoul', '{}')`),
    db.prepare(`INSERT OR IGNORE INTO notification_settings
      (channel, enabled, send_time, timezone, config_json) VALUES ('EMAIL', 0, '08:00', 'Asia/Seoul', '{}')`),
  ]);
}

async function settings(db: D1Database) {
  await ensureSettings(db);
  const result = await db.prepare(`SELECT id, channel, enabled, send_time AS sendTime,
    timezone, updated_at AS updatedAt FROM notification_settings ORDER BY channel DESC`)
    .all<SettingRow>();
  return result.results;
}

export async function notificationAdminState(env: NotificationEnv) {
  const [channelSettings, jobs, deliveries] = await Promise.all([
    settings(env.DB),
    env.DB.prepare(`SELECT id, job_name AS jobName, started_at AS startedAt,
      finished_at AS finishedAt, status, error_message AS errorMessage
      FROM job_runs ORDER BY id DESC LIMIT 20`).all(),
    env.DB.prepare(`SELECT d.id, s.channel, r.report_date AS reportDate, d.status,
      d.error_message AS errorMessage, d.sent_at AS sentAt
      FROM notification_deliveries d JOIN notification_settings s ON s.id=d.setting_id
      JOIN reports r ON r.id=d.report_id ORDER BY d.id DESC LIMIT 20`).all(),
  ]);
  return {
    settings: channelSettings,
    configured: {
      TELEGRAM: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID && env.TELEGRAM_WEBHOOK_SECRET),
      EMAIL: Boolean(env.EMAIL && env.EMAIL_FROM && env.EMAIL_TO),
    },
    jobs: jobs.results,
    deliveries: deliveries.results,
  };
}

export async function saveNotificationSettings(db: D1Database, input: NotificationSettingInput[]) {
  await ensureSettings(db);
  await db.batch(input.map((item) => db.prepare(`UPDATE notification_settings
    SET enabled=?, send_time=?, timezone=?, updated_at=CURRENT_TIMESTAMP WHERE channel=?`)
    .bind(item.enabled ? 1 : 0, item.sendTime, item.timezone, item.channel)));
}

export async function latestNotificationPayload(db: D1Database, now = new Date()): Promise<NotificationPayload | null> {
  const report = await db.prepare(`SELECT id AS reportId, report_date AS reportDate,
    overall_score AS overallScore, global_score AS globalScore, korea_score AS koreaScore,
    summary, up_probability AS upProbability, expected_low AS expectedLow,
    expected_high AS expectedHigh FROM reports ORDER BY report_date DESC, id DESC LIMIT 1`)
    .first<Omit<NotificationPayload, 'responseLevel' | 'metrics' | 'news' | 'events'>>();
  if (!report) return null;
  const [metricRows, forecast, newsRows, eventRows] = await Promise.all([
    db.prepare(`SELECT symbol, name, price, daily_return AS dailyReturn,
      composite_score AS compositeScore, trend_score AS trendScore,
      momentum_score AS momentumScore, risk_score AS riskScore, news_score AS newsScore
      FROM report_metrics WHERE report_id=? ORDER BY composite_score DESC, symbol`).bind(report.reportId).all<NotificationPayload['metrics'][number]>(),
    db.prepare(`SELECT up_probability AS upProbability, down_probability AS downProbability,
      expected_low AS expectedLow, expected_high AS expectedHigh,
      bull_probability AS bullProbability, base_probability AS baseProbability,
      bear_probability AS bearProbability, confidence FROM forecasts
      WHERE report_id=? ORDER BY id LIMIT 1`).bind(report.reportId).first<Parameters<typeof responseLevel>[0]>(),
    db.prepare(`SELECT title, sentiment, impact_score AS impactScore FROM news_events
      WHERE datetime(event_time)>=datetime(?, '-7 days') ORDER BY impact_score DESC, event_time DESC LIMIT 5`)
      .bind(report.reportDate).all<NotificationPayload['news'][number]>(),
    db.prepare(`SELECT event_name AS eventName, scheduled_at AS scheduledAt,
      expected_impact AS expectedImpact FROM economic_events WHERE status='SCHEDULED'
      AND datetime(scheduled_at)>=datetime(?) ORDER BY expected_impact DESC, scheduled_at LIMIT 5`)
      .bind(now.toISOString()).all<NotificationPayload['events'][number]>(),
  ]);
  return {
    ...report,
    responseLevel: forecast ? responseLevel(forecast) : '데이터 축적 대기',
    metrics: metricRows.results,
    news: newsRows.results,
    events: eventRows.results,
  };
}

async function sendTelegram(env: NotificationEnv, text: string) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) throw new Error('Telegram Worker Secrets가 설정되지 않았습니다.');
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true }),
  });
  if (!response.ok) throw new Error(`Telegram 발송에 실패했습니다. (${response.status})`);
}

async function deliver(channel: NotificationChannel, payload: NotificationPayload, env: NotificationEnv, reportUrl: string) {
  if (channel === 'TELEGRAM') return sendTelegram(env, telegramMessage(payload, reportUrl));
  if (!env.EMAIL || !env.EMAIL_FROM || !env.EMAIL_TO) throw new Error('Email Binding과 발신·수신 주소가 설정되지 않았습니다.');
  const message = emailMessage(payload, reportUrl);
  await env.EMAIL.send({ from: env.EMAIL_FROM, to: env.EMAIL_TO, ...message });
}

export async function runNotifications(env: NotificationEnv, options: {
  now?: Date;
  dueOnly?: boolean;
  baseUrl?: string;
  jobName?: string;
} = {}) {
  const now = options.now ?? new Date();
  const started = await env.DB.prepare(`INSERT INTO job_runs (job_name, status)
    VALUES (?, 'RUNNING') RETURNING id`).bind(options.jobName ?? 'NOTIFICATION').first<{ id: number }>();
  if (!started) throw new Error('Job 실행 기록을 만들지 못했습니다.');
  try {
    const payload = await latestNotificationPayload(env.DB, now);
    if (!payload) throw new Error('발송할 Daily Report가 없습니다.');
    const reportUrl = `${(options.baseUrl ?? env.PUBLIC_APP_URL ?? 'https://market-intelligence-tracker.sjsuk321.workers.dev').replace(/\/$/, '')}/`;
    const results: Array<{ channel: NotificationChannel; status: 'SENT' | 'FAILED' | 'SKIPPED'; error?: string }> = [];
    for (const setting of await settings(env.DB)) {
      if (!setting.enabled) continue;
      if (options.dueOnly && !notificationDue(now, setting.sendTime, setting.timezone).due) {
        results.push({ channel: setting.channel, status: 'SKIPPED' });
        continue;
      }
      const previous = await env.DB.prepare(`SELECT status FROM notification_deliveries
        WHERE setting_id=? AND report_id=?`).bind(setting.id, payload.reportId).first<{ status: string }>();
      if (previous?.status === 'SENT') {
        results.push({ channel: setting.channel, status: 'SKIPPED' });
        continue;
      }
      await env.DB.prepare(`INSERT INTO notification_deliveries (setting_id, report_id, status)
        VALUES (?, ?, 'RUNNING') ON CONFLICT(setting_id, report_id) DO UPDATE SET
        status='RUNNING', error_message=NULL`).bind(setting.id, payload.reportId).run();
      try {
        await deliver(setting.channel, payload, env, reportUrl);
        await env.DB.prepare(`UPDATE notification_deliveries SET status='SENT', sent_at=CURRENT_TIMESTAMP,
          error_message=NULL WHERE setting_id=? AND report_id=?`).bind(setting.id, payload.reportId).run();
        results.push({ channel: setting.channel, status: 'SENT' });
      } catch (error) {
        const message = error instanceof Error ? error.message : '알림 발송에 실패했습니다.';
        await env.DB.prepare(`UPDATE notification_deliveries SET status='FAILED', error_message=?
          WHERE setting_id=? AND report_id=?`).bind(message, setting.id, payload.reportId).run();
        results.push({ channel: setting.channel, status: 'FAILED', error: message });
      }
    }
    const failed = results.filter((item) => item.status === 'FAILED');
    await env.DB.prepare(`UPDATE job_runs SET finished_at=CURRENT_TIMESTAMP, status=?, error_message=? WHERE id=?`)
      .bind(failed.length ? 'FAILED' : 'SUCCESS', failed.map((item) => item.error).join('; ') || null, started.id).run();
    return { reportId: payload.reportId, results };
  } catch (error) {
    const message = error instanceof Error ? error.message : '알림 작업에 실패했습니다.';
    await env.DB.prepare(`UPDATE job_runs SET finished_at=CURRENT_TIMESTAMP, status='FAILED',
      error_message=? WHERE id=?`).bind(message, started.id).run();
    throw error;
  }
}

export async function replyToTelegramCommand(env: NotificationEnv, command: string, baseUrl: string) {
  const payload = await latestNotificationPayload(env.DB);
  if (!payload) throw new Error('조회할 Daily Report가 없습니다.');
  const reportUrl = `${baseUrl.replace(/\/$/, '')}/`;
  await sendTelegram(env, telegramCommandMessage(command, payload, reportUrl));
}
