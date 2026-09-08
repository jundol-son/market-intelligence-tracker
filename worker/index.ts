import app from 'vinext/server/fetch-handler';
import { runNotifications, type NotificationEnv } from '../db/notifications';

export default {
  fetch: app.fetch,
  async scheduled(controller, env) {
    await runNotifications(env, {
      now: new Date(controller.scheduledTime),
      dueOnly: true,
      jobName: 'NOTIFICATION_CRON',
    });
  },
} satisfies ExportedHandler<NotificationEnv>;
