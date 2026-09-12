import app from 'vinext/server/fetch-handler';
import { runNotifications, type NotificationEnv } from '../db/notifications';
import { runDailyKisUpdate } from '../db/daily-update';

export default {
  fetch: app.fetch,
  async scheduled(controller, env) {
    await runDailyKisUpdate({ alphaVantageApiKey: env.ALPHA_VANTAGE_API_KEY, kisAppKey: env.KIS_APP_KEY, kisAppSecret: env.KIS_APP_SECRET }, new Date(controller.scheduledTime)).catch(() => undefined);
    await runNotifications(env, {
      now: new Date(controller.scheduledTime),
      dueOnly: true,
      jobName: 'NOTIFICATION_CRON',
    });
  },
} satisfies ExportedHandler<NotificationEnv>;
