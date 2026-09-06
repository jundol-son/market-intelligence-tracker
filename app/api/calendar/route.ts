import { listEconomicEvents } from '@/db/economic-events';
import { apiError, json } from '@/lib/api';

export async function GET() {
  try {
    return json({ events: await listEconomicEvents() });
  } catch (error) {
    return apiError(error);
  }
}
