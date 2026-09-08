import { env } from 'cloudflare:workers';
import { replyToTelegramCommand, type NotificationEnv } from '@/db/notifications';
import { apiError, json } from '@/lib/api';

function sameSecret(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function POST(request: Request) {
  const runtime = env as NotificationEnv;
  if (!runtime.TELEGRAM_WEBHOOK_SECRET || !runtime.TELEGRAM_CHAT_ID || !runtime.TELEGRAM_BOT_TOKEN) {
    return json({ error: 'Telegram Worker Secrets가 설정되지 않았습니다.' }, 503);
  }
  const provided = request.headers.get('X-Telegram-Bot-Api-Secret-Token') ?? '';
  if (!sameSecret(provided, runtime.TELEGRAM_WEBHOOK_SECRET)) return json({ error: '허용되지 않은 Telegram 요청입니다.' }, 401);
  try {
    const update = await request.json() as { message?: { text?: string; chat?: { id?: number | string } } };
    if (String(update.message?.chat?.id ?? '') !== runtime.TELEGRAM_CHAT_ID || !update.message?.text?.startsWith('/')) {
      return json({ ok: true, ignored: true });
    }
    await replyToTelegramCommand(runtime, update.message.text, new URL(request.url).origin);
    return json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
