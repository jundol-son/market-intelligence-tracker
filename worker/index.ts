import app from 'vinext/server/fetch-handler';
import { runNotifications, type NotificationEnv } from '../db/notifications';
import { refreshKeylessMacro, runDailyKisUpdate } from '../db/daily-update';
import { collectPeriodicNaverNews, collectPeriodicNews } from '../db/news';
import { syncEconomicCalendar } from '../db/economic-calendar';
import { scheduledCollectionTasks } from '../lib/schedule';

async function runScheduledTask(env: NotificationEnv, jobName: string, task: () => Promise<unknown>) {
  try {
    await task();
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : '예약 작업 실패';
    console.error(`${jobName}: ${message}`);
    await env.DB.prepare(`INSERT INTO job_runs
      (job_name, started_at, finished_at, status, error_message)
      VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'FAILED', ?)`)
      .bind(jobName, message).run();
  }
}

export default {
  fetch: app.fetch,
  async scheduled(controller, env) {
    const now = new Date(controller.scheduledTime);
    const tasks = scheduledCollectionTasks(now);
    if (tasks.calendar) await runScheduledTask(env, 'CRON:CALENDAR', () => syncEconomicCalendar(now));
    if (tasks.keylessMacro) await runScheduledTask(env, 'CRON:KEYLESS_MACRO', () => refreshKeylessMacro({
      alphaVantageApiKey: env.ALPHA_VANTAGE_API_KEY,
      kisAppKey: env.KIS_APP_KEY, kisAppSecret: env.KIS_APP_SECRET,
    }));
    if (tasks.news) {
      await runScheduledTask(env, 'CRON:ALPHA_NEWS', () => collectPeriodicNews(env.ALPHA_VANTAGE_API_KEY, now));
      await runScheduledTask(env, 'CRON:NAVER_NEWS', () => collectPeriodicNaverNews(
        env.NAVER_API_HUB_CLIENT_ID, env.NAVER_API_HUB_CLIENT_SECRET, now));
    }
    await runScheduledTask(env, 'CRON:DAILY_KIS', () => runDailyKisUpdate({
      alphaVantageApiKey: env.ALPHA_VANTAGE_API_KEY,
      kisAppKey: env.KIS_APP_KEY, kisAppSecret: env.KIS_APP_SECRET,
    }, now));
    await runScheduledTask(env, 'CRON:NOTIFICATION', () => runNotifications(env, {
      now,
      dueOnly: true,
      jobName: 'NOTIFICATION_CRON',
    }));
  },
} satisfies ExportedHandler<NotificationEnv>;
