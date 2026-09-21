import { env } from 'cloudflare:workers';
import { notificationAdminState, saveEmailRecipients, saveNotificationSettings, type NotificationEnv } from '@/db/notifications';
import { apiError, json, requireAdmin } from '@/lib/api';
import { parseEmailRecipients, parseNotificationSettings } from '@/lib/notification';

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
    const input = await request.json();
    const settings = parseNotificationSettings(input);
    const recipients = parseEmailRecipients(input);
    await Promise.all([saveNotificationSettings(env.DB, settings), saveEmailRecipients(env.DB, recipients)]);
    return json(await notificationAdminState(env as NotificationEnv));
  } catch (error) {
    return apiError(error);
  }
}
