import { responseLevel } from '@/lib/forecast';
import {
  emailDeliveryStatus, emailMessage, notificationDue, telegramCommandMessage, telegramMessage,
  type EmailRecipient, type NotificationChannel, type NotificationPayload, type NotificationSettingInput,
} from '@/lib/notification';
import { getKisDashboard } from './kis-insights';

export type NotificationEnv = Cloudflare.Env & {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  EMAIL?: SendEmail;
  RESEND_API_KEY?: string;
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

async function recipients(env: NotificationEnv): Promise<EmailRecipient[]> {
  const rows = await env.DB.prepare('SELECT id, email FROM email_recipients ORDER BY email').all<{ id: number; email: string }>();
  const items: EmailRecipient[] = rows.results.map((item) => ({ ...item, source: 'DATABASE' }));
  const fallback = env.EMAIL_TO?.trim().toLowerCase();
  if (fallback && !items.some((item) => item.email === fallback)) items.unshift({ id: null, email: fallback, source: 'ENV' });
  return items;
}

export async function notificationAdminState(env: NotificationEnv) {
  const [channelSettings, emailRecipients, jobs, deliveries] = await Promise.all([
    settings(env.DB),
    recipients(env),
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
      EMAIL: Boolean(emailRecipients.length && ((env.EMAIL && env.EMAIL_FROM) || env.RESEND_API_KEY)),
    },
    recipients: emailRecipients,
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

export async function saveEmailRecipients(db: D1Database, emails: string[]) {
  await db.batch([
    db.prepare('DELETE FROM email_recipients'),
    ...emails.map((email) => db.prepare('INSERT INTO email_recipients (email) VALUES (?)').bind(email)),
  ]);
}

export async function latestNotificationPayload(db: D1Database, now = new Date()): Promise<NotificationPayload | null> {
  const report = await db.prepare(`SELECT id AS reportId, report_date AS reportDate,
    overall_score AS overallScore, global_score AS globalScore, korea_score AS koreaScore,
    summary, up_probability AS upProbability, expected_low AS expectedLow,
    expected_high AS expectedHigh FROM reports ORDER BY report_date DESC, id DESC LIMIT 1`)
    .first<Omit<NotificationPayload, 'responseLevel' | 'metrics' | 'news' | 'events'>>();
  if (!report) return null;
  const [metricRows, forecast, newsRows, eventRows, kis] = await Promise.all([
    db.prepare(`SELECT a.symbol, a.name, a.asset_type AS assetType,
      a.importance_weight AS importanceWeight, m.price, m.daily_return AS dailyReturn,
      m.composite_score AS compositeScore, m.trend_score AS trendScore,
      m.momentum_score AS momentumScore, m.risk_score AS riskScore, m.news_score AS newsScore,
      m.score_change AS scoreChange1d, m.price_date AS priceDate
      FROM assets a LEFT JOIN report_metrics m ON m.asset_id=a.id AND m.report_id=?
      WHERE a.enabled=1 ORDER BY m.composite_score DESC, a.symbol`)
      .bind(report.reportId).all<NotificationPayload['metrics'][number]>(),
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
    getKisDashboard(),
  ]);
  return {
    ...report,
    responseLevel: forecast ? responseLevel(forecast) : '데이터 축적 대기',
    metrics: metricRows.results,
    news: newsRows.results,
    events: eventRows.results,
    kis,
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

async function sendEmail(env: NotificationEnv, to: string, message: ReturnType<typeof emailMessage>) {
  if (env.EMAIL && env.EMAIL_FROM) return env.EMAIL.send({ from: env.EMAIL_FROM, to, ...message });
  if (!env.RESEND_API_KEY) throw new Error('무료 Email API 키가 설정되지 않았습니다.');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json', 'user-agent': 'market-intelligence-tracker/1.0' },
    body: JSON.stringify({ from: env.EMAIL_FROM ?? 'Market Intelligence <onboarding@resend.dev>', to: [to], ...message }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(`Email 발송 실패 (${response.status}): ${error.message ?? '응답 오류'}`);
  }
}

async function claimDelivery(db: D1Database, settingId: number, reportId: number) {
  return db.prepare(`INSERT INTO notification_deliveries
    (setting_id, report_id, status, attempted_at) VALUES (?, ?, 'RUNNING', CURRENT_TIMESTAMP)
    ON CONFLICT(setting_id, report_id) DO UPDATE SET
      status='RUNNING', error_message=NULL, attempted_at=CURRENT_TIMESTAMP
    WHERE notification_deliveries.status IN ('FAILED', 'PARTIAL')
      OR (notification_deliveries.status='RUNNING' AND
        (notification_deliveries.attempted_at IS NULL
          OR datetime(notification_deliveries.attempted_at)<datetime('now', '-15 minutes')))
    RETURNING id`).bind(settingId, reportId).first<{ id: number }>();
}

async function deliverEmailRecipients(db: D1Database, deliveryId: number, env: NotificationEnv,
  addresses: string[], message: ReturnType<typeof emailMessage>) {
  if (!addresses.length) return { status: 'FAILED' as const, error: 'Email 수신 주소가 설정되지 않았습니다.' };
  await db.batch(addresses.map((address) => db.prepare(`INSERT OR IGNORE INTO notification_recipient_deliveries
    (delivery_id, recipient, status) VALUES (?, ?, 'PENDING')`).bind(deliveryId, address)));
  const existing = await db.prepare(`SELECT recipient, status FROM notification_recipient_deliveries
    WHERE delivery_id=?`).bind(deliveryId).all<{ recipient: string; status: string }>();
  const statuses = new Map(existing.results.map((item) => [item.recipient, item.status]));
  let sent = 0;
  const failures: string[] = [];
  for (const address of addresses) {
    if (statuses.get(address) === 'SENT') {
      sent += 1;
      continue;
    }
    await db.prepare(`UPDATE notification_recipient_deliveries SET status='RUNNING',
      attempted_at=CURRENT_TIMESTAMP, error_message=NULL WHERE delivery_id=? AND recipient=?`)
      .bind(deliveryId, address).run();
    try {
      await sendEmail(env, address, message);
      await db.prepare(`UPDATE notification_recipient_deliveries SET status='SENT',
        sent_at=CURRENT_TIMESTAMP, error_message=NULL WHERE delivery_id=? AND recipient=?`)
        .bind(deliveryId, address).run();
      sent += 1;
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Email 발송에 실패했습니다.';
      await db.prepare(`UPDATE notification_recipient_deliveries SET status='FAILED', error_message=?
        WHERE delivery_id=? AND recipient=?`).bind(detail, deliveryId, address).run();
      failures.push(`${address}: ${detail}`);
    }
  }
  const status = emailDeliveryStatus(sent, failures.length);
  return { status, error: failures.length ? failures.join('; ') : undefined };
}

export async function runNotifications(env: NotificationEnv, options: {
  now?: Date;
  dueOnly?: boolean;
  baseUrl?: string;
  jobName?: string;
} = {}) {
  const now = options.now ?? new Date();
  const channelSettings = await settings(env.DB);
  const eligible = channelSettings.filter((setting) => setting.enabled
    && (!options.dueOnly || notificationDue(now, setting.sendTime, setting.timezone).due));
  if (!eligible.length) return { reportId: null, results: [] };
  const latest = await env.DB.prepare(`SELECT id AS reportId FROM reports
    ORDER BY report_date DESC, id DESC LIMIT 1`).first<{ reportId: number }>();
  if (!latest) throw new Error('발송할 Daily Report가 없습니다.');
  const results: Array<{ channel: NotificationChannel; status: 'SENT' | 'FAILED' | 'PARTIAL' | 'SKIPPED'; error?: string }> = [];
  const claimed: Array<{ setting: SettingRow; deliveryId: number }> = [];
  for (const setting of eligible) {
    const delivery = await claimDelivery(env.DB, setting.id, latest.reportId);
    if (delivery) claimed.push({ setting, deliveryId: delivery.id });
    else results.push({ channel: setting.channel, status: 'SKIPPED' });
  }
  if (!claimed.length) return { reportId: latest.reportId, results };
  const started = await env.DB.prepare(`INSERT INTO job_runs (job_name, status)
    VALUES (?, 'RUNNING') RETURNING id`).bind(options.jobName ?? 'NOTIFICATION').first<{ id: number }>();
  if (!started) throw new Error('Job 실행 기록을 만들지 못했습니다.');
  try {
    const payload = await latestNotificationPayload(env.DB, now);
    if (!payload) throw new Error('발송할 Daily Report가 없습니다.');
    const reportUrl = `${(options.baseUrl ?? env.PUBLIC_APP_URL ?? 'https://market-intelligence-tracker.sjsuk321.workers.dev').replace(/\/$/, '')}/`;
    const emailRecipients = (await recipients(env)).map((item) => item.email);
    for (const item of claimed) {
      let outcome: { status: 'SENT' | 'FAILED' | 'PARTIAL'; error?: string };
      if (item.setting.channel === 'EMAIL') {
        outcome = await deliverEmailRecipients(env.DB, item.deliveryId, env, emailRecipients,
          emailMessage(payload, reportUrl));
      } else {
        try {
          await sendTelegram(env, telegramMessage(payload, reportUrl));
          outcome = { status: 'SENT' };
        } catch (error) {
          outcome = { status: 'FAILED', error: error instanceof Error ? error.message : '알림 발송에 실패했습니다.' };
        }
      }
      await env.DB.prepare(`UPDATE notification_deliveries SET status=?, error_message=?,
        sent_at=CASE WHEN ?='SENT' THEN CURRENT_TIMESTAMP ELSE sent_at END WHERE id=?`)
        .bind(outcome.status, outcome.error ?? null, outcome.status, item.deliveryId).run();
      results.push({ channel: item.setting.channel, ...outcome });
    }
    const attempted = results.filter((item) => item.status !== 'SKIPPED');
    const failures = attempted.filter((item) => item.status === 'FAILED' || item.status === 'PARTIAL');
    const jobStatus = failures.length ? (attempted.some((item) => item.status === 'SENT' || item.status === 'PARTIAL') ? 'PARTIAL' : 'FAILED') : 'SUCCESS';
    await env.DB.prepare(`UPDATE job_runs SET finished_at=CURRENT_TIMESTAMP, status=?, error_message=? WHERE id=?`)
      .bind(jobStatus, failures.map((item) => item.error).filter(Boolean).join('; ') || null, started.id).run();
    return { reportId: payload.reportId, results };
  } catch (error) {
    const message = error instanceof Error ? error.message : '알림 작업에 실패했습니다.';
    await env.DB.batch([
      env.DB.prepare(`UPDATE job_runs SET finished_at=CURRENT_TIMESTAMP, status='FAILED',
        error_message=? WHERE id=?`).bind(message, started.id),
      ...claimed.map((item) => env.DB.prepare(`UPDATE notification_deliveries SET status='FAILED',
        error_message=? WHERE id=? AND status='RUNNING'`).bind(message, item.deliveryId)),
    ]);
    throw error;
  }
}

export async function replyToTelegramCommand(env: NotificationEnv, command: string, baseUrl: string) {
  const payload = await latestNotificationPayload(env.DB);
  if (!payload) throw new Error('조회할 Daily Report가 없습니다.');
  const reportUrl = `${baseUrl.replace(/\/$/, '')}/`;
  await sendTelegram(env, telegramCommandMessage(command, payload, reportUrl));
}
