import app from 'vinext/server/fetch-handler';
import { runNotifications, type NotificationEnv } from '../db/notifications';
import { runDailyKisUpdate } from '../db/daily-update';
import { collectPeriodicNews } from '../db/news';
import { syncEconomicCalendar } from '../db/economic-calendar';

export default {
  fetch: app.fetch,
  async scheduled(controller, env) {
    const now = new Date(controller.scheduledTime);
    await syncEconomicCalendar(now).catch(() => undefined);
    await collectPeriodicNews(env.ALPHA_VANTAGE_API_KEY, now).catch(() => undefined);
    await runDailyKisUpdate({ alphaVantageApiKey: env.ALPHA_VANTAGE_API_KEY, kisAppKey: env.KIS_APP_KEY, kisAppSecret: env.KIS_APP_SECRET }, now).catch(() => undefined);
    await runNotifications(env, {
      now,
      dueOnly: true,
      jobName: 'NOTIFICATION_CRON',
    });
  },
} satisfies ExportedHandler<NotificationEnv>;
