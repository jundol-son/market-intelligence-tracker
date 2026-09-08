import { env } from 'cloudflare:workers';
import { notificationAdminState, saveNotificationSettings, type NotificationEnv } from '@/db/notifications';
import { apiError, json, requireAdmin } from '@/lib/api';
import { parseNotificationSettings } from '@/lib/notification';

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    return json(await notificationAdminState(env as NotificationEnv));
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const settings = parseNotificationSettings(await request.json());
    await saveNotificationSettings(env.DB, settings);
    return json(await notificationAdminState(env as NotificationEnv));
  } catch (error) {
    return apiError(error);
  }
}
