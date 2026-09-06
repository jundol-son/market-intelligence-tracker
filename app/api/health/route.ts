import { getDb } from '@/db';
import { json } from '@/lib/api';

export async function GET() {
  try {
    await getDb().prepare('SELECT 1').first();
    return json({ status: 'ok', database: 'connected' });
  } catch {
    return json({ status: 'degraded', database: 'unavailable' }, 503);
  }
}
