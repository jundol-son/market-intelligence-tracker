import { env } from 'cloudflare:workers';
import { getDb } from '@/db';
import { json } from '@/lib/api';

const providers = () => ({
  alphaConfigured: Boolean(env.ALPHA_VANTAGE_API_KEY),
  naverConfigured: Boolean(env.NAVER_API_HUB_CLIENT_ID && env.NAVER_API_HUB_CLIENT_SECRET),
  kisConfigured: Boolean(env.KIS_APP_KEY && env.KIS_APP_SECRET),
});

export async function GET() {
  try {
    await getDb().prepare('SELECT 1').first();
    return json({ status: 'ok', database: 'connected', providers: providers() });
  } catch {
    return json({ status: 'degraded', database: 'unavailable', providers: providers() }, 503);
  }
}
