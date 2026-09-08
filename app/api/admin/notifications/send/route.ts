import { env } from 'cloudflare:workers';
import { runNotifications, type NotificationEnv } from '@/db/notifications';
import { apiError, json, requireAdmin } from '@/lib/api';

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    return json(await runNotifications(env as NotificationEnv, {
      baseUrl: new URL(request.url).origin,
      jobName: 'NOTIFICATION_MANUAL',
    }));
  } catch (error) {
    return apiError(error);
  }
}
